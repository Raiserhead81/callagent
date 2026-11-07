package de.gemivo.callagent;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Web-API anruf.gemivo.de (Multi-Tenant): Geraete-Token als Bearer, JSON rein/raus, Antwort im UI-Thread. */
public class Api {
    public static final String BASIS = "https://anruf.gemivo.de";
    private static final ExecutorService POOL = Executors.newFixedThreadPool(3);
    private static final Handler UI = new Handler(Looper.getMainLooper());

    public interface Antwort { void fertig(JSONObject j); }

    public static void get(Context c, String pfad, Antwort a) { ruf(c, "GET", pfad, null, a); }
    public static void post(Context c, String pfad, JSONObject b, Antwort a) { ruf(c, "POST", pfad, b, a); }
    public static void put(Context c, String pfad, JSONObject b, Antwort a) { ruf(c, "PUT", pfad, b, a); }

    public static void ruf(Context ctx, String methode, String pfad, JSONObject body, Antwort a) {
        final Context app = ctx.getApplicationContext();
        POOL.execute(() -> {
            JSONObject j;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(BASIS + pfad).openConnection();
                c.setRequestMethod(methode);
                c.setConnectTimeout(10000); c.setReadTimeout(30000);
                String tok = Konfig.geraeteToken(app);
                if (!tok.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + tok);
                c.setRequestProperty("Accept", "application/json");
                if (body != null) {
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    try (OutputStream o = c.getOutputStream()) { o.write(body.toString().getBytes("UTF-8")); }
                }
                int code = c.getResponseCode();
                InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                String txt = lese(in);
                try { j = new JSONObject(txt); } catch (Exception e) { j = new JSONObject().put("ok", false).put("fehler", "Server " + code); }
                j.put("_status", code);
            } catch (Exception e) {
                j = new JSONObject();
                try { j.put("ok", false).put("fehler", "Keine Verbindung: " + e.getMessage()).put("_status", 0); } catch (Exception ignored) {}
            }
            final JSONObject erg = j;
            UI.post(() -> a.fertig(erg));
        });
    }
    private static String lese(InputStream in) throws Exception {
        if (in == null) return "";
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] p = new byte[8192]; int n;
        while ((n = in.read(p)) > 0) b.write(p, 0, n);
        return b.toString("UTF-8");
    }
    public static String fehler(JSONObject j) {
        Object f = j.opt("fehler");
        if (f instanceof org.json.JSONArray) {
            org.json.JSONArray a = (org.json.JSONArray) f; StringBuilder s = new StringBuilder();
            for (int i = 0; i < a.length(); i++) s.append(i > 0 ? "\n" : "").append(a.optString(i));
            return s.toString();
        }
        return f == null ? "Unbekannter Fehler" : String.valueOf(f);
    }
}
