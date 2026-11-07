package de.gemivo.callagent;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.role.RoleManager;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.RatingBar;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Gemma Anrufassistent 2.1: gefuehrter Einrichtungsassistent (ein Schritt pro Bildschirm, Fortschritt,
 * Zurueck/Weiter erst wenn erledigt), Anleitung mit Skizzen/Bildern IN der App (Texte aus /api/anleitung,
 * Offline-Kopie assets/anleitung.json), automatische Pruefung je Schritt mit "Was tun?".
 * Die Anruf-Logik (CallScreening: unbekannte Nummern ablehnen -> Umleitung bei besetzt) ist unveraendert.
 */
public class MainActivity extends Activity {

    static final String[] IDS = {"konto", "gemini", "anschluss", "name", "benachrichtigung", "rechte", "umleitung", "test"};
    static final int FERTIG = IDS.length;

    // Farben (hell/dunkel)
    private int cBg, cFl, cFl2, cTx, cTx2, cRand, cAk, cAkTx, cOk, cFehl;

    private TextView kopfText;
    private ProgressBar balken;
    private LinearLayout kopf, inhalt, unten;
    private ScrollView scroll;
    private Button zurueck, weiter, ueberspringen;
    private TextView pruefung;

    private JSONObject me;
    private final Map<String, Boolean> status = new HashMap<>();
    private int idx = -1;              // -1 = Uebersicht, 0..7 Schritt, 8 = Fertig
    private boolean wartetAufKey = false, frageNachUmleitung = false;
    private EditText keyFeld;
    private final Handler h = new Handler(Looper.getMainLooper());
    private Runnable testPoll;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        farben();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(cBg);

        kopf = new LinearLayout(this);
        kopf.setOrientation(LinearLayout.VERTICAL);
        kopf.setPadding(dp(16), dp(10), dp(16), dp(6));
        kopfText = text("", 14, true);
        kopfText.setTextColor(cTx2);
        boolean randlos = getApplicationInfo().targetSdkVersion >= 35;
        if (randlos && getActionBar() != null) getActionBar().hide();   // randlos: eigene Kopfzeile statt ueberlappender ActionBar
        if (randlos) {
            LinearLayout zeile = new LinearLayout(this); zeile.setOrientation(LinearLayout.HORIZONTAL); zeile.setGravity(Gravity.CENTER_VERTICAL);
            zeile.addView(kopfText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            Button menue = new Button(this); menue.setText("⋮"); menue.setTextSize(22); menue.setContentDescription("Menü");
            menue.setBackgroundColor(Color.TRANSPARENT); menue.setTextColor(cTx); menue.setOnClickListener(v -> openOptionsMenu());
            zeile.addView(menue, new LinearLayout.LayoutParams(dp(52), dp(52)));
            kopf.addView(zeile);
        } else kopf.addView(kopfText);
        balken = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        balken.setMax(IDS.length);
        balken.setProgressTintList(android.content.res.ColorStateList.valueOf(cAk));
        kopf.addView(balken, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(10)));
        root.addView(kopf);

