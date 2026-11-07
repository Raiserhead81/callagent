package de.gemivo.callagent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.os.IBinder;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;

import java.io.DataInputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Der KI-Anruf-Loop:
 * 1. /api/start -> Begruessung (Kore) in den Anruf spielen
 * 2. VOICE_DOWNLINK aufnehmen -> Vosk STT (offline)
 * 3. Satz fertig -> /api/turn -> Antwort-WAV in den Anruf spielen
 * 4. Anruf weg -> /api/end (Protokoll + Zusammenfassung serverseitig)
 */
public class AudioLoop extends Service {

    private static final String TAG = "CallAgent";
    private static AudioLoop instanz;
    private String session;
    private String nummer;
    private Recognizer vosk;
    private AudioTrack uplink;
    private AudioManager audio;
    private boolean laeuft;
    private volatile boolean spielt; // Audio-Ausgabe aktiv -> STT pausieren
    private long letzteSprache;

    // ---------- Lebenszyklus ----------
    public static void start(Context ctx, String nummer) {
        Intent i = new Intent(ctx, AudioLoop.class);
        i.putExtra("nummer", nummer);
        ctx.startForegroundService(i);
    }
    public static void stop() {
        if (instanz != null) instanz.beenden("aufgelegt");
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instanz = this;
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel("ki") == null)
            nm.createNotificationChannel(new NotificationChannel("ki",
                    "KI-Anruf", NotificationManager.IMPORTANCE_LOW));
        startForeground(1, new Notification.Builder(this, "ki")
                .setContentTitle("Gemma telefoniert")
                .setContentText("KI-Anruf läuft")
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .build());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        nummer = intent != null ? intent.getStringExtra("nummer") : "?";
        if (!laeuft) {
            laeuft = true;
            new Thread(this::anrufStarten, "ki-audio").start();
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent i) { return null; }

    // ---------- 1. Start: Begruessung holen + spielen, dann zuhoeren ----------
    private void anrufStarten() {
        try {
            Log.i(TAG, "KI-Anruf start nummer=" + nummer + " mode=" + audio.getMode());
            JSONObject r = serverPost("/api/start",
                    "{\"nummer\":" + jsonStr(nummer) + "}");
            session = r.getString("session");
            String wavB64 = r.getString("audio_b64");
            spieleWav(Base64.decode(wavB64, Base64.NO_WRAP));
        } catch (Exception e) {
            Log.e(TAG, "start: " + e.getMessage());
            beenden("start-fehlgeschlagen");
            return;
        }
        zuhoeren();
    }

    // ---------- 2. Zuhoeren: Downlink -> Vosk (synchroner Recognizer) ----------
    private static final int[] QUELLEN = {
            MediaRecorder.AudioSource.VOICE_DOWNLINK,   // nur System-Apps, bei uns i.d.R. Fehler/Stille
            MediaRecorder.AudioSource.MIC,              // Lautsprecher-Weg: Anrufer kommt aus dem Speaker
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.VOICE_COMMUNICATION
    };

