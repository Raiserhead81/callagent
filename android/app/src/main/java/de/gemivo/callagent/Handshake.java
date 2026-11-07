package de.gemivo.callagent;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Handshake-Test: Handy -> Server -> Gemma-Stimme ueber Lautsprecher. */
public class Handshake {

    public static void teste(final Context ctx) {
        new Thread(() -> {
            String fehler = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(
                        Konfig.baseUrl() + "/api/start").openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(10000);
                c.setReadTimeout(60000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setRequestProperty("X-App-Token", Konfig.token(ctx));
                byte[] body = "{\"nummer\":\"handshake-test\"}".getBytes(StandardCharsets.UTF_8);
                c.getOutputStream().write(body);
                int code = c.getResponseCode();
                InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                byte[] alle = alleBytes(in);
                c.disconnect();
                JSONObject j = new JSONObject(new String(alle, StandardCharsets.UTF_8));
                if (!j.optBoolean("ok", false)) fehler = "Server: " + j.optString("fehler", "HTTP " + code);
                else {
                    byte[] wav = Base64.decode(j.getString("audio_b64"), Base64.NO_WRAP);
                    // WAV-Header weg, PCM abspielen (24 kHz mono 16 bit)
                    byte[] kopf = new byte[44];
                    System.arraycopy(wav, 0, kopf, 0, 44);
                    byte[] pcm = new byte[wav.length - 44];
                    System.arraycopy(wav, 44, pcm, 0, pcm.length);
                    int rate = (kopf[24] & 0xFF) | ((kopf[25] & 0xFF) << 8)
                            | ((kopf[26] & 0xFF) << 16) | ((kopf[27] & 0xFF) << 24);
                    AudioTrack t = new AudioTrack.Builder()
                            .setAudioAttributes(new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_MEDIA)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .build())
                            .setAudioFormat(new AudioFormat.Builder()
                                    .setSampleRate(rate)
                                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                    .build())
                            .setTransferMode(AudioTrack.MODE_STATIC)
                            .setBufferSizeInBytes(pcm.length)
                            .build();
                    t.write(pcm, 0, pcm.length);
                    t.play();
                    final String text = j.optString("begruessung_text", "");
                    android.os.Handler h = new android.os.Handler(ctx.getMainLooper());
                    h.post(() -> Toast.makeText(ctx,
                            "Handshake OK ✅ " + code + " | " + text.substring(0,
                                    Math.min(40, text.length())), Toast.LENGTH_LONG).show());
                    Thread.sleep(Math.max(2000, pcm.length * 1000L / (rate * 2)) + 1500);
                    t.release();
                }
            } catch (final Exception e) {
                fehler = e.getMessage();
            }
            if (fehler != null) {
                final String f = fehler;
                new android.os.Handler(ctx.getMainLooper()).post(() ->
                        Toast.makeText(ctx, "Handshake FEHLER: " + f, Toast.LENGTH_LONG).show());
            }
        }, "handshake").start();
    }

    private static byte[] alleBytes(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) out.write(b, 0, n);
        return out.toByteArray();
    }
}
