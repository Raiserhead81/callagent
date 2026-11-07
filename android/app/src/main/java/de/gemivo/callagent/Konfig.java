package de.gemivo.callagent;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;

/** App-Konfiguration: Token, Schalter, Modell-Pfad. */
public class Konfig {
    private static final String PREFS = "callagent";

    // App-Token: wird beim ersten Start eingegeben (liegt auf gemivo)
    public static String token(Context c) {
        return prefs(c).getString("token", "");
    }
    public static void setzeToken(Context c, String t) {
        prefs(c).edit().putString("token", t).apply();
    }

    public static boolean kiAktiv(Context c) {
        return prefs(c).getBoolean("ki_aktiv", true);
    }
    public static void setzeKiAktiv(Context c, boolean on) {
        prefs(c).edit().putBoolean("ki_aktiv", on).apply();
    }

    public static String lade(Context c) { return token(c); }

    public static File modellOrdner(Context c) {
        return new File(c.getFilesDir(), "vosk-modell");
    }
    public static boolean modellDa(Context c) {
        File f = new File(modellOrdner(c), "am/final.mdl");
        return f.exists();
    }
    public static String baseUrl() { return "https://callagent.gemivo.de"; }
    public static String modellUrl() { return baseUrl() + "/modell/vosk-modell-small-de.zip"; }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