        scroll = new ScrollView(this);
        inhalt = new LinearLayout(this);
        inhalt.setOrientation(LinearLayout.VERTICAL);
        inhalt.setPadding(dp(16), dp(8), dp(16), dp(24));
        scroll.addView(inhalt);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        unten = new LinearLayout(this);
        unten.setOrientation(LinearLayout.HORIZONTAL);
        unten.setPadding(dp(12), dp(8), dp(12), dp(10));
        unten.setBackgroundColor(cFl);
        zurueck = knopf("Zurück", v -> zeige(idx - 1), false);
        ueberspringen = knopf("Überspringen", v -> { funnel(IDS[idx], "uebersprungen"); zeige(idx + 1); }, false);
        weiter = knopf("Weiter", v -> { funnel(IDS[idx], "erledigt"); zeige(idx + 1); }, true);
        for (Button bb : new Button[]{zurueck, ueberspringen, weiter}) { bb.setTextSize(14); bb.setSingleLine(false); bb.setMaxLines(2); }
        unten.addView(zurueck, gewicht());
        unten.addView(ueberspringen, gewicht());
        unten.addView(weiter, gewicht());
        root.addView(unten);
        setContentView(root);
        // Ab targetSdk 35 zeichnet Android randlos (ActionBar ausgeblendet, s. o.): Abstand fuer System-Leisten selbst setzen
        root.setOnApplyWindowInsetsListener((v, ins) -> {
            if (Build.VERSION.SDK_INT >= 30 && getApplicationInfo().targetSdkVersion >= 35) {
                android.graphics.Insets s = ins.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.ime());
                v.setPadding(s.left, s.top, s.right, s.bottom);
            }
            return ins;
        });

        pruefeTestanruf(getIntent());
        boolean kopplung = kopplungAusIntent(getIntent());
        if (!Konfig.flag(this, "assistent_fertig")) idx = kopplung ? 0 : Math.max(0, Konfig.zahl(this, "assistent_idx"));
        Anleitung.aktualisieren(this, () -> { if (idx >= 0 && idx < FERTIG) zeige(idx); });
        zeige(idx);
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); if (kopplungAusIntent(i) && idx < 0) zeige(0); pruefeTestanruf(i); }
    @Override protected void onResume() { super.onResume(); aktualisiere(); }
    @Override protected void onPause() { super.onPause(); if (testPoll != null) h.removeCallbacks(testPoll); }
    @Override protected void onStop() {
        super.onStop();
        if (idx >= 0 && idx < FERTIG && !ok(IDS[idx])) funnel(IDS[idx], "abgebrochen");
    }

    // ---------------- Menue ----------------
    @Override public boolean onCreateOptionsMenu(Menu m) {
        m.add(0, 1, 0, "Übersicht"); m.add(0, 2, 0, "Einrichtung neu starten"); m.add(0, 3, 0, "Feedback geben");
        m.add(0, 4, 0, "Dashboard (Anrufe)"); m.add(0, 5, 0, "Anleitung im Web");
        return true;
    }
    @Override public boolean onOptionsItemSelected(MenuItem it) {
        switch (it.getItemId()) {
            case 1: zeige(-1); return true;
            case 2: Konfig.setzeFlag(this, "assistent_fertig", false); zeige(0); return true;
            case 3: feedback(); return true;
            case 4: web("/app"); return true;
            case 5: web("/anleitung"); return true;
        }
        return super.onOptionsItemSelected(it);
    }

    /** E2E-Test (alt): am start ... --es testanruf <nummer> */
    private void pruefeTestanruf(Intent i) {
        String nr = i == null ? null : i.getStringExtra("testanruf");
        if (nr == null || nr.isEmpty()) return;
        i.removeExtra("testanruf");
        TestVerbindung.anrufSimulieren(this, nr);
    }

    // ---------------- Status ----------------
    private boolean ok(String id) { return Boolean.TRUE.equals(status.get(id)); }

    private void aktualisiere() {
        status.put("rechte", rolleGehalten() && kontakteOk() && akkuOk());
        status.put("umleitung", Konfig.flag(this, "umleitung_ok"));
        if (Konfig.geraeteToken(this).isEmpty()) { me = null; status.put("konto", false); neuZeichnen(); return; }
        Api.get(this, "/api/me", j -> {
            if (j.optBoolean("ok")) {
                me = j;
                JSONObject s = j.optJSONObject("schritte");
                for (String id : IDS) if (!id.equals("rechte") && !id.equals("umleitung")) status.put(id, s != null && s.optBoolean(id));
                status.put("konto", true);
                for (String k : new String[]{"rechte", "umleitung"}) if (ok(k) && !Konfig.flag(this, "gemeldet_" + k)) { Konfig.setzeFlag(this, "gemeldet_" + k, true); funnel(k, "erledigt"); }
            } else if (j.optInt("_status") == 401) {
                Konfig.setzeGeraeteToken(this, ""); me = null; status.put("konto", false);
            }
            neuZeichnen();
        });
    }
    /** Nur Status-Teile neu (Eingaben bleiben erhalten); Uebersicht/Fertig komplett. */
    private void neuZeichnen() {
        if (idx < 0 || idx == FERTIG) { zeige(idx); return; }
        aktualisiereKnoepfe();
        if (aktionRefresh != null) aktionRefresh.run();
    }

    // ---------------- Bildschirme ----------------
    private Runnable aktionRefresh;

    private void zeige(int i) {
        if (testPoll != null) h.removeCallbacks(testPoll);
        aktionRefresh = null; keyFeld = null;
        idx = Math.max(-1, Math.min(FERTIG, i));
        if (idx >= 0 && idx < FERTIG) Konfig.setzeZahl(this, "assistent_idx", idx);
        inhalt.removeAllViews();
        scroll.scrollTo(0, 0);
        if (idx < 0) { uebersicht(); return; }
        if (idx == FERTIG) { fertig(); return; }
        String id = IDS[idx];
        funnel(id, "gesehen");
        JSONObject st = Anleitung.schritt(this, id);
        kopf.setVisibility(View.VISIBLE); unten.setVisibility(View.VISIBLE); balken.setVisibility(View.VISIBLE);
        kopfText.setText("Schritt " + (idx + 1) + " von " + IDS.length + " · " + st.optString("kurz", id));
        balken.setProgress(idx + 1);
        TextView t = text(st.optString("titel", id), 24, true);
        inhalt.addView(t);
        TextView ziel = text(st.optString("ziel"), 16, false); ziel.setTextColor(cTx2);
        inhalt.addView(ziel);

        // Anleitung: nummerierte Unterschritte mit Skizzen/Bildern
        JSONArray us = st.optJSONArray("unterschritte");
        if (us != null) for (int k = 0; k < us.length(); k++) unterschritt(k + 1, us.optJSONObject(k));

        // Gut zu wissen (was passieren kann) zu diesem Schritt
        java.util.List<JSONObject> hw = Anleitung.hinweise(this, id);
        if (!hw.isEmpty()) inhalt.addView(hinweisKarte(hw, "Gut zu wissen"));

        // Aktion
        LinearLayout box = karte();
        box.addView(text("Jetzt du", 13, true));
        inhalt.addView(box);
        switch (id) {
            case "konto": aktionKonto(box); break;
            case "gemini": aktionGemini(box); break;
            case "anschluss": aktionAnschluss(box); break;
            case "name": aktionName(box); break;
            case "benachrichtigung": aktionMelden(box); break;
            case "rechte": aktionRechte(box); break;
            case "umleitung": aktionUmleitung(box); break;
            case "test": aktionTest(box); break;
        }
        // Pruefung
        pruefung = text("", 16, true);
        pruefung.setPadding(dp(12), dp(10), dp(12), dp(10));
        inhalt.addView(pruefung);
        aktualisiereKnoepfe();
        if (id.equals("test")) starteTestPoll();
    }

    private void unterschritt(int nr, JSONObject u) {
        LinearLayout z = new LinearLayout(this);
        z.setOrientation(LinearLayout.HORIZONTAL);
        z.setPadding(0, dp(10), 0, dp(2));
        TextView n = text(String.valueOf(nr), 15, true);
        n.setGravity(Gravity.CENTER); n.setTextColor(cAk);
        GradientDrawable kreis = new GradientDrawable(); kreis.setShape(GradientDrawable.OVAL); kreis.setColor(cFl2);
        n.setBackground(kreis);
        z.addView(n, new LinearLayout.LayoutParams(dp(30), dp(30)));
        LinearLayout rechts = new LinearLayout(this); rechts.setOrientation(LinearLayout.VERTICAL); rechts.setPadding(dp(10), 0, 0, 0);
        TextView t = text("", 16, false); t.setText(Anleitung.formatiert(u.optString("text")));
        rechts.addView(t);
        JSONObject sk = u.optJSONObject("skizze");
        if (sk != null) rechts.addView(skizze(sk));
        String bild = u.optString("bild", "");
        if (!bild.isEmpty()) {
            try {
                Bitmap bm = BitmapFactory.decodeStream(getAssets().open("anleitung/" + bild + ".png"));
                ImageView iv = new ImageView(this); iv.setImageBitmap(bm); iv.setAdjustViewBounds(true);
                iv.setContentDescription(u.optString("bildText"));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.topMargin = dp(6);
                iv.setMaxHeight(dp(360)); iv.setScaleType(ImageView.ScaleType.FIT_START);
                rechts.addView(iv, lp);
                TextView cap = text(u.optString("bildText"), 12, false); cap.setTextColor(cTx2); rechts.addView(cap);
            } catch (Exception ignored) {}
        }
        z.addView(rechts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        inhalt.addView(z);
    }

    /** Neutrale Skizze eines Menues (wie die Web-Anleitung). */
    private View skizze(JSONObject sk) {
        LinearLayout k = new LinearLayout(this); k.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable(); bg.setCornerRadius(dp(10)); bg.setStroke(dp(1), cRand); bg.setColor(cFl);
        k.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(8), 0, dp(4)); k.setLayoutParams(lp);
        TextView titel = text(sk.optString("titel"), 14, true); titel.setPadding(dp(10), dp(8), dp(10), dp(8)); titel.setBackgroundColor(cFl2);
        k.addView(titel);
        JSONArray pfad = sk.optJSONArray("pfad");
        if (pfad != null) {
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < pfad.length(); i++) s.append(i > 0 ? "  ›  " : "").append(pfad.optString(i));
            TextView p = text(s.toString(), 13, false); p.setTextColor(cTx2); p.setPadding(dp(10), dp(6), dp(10), dp(6)); k.addView(p);
        }
        JSONArray z = sk.optJSONArray("zeilen");
        if (z != null) for (int i = 0; i < z.length(); i++) {
            JSONArray r = z.optJSONArray(i);
            LinearLayout zl = new LinearLayout(this); zl.setOrientation(LinearLayout.VERTICAL); zl.setPadding(dp(10), dp(6), dp(10), dp(6));
            View linie = new View(this); linie.setBackgroundColor(cRand);
            k.addView(linie, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1));
            TextView a = text(r.optString(0), 14, false); a.setTextColor(cTx2); zl.addView(a);
            if (r.length() > 1 && !r.isNull(1)) { TextView w = text(r.optString(1), 14, true); w.setTypeface(Typeface.MONOSPACE, Typeface.BOLD); zl.addView(w); }
            k.addView(zl);
        }
        return k;
    }

    private void aktualisiereKnoepfe() {
        if (idx < 0 || idx >= FERTIG) return;
        String id = IDS[idx];
        boolean erledigt = ok(id);
        JSONObject st = Anleitung.schritt(this, id);
        zurueck.setEnabled(idx > 0); zurueck.setAlpha(idx > 0 ? 1f : .4f);
        ueberspringen.setVisibility(st.optBoolean("ueberspringbar") || id.equals("test") ? View.VISIBLE : View.GONE);
        weiter.setEnabled(erledigt); weiter.setAlpha(erledigt ? 1f : .4f);
        weiter.setText(idx == FERTIG - 1 ? "Fertig" : "Weiter");
        if (pruefung != null) {
            String fehler = erledigt ? "" : wasTun(id);
            pruefung.setText(erledigt ? "✓ Erledigt – tippe auf „Weiter“." : "○ Noch nicht erledigt" + (fehler.isEmpty() ? "" : "\n\nWas tun? " + fehler));
            pruefung.setTextColor(erledigt ? cOk : cFehl);
            GradientDrawable bg = new GradientDrawable(); bg.setCornerRadius(dp(10)); bg.setColor(cFl2);
            pruefung.setBackground(bg);
        }
    }

    /** Verstaendliche Hilfe passend zum aktuellen Fehlerbild (Texte aus der Anleitung). */
    private String wasTun(String id) {
        JSONObject hi = Anleitung.schritt(this, id).optJSONObject("hilfe");
        if (hi == null) hi = new JSONObject();
        switch (id) {
            case "konto": return me == null && !Konfig.geraeteToken(this).isEmpty() ? hi.optString("netz") : "";
            case "gemini": {
                if (me == null) return "";
                String f = me.optJSONObject("gemini").optString("fehler", "");
                if (f.isEmpty() || "null".equals(f)) return "";
                String k = geminiHilfeKey(f);
                return f + "\n" + hi.optString(k);
            }
            case "anschluss": return me == null ? "" : hi.optString(me.optJSONObject("sip").optString("status"), "");
            case "rechte": return !rolleGehalten() ? hi.optString("rolle") : !kontakteOk() ? hi.optString("kontakte") : !akkuOk() ? hi.optString("akku") : "";
            case "umleitung": return me != null && me.optJSONObject("umleitung").optString("ein").isEmpty() ? hi.optString("nummer") : "";
            case "test": return hi.optString("klingelt") + "\n" + hi.optString("besetzt") + "\n" + hi.optString("ansage");
            default: return "";
        }
    }

    static String geminiHilfeKey(String f) {
        return f.contains("ungültig") ? "ungueltig" : (f.contains("Guthaben") || f.contains("402")) ? "guthaben" : f.contains("Limit") ? "limit" : "netz";
    }

    // ---------------- Aktionen je Schritt ----------------
    private boolean nichtVerbunden(LinearLayout k) {
        if (me != null) return false;
        k.addView(text("Erst Schritt 1: mit gemivo verbinden.", 15, false));
        k.addView(knopf("Zu Schritt 1", v -> zeige(0), true));
        return true;
    }

    private void aktionKonto(LinearLayout k) {
        TextView info = text("", 15, false); k.addView(info);
        Button an = knopf("Im Browser anmelden", v -> web("/koppeln?app=1"), true);
        Button code = knopf("Code eingeben", v -> codeDialog(), false);
        Button trennen = knopf("Anderes Konto verbinden", v -> { Konfig.setzeGeraeteToken(this, ""); aktualisiere(); }, false);
        k.addView(an); k.addView(code); k.addView(trennen);
        aktionRefresh = () -> {
            boolean v = me != null;
            JSONObject n = v ? me.optJSONObject("nutzer") : null;
            info.setText(v ? "Verbunden als " + n.optString("email", "") : "Noch nicht verbunden.");
            an.setVisibility(v ? View.GONE : View.VISIBLE); code.setVisibility(v ? View.GONE : View.VISIBLE); trennen.setVisibility(v ? View.VISIBLE : View.GONE);
        };
        aktionRefresh.run();
    }

    private void codeDialog() {
        EditText e = eingabe("8-stelliger Code", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        new AlertDialog.Builder(this).setTitle("Kopplungscode").setMessage("Code von anruf.gemivo.de/koppeln").setView(e)
                .setPositiveButton("Verbinden", (d, w) -> koppeln(e.getText().toString())).setNegativeButton("Abbrechen", null).show();
    }

    private boolean kopplungAusIntent(Intent i) {
        Uri u = i == null ? null : i.getData();
        if (u == null || !"gemivoanruf".equals(u.getScheme())) return false;
        String code = u.getQueryParameter("code");
        if (code != null) koppeln(code);
        i.setData(null);
        return true;
    }

    private void koppeln(String code) {
        JSONObject b = new JSONObject();
        try { b.put("code", code.trim()).put("name", Build.MANUFACTURER + " " + Build.MODEL); } catch (Exception ignored) {}
        Api.post(this, "/api/app/koppeln", b, j -> {
            if (j.optBoolean("ok")) {
                Konfig.setzeGeraeteToken(this, j.optString("token"));
                toast("Verbunden ✓");
                funnel("konto", "erledigt");
                Konfig.setzeFlag(this, "assistent_fertig", false);
                Api.get(this, "/api/me", m -> { if (m.optBoolean("ok")) { me = m; status.put("konto", true); } zeige(1); aktualisiere(); });
            } else toast(Api.fehler(j));
        });
    }

    private void aktionGemini(LinearLayout k) {
        if (nichtVerbunden(k)) return;
        if (me.optJSONObject("nutzer").optBoolean("owner")) { k.addView(text("Owner-Anschluss: nutzt den gemivo-Schlüssel. Nichts zu tun.", 15, false)); return; }
        k.addView(knopf("Google AI Studio öffnen", v -> {
            wartetAufKey = true;
            toast("Schlüssel erstellen und kopieren, dann hierher zurückkommen.");
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://aistudio.google.com/apikey")));
        }, false));
        keyFeld = eingabe("Schlüssel einfügen (AIza… oder AQ.…)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        k.addView(keyFeld);
        Button test = knopf("Schlüssel testen", v -> keyTesten(keyFeld.getText().toString().trim()), true);
        k.addView(test);
        TextView st = text("", 15, true); k.addView(st);
        aktionRefresh = () -> {
            String s = me == null ? "fehlt" : me.optJSONObject("gemini").optString("status");
            st.setText("Status: " + ("ok".equals(s) ? "gültig ✓" : "fehlt".equals(s) ? "noch kein Schlüssel" : "Fehler"));
            st.setTextColor("ok".equals(s) ? cOk : cFehl);
        };
        aktionRefresh.run();
    }

    private void keyTesten(String key) {
        if (key.length() < 20) { toast("Bitte erst den Schlüssel einfügen."); return; }
        JSONObject b = new JSONObject();
        try { b.put("key", key); } catch (Exception ignored) {}
        toast("Teste echte Verbindung zum Live-Modell …");
        Api.post(this, "/api/gemini", b, j -> {
            JSONObject t = j.optJSONObject("test");
            if (!j.optBoolean("ok")) dialog("Bitte prüfen", Api.fehler(j));
            else if (t != null && t.optBoolean("ok")) { toast("Schlüssel funktioniert ✓"); funnel("gemini", "erledigt"); }
            else { String f = t == null ? "?" : t.optString("fehler"); dialog("Test fehlgeschlagen", f + "\n\nWas tun? " + Anleitung.schritt(this, "gemini").optJSONObject("hilfe").optString(geminiHilfeKey(f))); }
            aktualisiere();
        });
    }

    /** Zurueck aus AI Studio: Schluessel aus der Zwischenablage anbieten (geht erst mit Fensterfokus). */
    @Override public void onWindowFocusChanged(boolean fokus) {
        super.onWindowFocusChanged(fokus);
        if (!fokus || !wartetAufKey || idx != 1) return;
        wartetAufKey = false;
        try {
            ClipboardManager cm = getSystemService(ClipboardManager.class);
            CharSequence c = cm.hasPrimaryClip() ? cm.getPrimaryClip().getItemAt(0).coerceToText(this) : null;
            String s = c == null ? "" : c.toString().trim();
            if (s.matches("[A-Za-z0-9_.\\-]{30,200}")) {
                new AlertDialog.Builder(this).setTitle("Schlüssel gefunden")
                        .setMessage("In der Zwischenablage liegt ein Schlüssel (" + s.substring(0, 4) + "…" + s.substring(s.length() - 4) + "). Einfügen und testen?")
                        .setPositiveButton("Einfügen und testen", (d, w) -> { if (keyFeld != null) keyFeld.setText(s); keyTesten(s); })
                        .setNegativeButton("Nein", null).show();
            }
        } catch (Exception ignored) {}
    }

    private void aktionAnschluss(LinearLayout k) {
        if (nichtVerbunden(k)) return;
        JSONObject s = me.optJSONObject("sip");
        if (me.optJSONObject("nutzer").optBoolean("owner")) {
            TextView st = text("Owner-Anschluss (FritzBox über WireGuard), bleibt unverändert.\nStatus: " + regText(s.optString("status")), 15, false);
            k.addView(st); k.addView(knopf("Verbindungstest", v -> verbindungstest(), false));
            return;
        }
        RadioGroup rg = new RadioGroup(this);
        RadioButton fb = radio("FRITZ!Box"), an = radio("SIP-Anbieter");
        rg.addView(fb); rg.addView(an);
        rg.check("anbieter".equals(s.optString("modus")) ? an.getId() : fb.getId());
        k.addView(rg);
        EditText server = feld(k, "Registrar (MyFRITZ!-Adresse bzw. Server des Anbieters)", s.optString("server"), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        EditText user = feld(k, "Benutzername / SIP-ID", s.optString("user"), InputType.TYPE_CLASS_TEXT);
        EditText pass = feld(k, s.optBoolean("passGesetzt") ? "Kennwort (leer = unverändert)" : "Kennwort", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        EditText nummer = feld(k, "Rufnummer (Ziel der Umleitung), z. B. 0451 1234567", s.optString("nummer"), InputType.TYPE_CLASS_PHONE);
        EditText port = feld(k, "Port", String.valueOf(s.optInt("port", 5060)), InputType.TYPE_CLASS_NUMBER);
        k.addView(knopf("Speichern und verbinden", v -> {
            JSONObject b = new JSONObject();
            try {
                b.put("modus", rg.getCheckedRadioButtonId() == fb.getId() ? "fritzbox" : "anbieter").put("server", server.getText().toString().trim())
                        .put("user", user.getText().toString().trim()).put("pass", pass.getText().toString()).put("nummer", nummer.getText().toString())
                        .put("port", Integer.parseInt("0" + port.getText().toString().trim())).put("ipv", s.optString("ipv", "auto"));
            } catch (Exception ignored) {}
            toast("Speichere und melde Gemma an …");
            Api.post(this, "/api/sip", b, j -> {
                if (!j.optBoolean("ok")) { dialog("Bitte prüfen", Api.fehler(j)); return; }
                pass.setText("");
                if ("Registered".equals(j.optString("status"))) { toast("Angemeldet ✓"); funnel("anschluss", "erledigt"); aktualisiere(); }
                else verbindungstest();
            });
        }, true));
        k.addView(knopf("Verbindungstest", v -> verbindungstest(), false));
        TextView st = text("", 15, true); k.addView(st);
        aktionRefresh = () -> { String x = me == null ? "" : me.optJSONObject("sip").optString("status"); st.setText("Status: " + regText(x)); st.setTextColor("Registered".equals(x) ? cOk : cFehl); };
        aktionRefresh.run();
    }

    private void verbindungstest() {
        Api.get(this, "/api/sip/status", j -> {
            String st = j.optString("status");
            String hinweis = j.optString("hinweis");
            dialog("Verbindungstest", "Status: " + regText(st) + (hinweis.isEmpty() ? "" : "\n\nWas tun? " + hinweis));
            aktualisiere();
        });
    }

    private void aktionName(LinearLayout k) {
        if (nichtVerbunden(k)) return;
        if (me.optJSONObject("nutzer").optBoolean("owner")) { k.addView(text("Owner: feste Begrüßung „… die Assistentin von Kay“ (Aussprache Kai).", 15, false)); return; }
        JSONObject pr = me.optJSONObject("profil");
        EditText v = feld(k, "Vorname", pr.optString("vorname"), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        EditText a = feld(k, "Aussprache-Schreibweise (optional)", pr.optString("aussprache"), InputType.TYPE_CLASS_TEXT);
        TextView vorschau = text("", 15, false); vorschau.setTextColor(cTx2);
        Runnable vs = () -> vorschau.setText("Vorschau: „Schönen guten Tag, hier spricht Gemma, die digitale Assistentin von " + v.getText() + ". " + v.getText() + " ist gerade leider nicht erreichbar – kann ich etwas für Sie aufnehmen?“");
        vs.run();
        v.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a1, int b1, int c1) {}
            public void onTextChanged(CharSequence s, int a1, int b1, int c1) { vs.run(); }
            public void afterTextChanged(android.text.Editable s) {}
        });
        k.addView(vorschau);
        k.addView(knopf("Speichern", x -> {
            JSONObject b = new JSONObject();
            try { b.put("vorname", v.getText().toString().trim()).put("aussprache", a.getText().toString().trim()); } catch (Exception ignored) {}
            Api.put(this, "/api/profil", b, j -> { if (j.optBoolean("ok")) { toast("Gespeichert ✓"); funnel("name", "erledigt"); } else dialog("Bitte prüfen", Api.fehler(j)); aktualisiere(); });
        }, true));
    }

    private void aktionMelden(LinearLayout k) {
        if (nichtVerbunden(k)) return;
        if (me.optJSONObject("nutzer").optBoolean("owner")) { k.addView(text("Owner: Telegram über Hermes, unverändert.", 15, false)); return; }
        CheckBox mail = new CheckBox(this);
        mail.setText("E-Mail nach jedem Anruf an " + me.optJSONObject("nutzer").optString("email"));
        mail.setTextColor(cTx); mail.setTextSize(16); mail.setMinHeight(dp(48));
        mail.setChecked(me.optJSONObject("profil").optBoolean("notifyEmail"));
        mail.setOnCheckedChangeListener((c, an) -> {
            JSONObject b = new JSONObject(); try { b.put("notifyEmail", an); } catch (Exception ignored) {}
            Api.put(this, "/api/profil", b, j -> { if (an) funnel("benachrichtigung", "erledigt"); aktualisiere(); });
        });
        k.addView(mail);
        k.addView(knopf("Push im Browser einrichten", v -> web("/app"), false));
    }

    private void aktionRechte(LinearLayout k) {
        TextView r1 = text("", 15, false), r2 = text("", 15, false), r3 = text("", 15, false);
        Button b1 = knopf("Rolle anfragen", v -> {
            RoleManager rm = getSystemService(RoleManager.class);
            if (rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), 11);
            else dialog("Nicht verfügbar", "Dieses Gerät bietet die Rolle „Anrufer-ID- und Spam-App“ nicht an.");
        }, true);
        Button b2 = knopf("Kontakte erlauben", v -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, 12), true);
        Button b3 = knopf("Akku-Ausnahme anfragen", v -> {
            // Direkt-APK: Systemdialog; Play-Variante (ohne REQUEST_IGNORE_BATTERY_OPTIMIZATIONS): Einstellungsliste
            boolean darf = checkSelfPermission("android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS") == PackageManager.PERMISSION_GRANTED;
            try {
                if (darf) startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
                else { toast("In der Liste „Gemma Anruf“ suchen und „Nicht optimieren“ wählen."); startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            } catch (Exception e) { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
        }, true);
        k.addView(r1); k.addView(b1); k.addView(r2); k.addView(b2); k.addView(r3); k.addView(b3);
        TextView hh = text(herstellerHinweis(), 14, false); hh.setTextColor(cTx2); k.addView(hh);
        k.addView(knopf("App-Info öffnen (Akku/Hintergrund)", v -> startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))), false));
        aktionRefresh = () -> {
            zeile(r1, rolleGehalten(), "Anrufer-ID- und Spam-App"); b1.setVisibility(rolleGehalten() ? View.GONE : View.VISIBLE);
            zeile(r2, kontakteOk(), "Kontakte lesen"); b2.setVisibility(kontakteOk() ? View.GONE : View.VISIBLE);
            zeile(r3, akkuOk(), "Akku-Optimierung aus"); b3.setVisibility(akkuOk() ? View.GONE : View.VISIBLE);
        };
        aktionRefresh.run();
    }

    static String herstellerHinweis() {
        String m = (Build.MANUFACTURER + "").toLowerCase();
        if (m.contains("oneplus") || m.contains("oppo") || m.contains("realme"))
            return "Dein Gerät (ColorOS): zusätzlich App-Info › Akkunutzung › „Hintergrundaktivität zulassen“ einschalten.";
        if (m.contains("samsung")) return "Dein Gerät (Samsung): zusätzlich App-Info › Akku › „Nicht eingeschränkt“.";
        if (m.contains("xiaomi") || m.contains("redmi") || m.contains("poco")) return "Dein Gerät (Xiaomi): zusätzlich App-Info › Akkusparmodus › „Keine Einschränkungen“ und „Autostart“.";
        return "Schränkt dein Hersteller Hintergrund-Apps ein, in der App-Info beim Akku „nicht eingeschränkt“ wählen.";
    }

    private void aktionUmleitung(LinearLayout k) {
        if (nichtVerbunden(k)) return;
        String ein = me.optJSONObject("umleitung").optString("ein");
        if (ein.isEmpty()) { k.addView(knopf("Zu Schritt 3 (Rufnummer eintragen)", v -> zeige(2), true)); return; }
        TextView code = text(ein, 24, true); code.setTypeface(Typeface.MONOSPACE, Typeface.BOLD); code.setTextIsSelectable(true);
        k.addView(code);
        k.addView(knopf("Umleitung jetzt einschalten", v -> waehle(ein, true), true));
        k.addView(knopf("Ja, das Netz hat sie aktiviert", v -> { Konfig.setzeFlag(this, "umleitung_ok", true); funnel("umleitung", "erledigt"); aktualisiere(); }, false));
        k.addView(knopf("Status prüfen (*#67#)", v -> waehle("*#67#", false), false));
        k.addView(knopf("Umleitung ausschalten (##67#)", v -> { Konfig.setzeFlag(this, "umleitung_ok", false); waehle("##67#", false); aktualisiere(); }, false));
    }

    /** MMI-Code waehlen: nationales Format, '#' als %23 (das '+' geht in tel:-URIs verloren). */
    private void waehle(String code, boolean einschalten) {
        Uri u = Uri.parse("tel:" + code.replace("#", Uri.encode("#")));
        boolean darf = checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        if (!darf) { requestPermissions(new String[]{Manifest.permission.CALL_PHONE}, 13); toast("Ohne „Anrufe tätigen“ öffnet sich das Tastenfeld: dort die Anruftaste drücken."); }
        frageNachUmleitung = einschalten;
        try { startActivity(new Intent(darf ? Intent.ACTION_CALL : Intent.ACTION_DIAL, u)); } catch (Exception e) { toast("Konnte nicht wählen: " + e.getMessage()); }
    }

    @Override protected void onRestart() {
        super.onRestart();
        if (frageNachUmleitung) {
            frageNachUmleitung = false;
            new AlertDialog.Builder(this).setTitle("Rufumleitung")
                    .setMessage("Hat das Netz „Rufumleitung aktiviert“ (oder ähnlich) gemeldet?")
                    .setPositiveButton("Ja", (d, w) -> { Konfig.setzeFlag(this, "umleitung_ok", true); funnel("umleitung", "erledigt"); aktualisiere(); })
                    .setNegativeButton("Nein", (d, w) -> dialog("Was tun?", Anleitung.schritt(this, "umleitung").optJSONObject("hilfe").optString("nein")))
                    .show();
        }
    }

    private void aktionTest(LinearLayout k) {
        if (nichtVerbunden(k)) return;
        TextView st = text("", 16, true); k.addView(st);
        k.addView(knopf("Jetzt prüfen", v -> aktualisiere(), false));
        k.addView(knopf("Anrufe im Dashboard ansehen", v -> web("/app"), false));
        aktionRefresh = () -> {
            boolean da = me != null && me.optJSONObject("letzterAnruf") != null;
            st.setText(da ? "✓ Ein Anruf ist bei Gemma angekommen." : "Warte auf den Test-Anruf … (prüft alle 10 Sekunden)");
            st.setTextColor(da ? cOk : cTx2);
        };
        aktionRefresh.run();
    }
    private void starteTestPoll() {
        testPoll = () -> { if (idx == 7 && !ok("test")) { aktualisiere(); h.postDelayed(testPoll, 10000); } };
        h.postDelayed(testPoll, 10000);
    }

    // ---------------- Fertig + Uebersicht ----------------
    /** Karte mit Hinweisen "Was passieren kann". */
    private LinearLayout hinweisKarte(java.util.List<JSONObject> hw, String titel) {
        LinearLayout k = karte();
        GradientDrawable bg = new GradientDrawable(); bg.setCornerRadius(dp(12)); bg.setStroke(dp(1), cAk); bg.setColor(cFl2);
        k.setBackground(bg);
        k.addView(text("ⓘ  " + titel, 16, true));
        for (JSONObject h : hw) {
            TextView t = text("", 15, false);
            android.text.SpannableStringBuilder sb = new android.text.SpannableStringBuilder();
            sb.append(h.optString("titel") + ": ");
            sb.setSpan(new android.text.style.StyleSpan(Typeface.BOLD), 0, sb.length(), 0);
            sb.append(Anleitung.formatiert(h.optString("text")));
            t.setText(sb);
            k.addView(t);
        }
        return k;
    }

    /** Vor "Fertig": alle Hinweise lesen und bestaetigen. */
    private void hinweiseBestaetigen() {
        kopf.setVisibility(View.VISIBLE); unten.setVisibility(View.GONE); balken.setVisibility(View.VISIBLE);
        kopfText.setText("Fast fertig · Gut zu wissen"); balken.setProgress(IDS.length);
        inhalt.addView(text("Was passieren kann", 24, true));
        TextView z = text("Bitte einmal lesen – dann weißt du, was dich erwartet.", 16, false); z.setTextColor(cTx2); inhalt.addView(z);
        inhalt.addView(hinweisKarte(Anleitung.hinweise(this, null), "Gut zu wissen"));
        CheckBox cb = new CheckBox(this);
        cb.setText("Habe ich verstanden"); cb.setTextSize(17); cb.setTextColor(cTx); cb.setMinHeight(dp(56));
        inhalt.addView(cb);
        Button f = knopf("Fertig", v -> { Konfig.setzeFlag(this, "hinweise_ok", true); funnel("assistent", "hinweise-bestaetigt"); zeige(FERTIG); }, true);
        f.setEnabled(false); f.setAlpha(.4f);
        cb.setOnCheckedChangeListener((x, an) -> { f.setEnabled(an); f.setAlpha(an ? 1f : .4f); });
        inhalt.addView(f);
        inhalt.addView(knopf("Zurück", v -> zeige(FERTIG - 1), false));
    }

    private void fertig() {
        if (!Konfig.flag(this, "hinweise_ok")) { hinweiseBestaetigen(); return; }
        boolean alles = true;
        for (String id : IDS) if (!id.equals("test") && !ok(id)) alles = false;
        Konfig.setzeFlag(this, "assistent_fertig", alles);
        kopf.setVisibility(View.VISIBLE); unten.setVisibility(View.GONE); balken.setVisibility(View.VISIBLE);
        kopfText.setText(alles ? "Einrichtung abgeschlossen" : "Noch nicht alles erledigt"); balken.setProgress(IDS.length);
        inhalt.addView(text(alles ? "Fertig! Gemma ist bereit." : "Fast geschafft", 26, true));
        if (!alles) inhalt.addView(text("Rote Schritte antippen und erledigen. Erst dann nimmt Gemma deine Anrufe an.", 16, false));
        statusListe();
        if (alles) inhalt.addView(knopf("Test-Anruf jetzt", v -> zeige(7), true));
        else inhalt.addView(knopf("Ersten offenen Schritt erledigen", v -> zeige(ersterOffener()), true));
        inhalt.addView(knopf("Zur Übersicht", v -> zeige(-1), false));
        if (alles && !Konfig.flag(this, "einrichtung_bewertet") && me != null) {
            Konfig.setzeFlag(this, "einrichtung_bewertet", true);
            funnel("assistent", "fertig");
            einrichtungBewerten();
        }
    }

    private void uebersicht() {
        boolean randlos = getApplicationInfo().targetSdkVersion >= 35;
        kopf.setVisibility(randlos ? View.VISIBLE : View.GONE); unten.setVisibility(View.GONE);
        if (randlos) { kopfText.setText("Übersicht"); balken.setVisibility(View.GONE); }
        inhalt.addView(text("Gemma Anrufassistent", 24, true));
        Switch ki = new Switch(this);
        ki.setText("Gemma nimmt unbekannte Anrufe an"); ki.setTextSize(16); ki.setTextColor(cTx); ki.setMinHeight(dp(52));
        ki.setChecked(Konfig.kiAktiv(this));
        ki.setOnCheckedChangeListener((x, an) -> { Konfig.setzeKiAktiv(this, an); toast(an ? "An: unbekannte Nummern gehen an Gemma." : "Aus: alle Anrufe klingeln normal."); });
        inhalt.addView(ki);
        if (me != null && me.optJSONObject("zaehler") != null) { TextView z = text(me.optJSONObject("zaehler").optString("text"), 14, false); z.setTextColor(cTx2); inhalt.addView(z); }
        statusListe();
        inhalt.addView(knopf("Einrichtung fortsetzen / neu starten", v -> { Konfig.setzeFlag(this, "assistent_fertig", false); zeige(ersterOffener()); }, true));
        inhalt.addView(knopf("Gut zu wissen: Was passieren kann", v -> { Konfig.setzeFlag(this, "hinweise_ok", false); zeige(FERTIG); }, false));
        inhalt.addView(knopf("Anrufe im Dashboard", v -> web("/app"), false));
        inhalt.addView(knopf("Feedback geben", v -> feedback(), false));
    }

    private int ersterOffener() { for (int i = 0; i < IDS.length; i++) if (!ok(IDS[i])) return i; return 0; }

    private void statusListe() {
        LinearLayout k = karte();
        for (int i = 0; i < IDS.length; i++) {
            final int n = i;
            TextView t = text((ok(IDS[i]) ? "✓  " : "○  ") + (i + 1) + ". " + Anleitung.schritt(this, IDS[i]).optString("titel", IDS[i]), 16, true);
            t.setTextColor(ok(IDS[i]) ? cOk : cFehl); t.setMinHeight(dp(48)); t.setGravity(Gravity.CENTER_VERTICAL);
            t.setOnClickListener(v -> zeige(n));
            t.setContentDescription((i + 1) + ". " + IDS[i] + (ok(IDS[i]) ? " erledigt, antippen zum Wiederholen" : " offen, antippen zum Einrichten"));
            k.addView(t);
        }
        inhalt.addView(k);
    }

    // ---------------- Geraete-Pruefungen ----------------
    private boolean rolleGehalten() { RoleManager rm = getSystemService(RoleManager.class); return rm != null && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING); }
    private boolean kontakteOk() { return checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED; }
    private boolean akkuOk() { PowerManager pm = getSystemService(PowerManager.class); return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName()); }
    @Override protected void onActivityResult(int r, int c, Intent d) { super.onActivityResult(r, c, d); aktualisiere(); }
    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) { super.onRequestPermissionsResult(r, p, g); aktualisiere(); }

    // ---------------- Feedback ----------------
    private void feedback() {
        Bitmap shot = bildschirmfoto();
        LinearLayout f = new LinearLayout(this); f.setOrientation(LinearLayout.VERTICAL); f.setPadding(dp(20), dp(8), dp(20), 0);
        RadioGroup kat = new RadioGroup(this); kat.setOrientation(RadioGroup.HORIZONTAL);
        String[][] ks = {{"fehler", "Fehler"}, {"idee", "Idee"}, {"lob", "Lob"}};
        for (String[] x : ks) { RadioButton rb = radio(x[1]); rb.setTag(x[0]); kat.addView(rb); if (x[0].equals("idee")) kat.check(rb.getId()); }
        f.addView(kat);
        RatingBar rb = new RatingBar(this); rb.setNumStars(5); rb.setStepSize(1); rb.setRating(0);
        rb.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        f.addView(rb);
        EditText t = eingabe("Was ist dir aufgefallen?", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE); t.setMinLines(3);
        f.addView(t);
        CheckBox mitBild = new CheckBox(this); mitBild.setText("Bildschirmfoto der App anhängen");
        if (shot != null) f.addView(mitBild);
        new AlertDialog.Builder(this).setTitle("Feedback zur Beta").setView(f)
                .setPositiveButton("Senden", (d, w) -> {
                    JSONObject b = new JSONObject();
                    try {
                        View sel = kat.findViewById(kat.getCheckedRadioButtonId());
                        b.put("art", "feedback").put("kategorie", sel == null ? "idee" : sel.getTag()).put("text", t.getText().toString())
                                .put("appVersion", version()).put("geraet", Build.MANUFACTURER + " " + Build.MODEL).put("android", Build.VERSION.RELEASE)
                                .put("schritt", idx >= 0 && idx < FERTIG ? IDS[idx] : idx == FERTIG ? "fertig" : "uebersicht");
                        if (rb.getRating() > 0) b.put("sterne", (int) rb.getRating());
                        if (mitBild.isChecked() && shot != null) b.put("screenshot", "data:image/jpeg;base64," + jpegB64(shot));
                    } catch (Exception ignored) {}
                    if (Konfig.geraeteToken(this).isEmpty()) { toast("Bitte erst mit gemivo verbinden (Schritt 1)."); return; }
                    Api.post(this, "/api/feedback", b, j -> toast(j.optBoolean("ok") ? "Danke! Feedback ist angekommen." : Api.fehler(j)));
                }).setNegativeButton("Abbrechen", null).show();
    }

    private void einrichtungBewerten() {
        LinearLayout f = new LinearLayout(this); f.setOrientation(LinearLayout.VERTICAL); f.setPadding(dp(20), dp(8), dp(20), 0);
        RatingBar rb = new RatingBar(this); rb.setNumStars(5); rb.setStepSize(1);
        rb.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        f.addView(rb);
        EditText t = eingabe("Kommentar (optional)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        f.addView(t);
        new AlertDialog.Builder(this).setTitle("Wie leicht war die Einrichtung?").setView(f)
                .setPositiveButton("Senden", (d, w) -> {
                    if (rb.getRating() < 1) return;
                    JSONObject b = new JSONObject();
                    try { b.put("art", "einrichtung").put("sterne", (int) rb.getRating()).put("text", t.getText().toString()).put("appVersion", version())
                            .put("geraet", Build.MANUFACTURER + " " + Build.MODEL).put("android", Build.VERSION.RELEASE).put("schritt", "fertig"); } catch (Exception ignored) {}
                    Api.post(this, "/api/feedback", b, j -> toast(j.optBoolean("ok") ? "Danke!" : Api.fehler(j)));
                }).setNegativeButton("Später", null).show();
    }

    private Bitmap bildschirmfoto() {
        try {
            View v = getWindow().getDecorView().getRootView();
            Bitmap b = Bitmap.createBitmap(v.getWidth(), v.getHeight(), Bitmap.Config.RGB_565);
            v.draw(new Canvas(b));
            float s = Math.min(1f, 1080f / Math.max(1, b.getHeight()));
            return s < 1f ? Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * s), Math.round(b.getHeight() * s), true) : b;
        } catch (Exception e) { return null; }
    }
    private static String jpegB64(Bitmap b) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 70, o);
        return Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
    }

    private void funnel(String schritt, String ereignis) {
        if (Konfig.geraeteToken(this).isEmpty()) return;
        JSONObject b = new JSONObject();
        try { b.put("schritt", schritt).put("ereignis", ereignis); } catch (Exception ignored) {}
        Api.post(this, "/api/funnel", b, j -> {});
    }

    // ---------------- UI-Helfer ----------------
    private void farben() {
        boolean nacht = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        if (nacht) { cBg = 0xFF111413; cFl = 0xFF1A1E1D; cFl2 = 0xFF232826; cTx = 0xFFECEFED; cTx2 = 0xFFA3AAA7; cRand = 0xFF2E3532; cAk = 0xFF2DD4BF; cAkTx = 0xFF06201C; cOk = 0xFF4ADE80; cFehl = 0xFFF87171; }
        else { cBg = 0xFFF6F5F1; cFl = 0xFFFFFFFF; cFl2 = 0xFFEFEDE6; cTx = 0xFF1B1D1F; cTx2 = 0xFF5B6067; cRand = 0xFFDEDBD2; cAk = 0xFF0F766E; cAkTx = 0xFFFFFFFF; cOk = 0xFF15803D; cFehl = 0xFFB91C1C; }
    }
    private String version() { try { PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0); return pi.versionName; } catch (Exception e) { return "?"; } }
    static String regText(String s) {
        switch (s) {
            case "Registered": return "angemeldet ✓";
            case "Rejected": return "abgelehnt (Zugangsdaten prüfen)";
            case "Unregistered": return "nicht angemeldet";
            case "nicht-konfiguriert": return "noch nicht aktiv";
            case "aus": return "kein Anschluss";
            default: return s;
        }
    }
    private void web(String pfad) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(Api.BASIS + pfad))); }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_LONG).show(); }
    private void dialog(String t, String m) { new AlertDialog.Builder(this).setTitle(t).setMessage(m).setPositiveButton("OK", null).show(); }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
    private TextView text(String s, int sp, boolean fett) {
        TextView t = new TextView(this); t.setText(s); t.setTextSize(sp); t.setTextColor(cTx);
        if (fett) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(4), 0, dp(4)); t.setLineSpacing(0, 1.2f);
        return t;
    }
    private void zeile(TextView t, boolean ok, String s) { t.setText((ok ? "✓ " : "✗ ") + s); t.setTextColor(ok ? cOk : cFehl); t.setTypeface(Typeface.DEFAULT_BOLD); }
    private LinearLayout karte() {
        LinearLayout k = new LinearLayout(this); k.setOrientation(LinearLayout.VERTICAL); k.setPadding(dp(14), dp(10), dp(14), dp(12));
        GradientDrawable bg = new GradientDrawable(); bg.setCornerRadius(dp(12)); bg.setStroke(dp(1), cRand); bg.setColor(cFl); k.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(16), 0, dp(8)); k.setLayoutParams(lp);
        return k;
    }
    private Button knopf(String s, View.OnClickListener l, boolean primaer) {
        Button b = new Button(this); b.setText(s); b.setAllCaps(false); b.setOnClickListener(l); b.setMinHeight(dp(52)); b.setTextSize(16);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primaer ? cAk : cFl2));
        b.setTextColor(primaer ? cAkTx : cTx);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(4); b.setLayoutParams(lp);
        return b;
    }
    private RadioButton radio(String s) { RadioButton r = new RadioButton(this); r.setText(s); r.setId(View.generateViewId()); r.setMinHeight(dp(48)); r.setTextColor(cTx); r.setTextSize(16); return r; }
    private LinearLayout.LayoutParams gewicht() { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f); p.setMargins(dp(3), 0, dp(3), 0); return p; }
    private EditText eingabe(String hint, int typ) { EditText e = new EditText(this); e.setHint(hint); e.setInputType(typ); e.setMinHeight(dp(52)); e.setTextColor(cTx); e.setHintTextColor(cTx2); e.setTextSize(16); return e; }
    private EditText feld(LinearLayout k, String label, String wert, int typ) {
        TextView l = text(label, 14, true); l.setTextColor(cTx2); k.addView(l);
        EditText e = eingabe("", typ);
        e.setText(wert == null || "null".equals(wert) ? "" : wert);
        k.addView(e);
        return e;
    }
}
