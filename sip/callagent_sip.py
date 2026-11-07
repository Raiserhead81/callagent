#!/usr/bin/env python3
"""
CallAgent SIP-Bruecke: Asterisk AudioSocket <-> CallAgent-Backend.

Asterisk nimmt den SIP-Anruf an und schickt das Audio per AudioSocket
(TCP, slin 8 kHz 16 bit mono) hierher. Ablauf je Anruf:
  1. /api/start  -> Begruessung (Kore-WAV 24 kHz) -> 8 kHz -> in den Anruf
  2. Anrufer-Audio -> Vosk (offline, deutsch) -> Satz fertig
  3. /api/turn   -> Antwort-WAV -> in den Anruf (waehrenddessen kein STT)
  4. Auflegen (Anrufer oder Gemma) -> /api/end (Transkript+Zusammenfassung in calls.db)

AudioSocket-Rahmen: 1 Byte Typ, 2 Byte Laenge (big endian), Nutzdaten.
  0x00 Hangup, 0x01 UUID (16 Byte), 0x10 Audio, 0xff Fehler
"""
import asyncio, base64, io, json, logging, os, struct, time, uuid, wave
import urllib.request
import numpy as np
from vosk import Model, KaldiRecognizer, SetLogLevel

HOST = os.environ.get("SIP_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("SIP_BRIDGE_PORT", "3118"))
BACKEND = os.environ.get("CALLAGENT_BACKEND", "http://127.0.0.1:3114")
MODELL = os.environ.get("VOSK_MODELL", "/opt/callagent/modell/de/vosk-model-small-de-0.15")
TOKEN_DATEI = os.environ.get("CALLAGENT_TOKEN_DATEI", "/opt/callagent/.app-token")
ANRUFER_DIR = os.environ.get("SIP_ANRUFER_DIR", "/run/callagent-sip")
STILLE_ENDE_S = float(os.environ.get("SIP_STILLE_ENDE_S", "10"))
MAX_DAUER_S = float(os.environ.get("SIP_MAX_DAUER_S", "60"))
KI_MODUS = os.environ.get("CALLAGENT_KI_MODUS", "live")  # live | klassisch

RATE = 8000
STT_RATE = 16000  # Vosk-Modell ist auf 16 kHz trainiert
FRAME = 320  # 20 ms slin 8 kHz

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("callagent-sip")
SetLogLevel(-1)


def token():
    try:
        return open(TOKEN_DATEI).read().strip()
    except OSError:
        return os.environ.get("CALLAGENT_TOKEN", "")


def backend(pfad, daten, timeout=90):
    req = urllib.request.Request(
        BACKEND + pfad, data=json.dumps(daten).encode(),
        headers={"Content-Type": "application/json", "X-App-Token": token()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


# ---------- Audio-Umrechnung ----------
_TP = None
def tiefpass():
    """Windowed-sinc-Tiefpass fuer 24k -> 8k (Grenze ~3.4 kHz)."""
    global _TP
    if _TP is None:
        n = np.arange(-32, 33)
        fc = 3400 / 24000
        h = 2 * fc * np.sinc(2 * fc * n) * np.hamming(len(n))
        _TP = h / h.sum()
    return _TP


def wav_zu_slin8k(wav_bytes):
    with wave.open(io.BytesIO(wav_bytes)) as w:
        rate, kanaele = w.getframerate(), w.getnchannels()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32)
    if kanaele > 1:
        pcm = pcm.reshape(-1, kanaele).mean(axis=1)
    if rate != RATE:
        if rate % RATE == 0:
            pcm = np.convolve(pcm, tiefpass(), mode="same")[:: rate // RATE]
        else:  # allgemeiner Fall: lineare Interpolation
            t = np.arange(0, len(pcm) / rate, 1 / RATE)
            pcm = np.interp(t, np.arange(len(pcm)) / rate, pcm)
    return np.clip(pcm, -32768, 32767).astype("<i2").tobytes()


def hoch16k(slin8):
    """8 kHz -> 16 kHz (lineare Interpolation, reicht fuer Telefon-Sprache)."""
    a = np.frombuffer(slin8, dtype="<i2").astype(np.float32)
    if len(a) == 0:
        return b""
    x = np.arange(len(a) * 2) / 2.0
    return np.interp(x, np.arange(len(a)), a).astype("<i2").tobytes()


def pegel(slin):
    a = np.frombuffer(slin, dtype="<i2")
    return int(np.abs(a).mean()) if len(a) else 0


# ---------- ein Anruf ----------
class Anruf:
    def __init__(self, reader, writer, modell):
        self.r, self.w = reader, writer
        self.modell = modell
        self.session = None
        self.nummer = "unbekannt"
        self.spielt = False
        self.offen = True
        self.letzte_sprache = time.monotonic()
        self.start = time.monotonic()
        self.grund = "sip-aufgelegt"
        self.rec = KaldiRecognizer(modell, STT_RATE)
        self.pegel_summe = self.pegel_n = 0

    async def senden(self, typ, daten=b""):
        if not self.offen:
            return
        self.w.write(struct.pack(">BH", typ, len(daten)) + daten)
        await self.w.drain()

    async def spielen(self, wav_b64):
        slin = await asyncio.to_thread(wav_zu_slin8k, base64.b64decode(wav_b64))
        self.spielt = True
        t0 = time.monotonic()
        try:
            for i in range(0, len(slin), FRAME):
                if not self.offen:
                    return
                block = slin[i:i + FRAME].ljust(FRAME, b"\0")
                await self.senden(0x10, block)
                # Echtzeit-Takt: 20 ms pro Rahmen
                soll = t0 + (i // FRAME + 1) * 0.02
                await asyncio.sleep(max(0, soll - time.monotonic()))
            await asyncio.sleep(0.3)
        finally:
            self.rec.Reset()  # eigenes Echo verwerfen
            self.spielt = False
            self.letzte_sprache = time.monotonic()
        log.info("[%s] gespielt %.1f s", self.nummer, len(slin) / 2 / RATE)

    async def satz(self, text):
        log.info("[%s] Anrufer: %s", self.nummer, text)
        r = await asyncio.to_thread(backend, "/api/turn", {"session": self.session, "text": text})
        if not r.get("ok"):
            log.error("[%s] turn-Fehler: %s", self.nummer, r.get("fehler"))
            return
        log.info("[%s] Gemma (%s): %s", self.nummer, r.get("motor"), r.get("antwort_text"))
        await self.spielen(r["audio_b64"])
        if r.get("ende"):
            self.grund = "sip-gemma-beendet"
            await asyncio.sleep(0.5)
            await self.senden(0x00)
            self.offen = False

    async def lauf(self):
        # 1. UUID -> Anrufernummer (vom Dialplan in ANRUFER_DIR abgelegt)
        typ, daten = await self.lesen()
        if typ == 0x01:
            uid = str(uuid.UUID(bytes=daten))
            try:
                pfad = os.path.join(ANRUFER_DIR, uid)
                self.nummer = open(pfad).read().strip() or "unbekannt"
            except OSError:
                pass
            log.info("Anruf %s von %s", uid, self.nummer)
        if KI_MODUS == "live":
            r = await asyncio.to_thread(backend, "/api/start", {"nummer": self.nummer, "live": True})
            if r.get("ok"):
                self.session = r["session"]
                live = None
                try:
                    from callagent_live import LiveAnruf
                    live = LiveAnruf(self)
                    await live.lauf(r["prompt"])
                    return
                except Exception as e:
                    if not self.offen or (live and (live.puffer or live.text_ich)):
                        raise  # Gespraech lief schon -> kein Neustart mitten im Anruf
                    log.exception("[%s] Live fehlgeschlagen, alter Weg: %s", self.nummer, e)
                    await asyncio.to_thread(backend, "/api/end", {"session": self.session, "grund": "live-fehler"}, 60)
                    self.session = None
        r = await asyncio.to_thread(backend, "/api/start", {"nummer": self.nummer})
        if not r.get("ok"):
            log.error("[%s] start-Fehler: %s", self.nummer, r.get("fehler"))
            await self.senden(0x00)
            return
        self.session = r["session"]
        asyncio.create_task(self.spielen(r["audio_b64"]))
        aufgabe = None
        while self.offen:
            try:
                typ, daten = await asyncio.wait_for(self.lesen(), timeout=0.8)
            except asyncio.TimeoutError:
                typ, daten = None, b""
                # Keine RTP-Pakete (manche Gegenstellen senden in Pausen nichts):
                # Stille nachschieben, damit Vosk das Satzende erkennt
                if not self.spielt and (aufgabe is None or aufgabe.done()):
                    text = self.satzende()
                    if text:
                        self.letzte_sprache = time.monotonic()
                        aufgabe = asyncio.create_task(self.satz(text))
            if typ in (0x00, 0xff, -1):
                self.grund = "sip-aufgelegt" if typ != 0xff else "sip-fehler"
                break
            jetzt = time.monotonic()
            if jetzt - self.start > MAX_DAUER_S:
                self.grund = "sip-max-dauer"; await self.senden(0x00); break
            if not self.spielt and (aufgabe is None or aufgabe.done()) \
                    and jetzt - self.letzte_sprache > STILLE_ENDE_S:
                self.grund = "sip-stille"; await self.senden(0x00); break
            if typ == 0x10:
                self.pegel_summe += pegel(daten); self.pegel_n += 1
                if self.pegel_n >= 100:  # alle ~2 s Eingangspegel loggen (Diagnose)
                    log.info("[%s] Eingang avg %d (spielt=%s)", self.nummer, self.pegel_summe // self.pegel_n, self.spielt)
                    self.pegel_summe = self.pegel_n = 0
            if typ != 0x10 or self.spielt or (aufgabe and not aufgabe.done()):
                continue
            if self.rec.AcceptWaveform(hoch16k(daten)):
                text = json.loads(self.rec.Result()).get("text", "").strip()
                if text:
                    self.letzte_sprache = jetzt
                    aufgabe = asyncio.create_task(self.satz(text))
        self.offen = False
        if aufgabe and not aufgabe.done():
            aufgabe.cancel()

    def satzende(self):
        """Nach Paketpause: Stille einspeisen und ggf. den angefangenen Satz abschliessen."""
        if not json.loads(self.rec.PartialResult()).get("partial", "").strip():
            return ""
        if self.rec.AcceptWaveform(b"\0" * STT_RATE):  # 0,5 s Stille @16 kHz
            return json.loads(self.rec.Result()).get("text", "").strip()
        return json.loads(self.rec.FinalResult()).get("text", "").strip()

    async def lesen(self):
        try:
            kopf = await self.r.readexactly(3)
        except (asyncio.IncompleteReadError, ConnectionError):
            return -1, b""
        typ, laenge = struct.unpack(">BH", kopf)
        daten = await self.r.readexactly(laenge) if laenge else b""
        return typ, daten

    async def ende(self):
        if self.session:
            r = await asyncio.to_thread(backend, "/api/end",
                                        {"session": self.session, "grund": self.grund}, 120)
            log.info("[%s] Ende (%s): %s", self.nummer, self.grund, (r.get("zusammenfassung") or "")[:120])


async def main():
    os.makedirs(ANRUFER_DIR, exist_ok=True)
    try:  # Asterisk (User asterisk) legt hier die Anrufernummer je UUID ab
        import shutil
        shutil.chown(ANRUFER_DIR, "asterisk", "asterisk")
    except Exception as e:
        log.warning("chown %s: %s", ANRUFER_DIR, e)
    modell = Model(MODELL)
    log.info("Vosk-Modell geladen: %s", MODELL)

    async def verbindung(reader, writer):
        a = Anruf(reader, writer, modell)
        try:
            await a.lauf()
        except Exception as e:  # ein Anruf darf den Dienst nie umwerfen
            log.exception("Anruf-Fehler: %s", e)
            a.grund = "sip-fehler"
        finally:
            a.offen = False
            try:
                writer.close()
            except Exception:
                pass
            await a.ende()

    srv = await asyncio.start_server(verbindung, HOST, PORT)
    log.info("AudioSocket-Bruecke lauscht auf %s:%d", HOST, PORT)
    async with srv:
        await srv.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
