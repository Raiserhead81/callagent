package de.gemivo.callagent;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

/**
 * Anleitungstexte (eine Quelle mit der Web-Anleitung): zuerst Cache-Datei (zuletzt vom Server geladen),
 * sonst die mitgelieferte Offline-Kopie assets/anleitung.json. aktualisieren() holt GET /api/anleitung.
 */
public class Anleitung {
    private static JSONObject daten;

    public static synchronized JSONObject laden(Context c) {
        if (daten != null) return daten;
        try {
            File f = cache(c);
            if (f.exists()) daten = new JSONObject(lese(new java.io.FileInputStream(f)));
        } catch (Exception ignored) {}
        if (daten == null) {
            try { daten = new JSONObject(lese(c.getAssets().open("anleitung.json"))); } catch (Exception e) { daten = new JSONObject(); }
        }
        return daten;
    }

    public static void aktualisieren(Context c, Runnable fertig) {
        Api.get(c, "/api/anleitung", j -> {
            if (j.optJSONArray("schritte") != null && j.optJSONArray("schritte").length() > 0) {
                try (FileOutputStream o = new FileOutputStream(cache(c))) {
                    j.remove("_status");
                    o.write(j.toString().getBytes("UTF-8"));
                    synchronized (Anleitung.class) { daten = j; }
                } catch (Exception ignored) {}
            }
            if (fertig != null) fertig.run();
        });
    }

    public static JSONObject schritt(Context c, String id) {
        JSONArray a = laden(c).optJSONArray("schritte");
        if (a != null) for (int i = 0; i < a.length(); i++) if (id.equals(a.optJSONObject(i).optString("id"))) return a.optJSONObject(i);
        return new JSONObject();
    }

    /** Hinweise "Gut zu wissen" (alle oder nur die zu einem Schritt). */
    public static java.util.List<JSONObject> hinweise(Context c, String schritt) {
        java.util.List<JSONObject> l = new java.util.ArrayList<>();
        JSONArray a = laden(c).optJSONArray("hinweise");
        if (a != null) for (int i = 0; i < a.length(); i++) {
            JSONObject h = a.optJSONObject(i);
            if (schritt == null) { l.add(h); continue; }
            JSONArray s = h.optJSONArray("schritte");
            if (s != null) for (int k = 0; k < s.length(); k++) if (schritt.equals(s.optString(k))) { l.add(h); break; }
        }
        return l;
    }

    private static File cache(Context c) { return new File(c.getFilesDir(), "anleitung.json"); }
    private static String lese(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] p = new byte[8192]; int n;
        while ((n = in.read(p)) > 0) b.write(p, 0, n);
        in.close();
        return b.toString("UTF-8");
    }

    /** **fett**, *kursiv*, `code` -> Spannable (code zuerst, darin keine weitere Auszeichnung). */
    public static CharSequence formatiert(String t) {
        android.text.SpannableStringBuilder sb = new android.text.SpannableStringBuilder();
        String[] teile = t.split("`", -1);
        for (int i = 0; i < teile.length; i++) {
            int start = sb.length();
            if (i % 2 == 1) {
                sb.append(teile[i]);
                sb.setSpan(new android.text.style.TypefaceSpan("monospace"), start, sb.length(), 0);
                sb.setSpan(new android.text.style.StyleSpan(android.graphics.Typeface.BOLD), start, sb.length(), 0);
            } else {
                String s = teile[i];
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\*\\*(.+?)\\*\\*|(?<![*])\\*([^*\\s][^*]*?)\\*(?![*])").matcher(s);
                int pos = 0;
                while (m.find()) {
                    sb.append(s, pos, m.start());
                    int a = sb.length();
                    boolean fett = m.group(1) != null;
                    sb.append(fett ? m.group(1) : m.group(2));
                    sb.setSpan(new android.text.style.StyleSpan(fett ? android.graphics.Typeface.BOLD : android.graphics.Typeface.ITALIC), a, sb.length(), 0);
                    pos = m.end();
                }
                sb.append(s.substring(pos));
            }
        }
        return sb;
    }
}
