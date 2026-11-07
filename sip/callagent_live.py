"""
CallAgent Live-Modus: Asterisk AudioSocket <-> Gemini Live (Sprache rein, Sprache raus).

Statt Vosk -> Text-LLM -> TTS (5-9 s pro Antwort) streamt das Anrufer-Audio direkt zu
Gemini Live; Gemmas Stimme (Kore) kommt gestreamt zurueck. Gemini erkennt das Satzende
selbst (VAD) und kann unterbrochen werden. Transkript -> /api/notiz, Ende -> /api/end
(Zusammenfassung + Telegram) wie bisher. Muster wie /opt/gemma-live/bruecke.py.
"""
import asyncio, logging, os, time
import numpy as np
from google import genai
from google.genai import types

from callagent_sip import backend, hoch16k, RATE, FRAME, MAX_DAUER_S

log = logging.getLogger("callagent-live")

LIVE_MODELL = os.environ.get("CALLAGENT_LIVE_MODELL", "gemini-3.8-live")
STIMME = os.environ.get("CALLAGENT_STIMME", "Kore")
KEY_DATEI = os.environ.get("CALLAGENT_GEMINI_KEY", "/opt/gemma-live/gemini-key-paid")
VAD_STILLE_MS = int(os.environ.get("CALLAGENT_VAD_STILLE_MS", "500"))
STILLE_ENDE_S = float(os.environ.get("SIP_STILLE_ENDE_S", "30"))

AUFLEGEN = types.FunctionDeclaration(
    name="auflegen",
    description="Beendet den Anruf. Nur aufrufen, nachdem du dich verabschiedet hast.")


class Runter24zu8:
    """24 kHz -> 8 kHz mit Tiefpass, Zustand ueber Chunk-Grenzen (keine Knackser)."""
    def __init__(self):
        n = np.arange(-32, 33)
        fc = 3400 / 24000
        h = 2 * fc * np.sinc(2 * fc * n) * np.hamming(len(n))
        self.h = (h / h.sum()).astype(np.float32)
        self.rest = np.zeros(len(self.h) - 1, dtype=np.float32)
        self.phase = 0

    def __call__(self, pcm24: bytes) -> bytes:
        x = np.frombuffer(pcm24, dtype="<i2").astype(np.float32)
        if not len(x):
            return b""
        buf = np.concatenate([self.rest, x])
        y = np.convolve(buf, self.h, mode="valid")
        self.rest = buf[-(len(self.h) - 1):]
        aus = y[self.phase::3]
        self.phase = (self.phase - len(y)) % 3
        return np.clip(aus, -32768, 32767).astype("<i2").tobytes()