    private void zuhoeren() {
        try {
            File modell = Konfig.modellOrdner(this);
            if (!Konfig.modellDa(this)) { Log.e(TAG, "Kein Vosk-Modell!"); beenden("kein-modell"); return; }
            Model m = new Model(modell.getAbsolutePath());
            vosk = new Recognizer(m, 16000.0f);
            int groesse = AudioRecord.getMinBufferSize(16000,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            for (int qi = 0; qi < QUELLEN.length && laeuft; qi++) {
                Log.i(TAG, "Audio-Quelle Test #" + qi);
                AudioRecord rec;
                try {
                    rec = new AudioRecord(QUELLEN[qi], 16000, AudioFormat.CHANNEL_IN_MONO,
                            AudioFormat.ENCODING_PCM_16BIT, Math.max(groesse, 32000));
                    if (rec.getState() != AudioRecord.STATE_INITIALIZED) {
                        Log.i(TAG, "Audio-Quelle #" + qi + " nicht verfuegbar");
                        rec.release(); continue;
                    }
                    rec.startRecording();
                    if (rec.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                        Log.i(TAG, "Audio-Quelle #" + qi + " startet nicht");
                        rec.release(); continue;
                    }
                } catch (Exception e) { Log.i(TAG, "Audio-Quelle #" + qi + ": " + e); continue; }
                byte[] puffer = new byte[3200];
                long summe = 0; int reads = 0; boolean aktiv = false;
                long start = System.currentTimeMillis();
                while (laeuft) {
                    int n = rec.read(puffer, 0, puffer.length);
                    if (n <= 0 || spielt) continue;
                    for (int i = 0; i + 1 < n && reads < 60; i += 20) {
                        int w = (short) ((puffer[i] & 0xFF) | (puffer[i + 1] << 8));
                        summe += Math.abs(w); reads++;
                    }
                    if (!aktiv && System.currentTimeMillis() - start > 3000) {
                        // Vom System stummgeschaltete Aufnahme liefert exakt 0, echtes Mikro nie
                        if (reads > 0 && summe > 0) {
                            aktiv = true;
                            Log.i(TAG, "Audio-Quelle #" + qi + " aktiv (avg " + summe / reads + ")");
                            letzteSprache = System.currentTimeMillis();
                        } else {
                            Log.i(TAG, "Audio-Quelle #" + qi + " stille (avg "
                                    + (reads > 0 ? summe / reads : 0) + "), naechste");
                            break;
                        }
                    }
                    if (aktiv && System.currentTimeMillis() - letzteSprache > 60000) {
                        Log.i(TAG, "60s nichts verstanden -> Ende");
                        beenden("stille"); break;
                    }
                    if (aktiv && vosk.acceptWaveForm(puffer, n)) {
                        String ergebnis = vosk.getResult();
                        JSONObject j = new JSONObject(ergebnis);
                        String text = j.optString("text", "").trim();
                        if (!text.isEmpty()) { letzteSprache = System.currentTimeMillis(); verarbeiteText(text); }
                    }
                }
                rec.stop(); rec.release();
                if (aktiv) return; // diese Quelle traegt Audio
            }
            m.close();
            if (laeuft) { Log.e(TAG, "Keine Audio-Quelle liefert Ton (Aufnahme im Anruf gesperrt?)"); beenden("kein-audio"); }
        } catch (Exception e) {
            Log.e(TAG, "zuhoeren: " + e);
            beenden("fehler-zuhoeren");
        }
    }

    // ---------- 3. Satz des Anrufers -> Server -> Antwort spielen ----------
    private void verarbeiteText(final String text) {
        if (!laeuft) return;
        Log.i(TAG, "Anrufer: " + text);
        new Thread(() -> {
            try {
                JSONObject r = serverPost("/api/turn",
                        "{\"session\":" + jsonStr(session) + ",\"text\":" + jsonStr(text) + "}");
                String wavB64 = r.getString("audio_b64");
                spieleWav(Base64.decode(wavB64, Base64.NO_WRAP));
                if (r.optBoolean("ende", false)) { Thread.sleep(2500); beenden("ki-beendet"); }
            } catch (Exception e) {
                Log.e(TAG, "turn: " + e.getMessage());
            }
        }, "ki-turn").start();
    }

    // ---------- WAV in den Anruf spielen (Uplink) ----------
    private void spieleWav(byte[] wav) {
        try {
            spielt = true;
            // WAV-Header (44 Bytes Standard) ueberspringen, PCM 24 kHz mono 16 bit
            DataInputStream din = new DataInputStream(
                    new java.io.ByteArrayInputStream(wav));
            byte[] kopf = new byte[44];
            din.readFully(kopf);
            byte[] pcm = new byte[wav.length - 44];
            din.readFully(pcm);
            int rate = ((kopf[24] & 0xFF) | ((kopf[25] & 0xFF) << 8)
                    | ((kopf[26] & 0xFF) << 16) | ((kopf[27] & 0xFF) << 24));

            if (uplink == null) {
                uplink = new AudioTrack.Builder()
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build())
                        .setAudioFormat(new AudioFormat.Builder()
                                .setSampleRate(rate)
                                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                .build())
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .setBufferSizeInBytes(AudioTrack.getMinBufferSize(rate,
                                AudioFormat.CHANNEL_OUT_MONO,
                                AudioFormat.ENCODING_PCM_16BIT) * 4)
                        .build();
            }
            uplink.play();
            uplink.write(pcm, 0, pcm.length);
            int frames = pcm.length / 2;
            long bis = System.currentTimeMillis() + frames * 1000L / rate + 3000;
            while (uplink.getPlaybackHeadPosition() < frames && System.currentTimeMillis() < bis)
                Thread.sleep(50);
            uplink.stop();
            uplink.flush();
            Thread.sleep(300); // Nachhall
            Log.i(TAG, "gespielt " + (frames * 1000L / rate) + " ms");
        } catch (Exception e) {
            Log.e(TAG, "spielen: " + e);
        } finally {
            letzteSprache = System.currentTimeMillis();
            spielt = false;
        }
    }

    // ---------- HTTP zum Server ----------
    private JSONObject serverPost(String pfad, String bodyJson) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(
                Konfig.baseUrl() + pfad).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("X-App-Token", Konfig.token(this));
        byte[] body = bodyJson.getBytes(StandardCharsets.UTF_8);
        c.getOutputStream().write(body);
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        byte[] alle = alleBytes(in);
        c.disconnect();
        JSONObject j = new JSONObject(new String(alle, StandardCharsets.UTF_8));
        if (!j.optBoolean("ok", false))
            throw new Exception("Server: " + j.optString("fehler", "HTTP " + code));
        return j;
    }

    private static byte[] alleBytes(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) out.write(b, 0, n);
        return out.toByteArray();
    }

    private static String jsonStr(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    // ---------- Ende ----------
    private void beenden(String grund) {
        if (!laeuft) return;
        laeuft = false;
        final String sid = session;
        new Thread(() -> {
            try {
                if (sid != null) serverPost("/api/end",
                        "{\"session\":" + jsonStr(sid) + ",\"grund\":" + jsonStr(grund) + "}");
            } catch (Exception e) { /* Protokoll trotzdem serverseitig vorhanden */ }
        }, "ki-end").start();
        try { if (uplink != null) uplink.release(); } catch (Exception e) {}
        Log.i(TAG, "KI-Ende: " + grund);
        if (!"aufgelegt".equals(grund)) InCall.kiAuflegen();
        stopSelf();
        instanz = null;
    }
}