class LiveAnruf:
    def __init__(self, anruf):
        # anruf: callagent_sip.Anruf (liefert AudioSocket-Lesen/Senden + Nummer)
        self.a = anruf
        self.puffer = bytearray()       # 8-kHz-Audio, das noch abgespielt werden muss
        self.runter = Runter24zu8()
        self.auflegen_nach_audio = False
        self.text_ich, self.text_er = [], []
        self.letzte_aktivitaet = time.monotonic()
        self.pegel_s = self.pegel_n = 0

    async def notiz(self, ich, teile):
        text = "".join(teile).strip()
        teile.clear()
        if text and self.a.session:
            await asyncio.to_thread(backend, "/api/notiz",
                                    {"session": self.a.session, "ich": ich, "text": text}, 15)
            log.info("[%s] %s: %s", self.a.nummer, "Gemma" if ich else "Anrufer", text)

    async def abspielen(self):
        """Puffer im 20-ms-Takt in den Anruf schieben."""
        t_naechst = time.monotonic()
        while self.a.offen:
            if len(self.puffer) >= FRAME or (self.puffer and self.auflegen_nach_audio):
                block = bytes(self.puffer[:FRAME]).ljust(FRAME, b"\0")
                del self.puffer[:FRAME]
                await self.a.senden(0x10, block)
                self.letzte_aktivitaet = time.monotonic()
                t_naechst = max(t_naechst + 0.02, time.monotonic() - 0.06)
                await asyncio.sleep(max(0, t_naechst - time.monotonic()))
            else:
                if self.auflegen_nach_audio:
                    await asyncio.sleep(0.6)
                    self.a.grund = "sip-gemma-beendet"
                    await self.a.senden(0x00)
                    self.a.offen = False
                    return
                t_naechst = time.monotonic()
                await asyncio.sleep(0.01)

    async def hoeren(self, s):
        """Anrufer-Audio (8k) -> 16k -> Gemini, in 100-ms-Paketen."""
        sammel = bytearray()
        while self.a.offen:
            try:
                typ, daten = await asyncio.wait_for(self.a.lesen(), timeout=0.1)
            except asyncio.TimeoutError:
                # Paketpause (Asterisk/Gegenstelle sendet in Pausen nichts): Stille in ECHTZEIT
                # nachliefern (100 ms je 100 ms), sonst erkennt Geminis VAD nie das Satzende
                typ, daten = 0x10, b"\0" * (FRAME * 5)
            if typ in (0x00, 0xff, -1):
                self.a.grund = "sip-aufgelegt" if typ != 0xff else "sip-fehler"
                self.a.offen = False
                return
            jetzt = time.monotonic()
            if jetzt - self.a.start > MAX_DAUER_S:
                self.a.grund = "sip-max-dauer"; await self.a.senden(0x00); self.a.offen = False; return
            if jetzt - self.letzte_aktivitaet > STILLE_ENDE_S:
                self.a.grund = "sip-stille"; await self.a.senden(0x00); self.a.offen = False; return
            if typ != 0x10:
                continue
            sammel += daten
            self.pegel_s += int(np.abs(np.frombuffer(daten, dtype="<i2")).mean()) if daten else 0
            self.pegel_n += 1
            if self.pegel_n >= 100:
                log.info("[%s] Eingang avg %d", self.a.nummer, self.pegel_s // self.pegel_n)
                self.pegel_s = self.pegel_n = 0
            if len(sammel) >= FRAME * 5:
                await s.send_realtime_input(
                    audio=types.Blob(data=hoch16k(bytes(sammel)), mime_type="audio/pcm;rate=16000"))
                sammel.clear()

    async def antworten(self, s):
        while self.a.offen:
            async for msg in s.receive():
                if not self.a.offen:
                    return
                sc = msg.server_content
                if os.environ.get("CALLAGENT_LIVE_DEBUG"):
                    d = msg.model_dump(exclude_none=True)
                    if sc and sc.model_turn:
                        d.get("server_content", {}).pop("model_turn", None)
                    if d.get("server_content") or len(d) > 1 or "server_content" not in d:
                        log.info("[dbg] %s", str(d)[:300])
                if msg.tool_call:
                    for fc in msg.tool_call.function_calls or []:
                        if fc.name == "auflegen":
                            log.info("[%s] Gemma legt auf", self.a.nummer)
                            self.auflegen_nach_audio = True
                    await s.send_tool_response(function_responses=[
                        types.FunctionResponse(id=fc.id, name=fc.name, response={"ok": True})
                        for fc in (msg.tool_call.function_calls or [])])
                if not sc:
                    continue
                if sc.input_transcription and sc.input_transcription.text:
                    if self.text_ich:
                        await self.notiz(True, self.text_ich)
                    self.text_er.append(sc.input_transcription.text)
                    self.letzte_aktivitaet = time.monotonic()
                if sc.output_transcription and sc.output_transcription.text:
                    if self.text_er:
                        await self.notiz(False, self.text_er)
                    self.text_ich.append(sc.output_transcription.text)
                if sc.interrupted:
                    self.puffer.clear()   # Anrufer redet dazwischen -> Gemma verstummt sofort
                if sc.model_turn:
                    for p in sc.model_turn.parts or []:
                        if p.inline_data and p.inline_data.data:
                            self.puffer += self.runter(p.inline_data.data)
                if sc.turn_complete:
                    await self.notiz(False, self.text_er)
                    await self.notiz(True, self.text_ich)

    async def lauf(self, prompt):
        key = open(KEY_DATEI).read().strip()
        client = genai.Client(api_key=key)
        cfg = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=prompt,
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=STIMME)),
                language_code="de-DE"),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                    silence_duration_ms=VAD_STILLE_MS,
                    prefix_padding_ms=300)),
            tools=[types.Tool(function_declarations=[AUFLEGEN])],
        )
        t0 = time.monotonic()
        async with client.aio.live.connect(model=LIVE_MODELL, config=cfg) as s:
            log.info("[%s] Live verbunden (%s) in %.2f s", self.a.nummer, LIVE_MODELL, time.monotonic() - t0)
            await s.send_realtime_input(text="Der Anruf ist jetzt angenommen. Sag deine Begruessung.")
            aufgaben = [asyncio.create_task(x) for x in
                        (self.abspielen(), self.hoeren(s), self.antworten(s))]
            done, pending = await asyncio.wait(aufgaben, return_when=asyncio.FIRST_COMPLETED)
            self.a.offen = False
            for t in pending:
                t.cancel()
            for t in done:
                if t.exception():
                    raise t.exception()
        await self.notiz(False, self.text_er)
        await self.notiz(True, self.text_ich)
