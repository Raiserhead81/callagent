package de.gemivo.callagent;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.role.RoleManager;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.RatingBar;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Gemma Anrufassistent: Einrichtungsassistent + Status (spricht mit anruf.gemivo.de, Multi-Tenant per Geraete-Token).
 * Schritte (gleiche Reihenfolge wie die Web-Anleitung): Konto, Gemini, Anschluss, Name, Benachrichtigung,
 * Rechte (Rolle/Kontakte/Akku), Rufumleitung, Test. Jeder Schritt zeigt gruen/rot und ist wiederholbar.
 * Die Anruf-Logik selbst (CallScreening) ist unveraendert: unbekannte Nummern ablehnen -> Umleitung bei besetzt.
 */
public class MainActivity extends Activity {

    static final String[][] SCHRITTE = {
            {"konto", "Mit gemivo verbinden"}, {"gemini", "Gemini-Schlüssel"}, {"anschluss", "FritzBox / SIP-Anbieter"},
            {"name", "Name für die Begrüßung"}, {"benachrichtigung", "Benachrichtigung"}, {"rechte", "Rechte & Akku"},
            {"umleitung", "Rufumleitung"}, {"test", "Test-Anruf"}};
    static final int GRUEN = Color.rgb(21, 128, 61), ROT = Color.rgb(185, 28, 28), AKZENT = Color.rgb(15, 118, 110);

    private LinearLayout liste;
    private TextView kopfStatus;
    private JSONObject me;
    private String offen = null;           // aufgeklappter Schritt
    private final Map<String, Boolean> status = new LinkedHashMap<>();
    private final java.util.Set<String> gemeldet = new java.util.HashSet<>();

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ScrollView sv = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = dp(16);
        root.setPadding(p, p, p, dp(96));
        sv.addView(root);

        TextView titel = text("Gemma Anrufassistent", 24, true);
        root.addView(titel);
        kopfStatus = text("Lade …", 15, false);
        kopfStatus.setPadding(0, dp(6), 0, dp(6));
        root.addView(kopfStatus);

        Switch ki = new Switch(this);
        ki.setText("Gemma nimmt unbekannte Anrufe an");
        ki.setTextSize(16);
        ki.setMinHeight(dp(48));
        ki.setChecked(Konfig.kiAktiv(this));
        ki.setOnCheckedChangeListener((x, an) -> { Konfig.setzeKiAktiv(this, an); aktualisiere(); });
        root.addView(ki);

        LinearLayout knoepfe = new LinearLayout(this);
        knoepfe.setOrientation(LinearLayout.HORIZONTAL);
        knoepfe.addView(knopf("Dashboard", v -> web("/app"), false), gewicht());
        knoepfe.addView(knopf("Anleitung", v -> web("/anleitung"), false), gewicht());
        knoepfe.addView(knopf("Feedback", v -> feedback(), true), gewicht());
        root.addView(knoepfe);

        liste = new LinearLayout(this);
        liste.setOrientation(LinearLayout.VERTICAL);
        liste.setPadding(0, dp(12), 0, 0);
        root.addView(liste);
        setContentView(sv);

        pruefeTestanruf(getIntent());
        if (!kopplungAusIntent(getIntent()) && !Konfig.flag(this, "assistent_gesehen")) offen = "konto";
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); kopplungAusIntent(i); pruefeTestanruf(i); }
    @Override protected void onResume() { super.onResume(); aktualisiere(); }
    @Override protected void onStop() {
        super.onStop();
        if (offen != null && !Boolean.TRUE.equals(status.get(offen))) funnel(offen, "abgebrochen");
    }

    /** E2E-Test (alt): am start ... --es testanruf <nummer> */
    private void pruefeTestanruf(Intent i) {
        String nr = i == null ? null : i.getStringExtra("testanruf");
        if (nr == null || nr.isEmpty()) return;
        i.removeExtra("testanruf");
        TestVerbindung.anrufSimulieren(this, nr);
    }

    // ---------------- Status ----------------
    private void aktualisiere() {
        status.put("rechte", rolleGehalten() && kontakteOk() && akkuOk());
        status.put("umleitung", Konfig.flag(this, "umleitung_ok"));
        if (Konfig.geraeteToken(this).isEmpty()) {
            me = null; status.put("konto", false);
            zeichne();
            return;
        }
        Api.get(this, "/api/me", j -> {
            if (j.optBoolean("ok")) {
                me = j;
                JSONObject s = j.optJSONObject("schritte");
                for (String[] st : SCHRITTE) if (!st[0].equals("rechte") && !st[0].equals("umleitung")) status.put(st[0], s != null && s.optBoolean(st[0]));
                status.put("konto", true);
                // Geraete-Schritte an den Server melden (Dashboard zeigt sie dann gruen)
                for (String k : new String[]{"rechte", "umleitung"}) if (Boolean.TRUE.equals(status.get(k)) && gemeldet.add(k)) funnel(k, "erledigt");
            } else if (j.optInt("_status") == 401) {
                Konfig.setzeGeraeteToken(this, ""); me = null; status.put("konto", false);
            } else {
                kopfStatus.setText("Server nicht erreichbar: " + Api.fehler(j));
            }
            zeichne();
        });
    }

    private void zeichne() {
        liste.removeAllViews();
        int fertig = 0;
        for (String[] st : SCHRITTE) if (Boolean.TRUE.equals(status.get(st[0]))) fertig++;
        boolean ki = Konfig.kiAktiv(this);
        String kopf = fertig == SCHRITTE.length ? "Alles eingerichtet. " : "Einrichtung: " + fertig + " von " + SCHRITTE.length + " Schritten erledigt. ";
        if (!ki) kopf += "\nKI-Annahme ist AUS: unbekannte Nummern klingeln normal.";
        if (me != null && me.optJSONObject("zaehler") != null) kopf += "\n" + me.optJSONObject("zaehler").optString("text");
        kopfStatus.setText(kopf);
        for (int i = 0; i < SCHRITTE.length; i++) liste.addView(schrittKarte(i, SCHRITTE[i][0], SCHRITTE[i][1]));
        if (fertig == SCHRITTE.length && !Konfig.flag(this, "einrichtung_bewertet") && me != null) {
            Konfig.setzeFlag(this, "einrichtung_bewertet", true);
            funnel("assistent", "fertig");
            einrichtungBewerten();
        }
    }

    private View schrittKarte(int nr, String key, String titel) {
        boolean ok = Boolean.TRUE.equals(status.get(key));
        LinearLayout k = new LinearLayout(this);
        k.setOrientation(LinearLayout.VERTICAL);
        k.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(12)); bg.setStroke(dp(1), ok ? GRUEN : Color.rgb(222, 219, 210)); bg.setColor(Color.WHITE);
        k.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(10));
        k.setLayoutParams(lp);
        TextView t = text((ok ? "✓  " : "○  ") + (nr + 1) + ". " + titel, 17, true);
        t.setTextColor(ok ? GRUEN : ROT);
        t.setMinHeight(dp(40));
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setContentDescription(titel + (ok ? " erledigt" : " offen"));
        k.addView(t);
        t.setOnClickListener(v -> { offen = key.equals(offen) ? null : key; if (offen != null) { Konfig.setzeFlag(this, "assistent_gesehen", true); funnel(key, "gesehen"); } zeichne(); });
        if (key.equals(offen)) inhalt(k, key);
        return k;
    }

    // ---------------- Schritt-Inhalte ----------------
    private void inhalt(LinearLayout k, String key) {
        boolean verbunden = me != null;
        if (!verbunden && !key.equals("konto") && !key.equals("rechte") && !key.equals("umleitung")) {
            k.addView(text("Erst Schritt 1: mit gemivo verbinden.", 15, false));
            return;
        }
        switch (key) {
            case "konto": konto(k); break;
            case "gemini": gemini(k); break;
            case "anschluss": anschluss(k); break;
            case "name": name(k); break;
            case "benachrichtigung": benachrichtigung(k); break;
            case "rechte": rechte(k); break;
            case "umleitung": umleitung(k); break;
            case "test": test(k); break;
        }
    }

    private void konto(LinearLayout k) {
        if (me != null) {
            JSONObject n = me.optJSONObject("nutzer");
            k.addView(text("Verbunden als " + (n == null ? "?" : n.optString("email", "") + " (Nutzer " + n.optInt("uid") + ")"), 15, false));
            k.addView(knopf("Trennen", v -> { Konfig.setzeGeraeteToken(this, ""); aktualisiere(); }, false));
            return;
        }
        k.addView(text("Melde dich mit deinem gemivo-Konto an. Der Browser schickt dich danach automatisch hierher zurück.", 15, false));
        k.addView(knopf("Im Browser anmelden", v -> web("/koppeln?app=1"), true));
        k.addView(knopf("Code eingeben", v -> codeDialog(), false));
        k.addView(link("Noch kein gemivo-Konto? Kostenlos anlegen", "https://gemivo.de/konto/registrieren.php"));
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
                offen = "gemini";
                aktualisiere();
            } else toast(Api.fehler(j));
        });
    }

    private void gemini(LinearLayout k) {
        JSONObject g = me.optJSONObject("gemini");
        boolean owner = me.optJSONObject("nutzer").optBoolean("owner");
        if (owner) { k.addView(text("Owner-Anschluss: nutzt den gemivo-Schlüssel. Nichts zu tun.", 15, false)); return; }
        String st = g == null ? "fehlt" : g.optString("status");
        k.addView(text("Status: " + ("ok".equals(st) ? "gültig ✓" : "fehlt".equals(st) ? "fehlt" : "Fehler") + (g != null && !g.optString("fehler").isEmpty() && !g.isNull("fehler") ? "\n" + g.optString("fehler") : ""), 15, false));
        k.addView(text("1. aistudio.google.com öffnen → „API-Schlüssel erstellen“\n2. Unter „Projects“ → „Set up billing“ Abrechnung bzw. Guthaben (Prepay, ab 5 $) einrichten\n3. Schlüssel hier einfügen und testen", 14, false));
        k.addView(link("Google AI Studio öffnen", "https://aistudio.google.com/apikey"));
        k.addView(link("Warum Guthaben? (Anleitung)", Api.BASIS + "/anleitung#gemini"));
        EditText e = eingabe("Schlüssel (AIza… oder AQ.…)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        k.addView(e);
        k.addView(knopf("Schlüssel testen und speichern", v -> {
            JSONObject b = new JSONObject();
            try { b.put("key", e.getText().toString().trim()); } catch (Exception ignored) {}
            toast("Teste echte Verbindung zum Live-Modell …");
            Api.post(this, "/api/gemini", b, j -> {
                JSONObject t = j.optJSONObject("test");
                if (!j.optBoolean("ok")) toast(Api.fehler(j));
                else if (t != null && t.optBoolean("ok")) { toast("Schlüssel funktioniert ✓"); funnel("gemini", "erledigt"); offen = "anschluss"; }
                else dialog("Test fehlgeschlagen", t == null ? "?" : t.optString("fehler"));
                aktualisiere();
            });
        }, true));
    }

    private void anschluss(LinearLayout k) {
        JSONObject s = me.optJSONObject("sip");
        boolean owner = me.optJSONObject("nutzer").optBoolean("owner");
        if (owner) {
            k.addView(text("Owner-Anschluss (FritzBox über WireGuard), bleibt unverändert.\nStatus: " + regText(s.optString("status")), 15, false));
            k.addView(knopf("Verbindungstest", v -> verbindungstest(), false));
            return;
        }
        RadioGroup rg = new RadioGroup(this);
        rg.setOrientation(RadioGroup.HORIZONTAL);
        RadioButton fb = new RadioButton(this); fb.setText("FRITZ!Box"); fb.setId(View.generateViewId()); fb.setMinHeight(dp(48));
        RadioButton an = new RadioButton(this); an.setText("SIP-Anbieter"); an.setId(View.generateViewId()); an.setMinHeight(dp(48));
        rg.addView(fb); rg.addView(an);
        rg.check("anbieter".equals(s.optString("modus")) ? an.getId() : fb.getId());
        k.addView(rg);
        TextView hilfe = text("", 14, false);
        k.addView(hilfe);
        Runnable hilfeText = () -> hilfe.setText(rg.getCheckedRadioButtonId() == fb.getId()
                ? "FRITZ!Box: Telefonie › Telefoniegeräte › Neues Gerät › Telefon › LAN/WLAN (IP-Telefon), Name „Gemma“, Benutzername + langes Kennwort. Dann beim Gerät „Anmeldung aus dem Internet erlauben“ anhaken und nur auf deine Umleitungs-Nummer reagieren lassen. Registrar = deine MyFRITZ!-Adresse (Internet › MyFRITZ!-Konto)."
                : "SIP-Anbieter: Im Kundenportal ein SIP-/VoIP-Gerät anlegen. Registrar, SIP-ID und SIP-Kennwort von dort übernehmen.");
        hilfeText.run();
        rg.setOnCheckedChangeListener((g, id) -> hilfeText.run());
        k.addView(link("So geht's in der FritzBox (mit Bildschirm-Skizzen)", Api.BASIS + "/anleitung#fritzbox"));
        EditText server = feld(k, "Registrar (z. B. abcd1234.myfritz.net)", s.optString("server"), InputType.TYPE_TEXT_VARIATION_URI);
        EditText user = feld(k, "Benutzername", s.optString("user"), InputType.TYPE_CLASS_TEXT);
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
                if ("Registered".equals(j.optString("status"))) { toast("Angemeldet ✓"); funnel("anschluss", "erledigt"); offen = "name"; aktualisiere(); }
                else verbindungstest();
            });
        }, true));
        k.addView(knopf("Verbindungstest", v -> verbindungstest(), false));
        k.addView(text("Status: " + regText(s.optString("status")), 15, true));
    }

    private void verbindungstest() {
        Api.get(this, "/api/sip/status", j -> {
            String st = j.optString("status");
            dialog("Verbindungstest", "Status: " + regText(st) + (j.optString("hinweis").isEmpty() ? "" : "\n\n" + j.optString("hinweis")));
            aktualisiere();
        });
    }

    private void name(LinearLayout k) {
        JSONObject pr = me.optJSONObject("profil");
        if (me.optJSONObject("nutzer").optBoolean("owner")) { k.addView(text("Owner: feste Begrüßung „… die Assistentin von Kay“ (Aussprache Kai).", 15, false)); return; }
        TextView vorschau = text("", 14, false);
        EditText v = feld(k, "Vorname", pr.optString("vorname"), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        EditText a = feld(k, "Aussprache-Schreibweise (optional, z. B. Kai für Kay)", pr.optString("aussprache"), InputType.TYPE_CLASS_TEXT);
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
            Api.put(this, "/api/profil", b, j -> { if (j.optBoolean("ok")) { toast("Gespeichert ✓"); funnel("name", "erledigt"); offen = "benachrichtigung"; } else toast(Api.fehler(j)); aktualisiere(); });
        }, true));
    }

    private void benachrichtigung(LinearLayout k) {
        JSONObject pr = me.optJSONObject("profil");
        if (me.optJSONObject("nutzer").optBoolean("owner")) { k.addView(text("Owner: Telegram über Hermes, unverändert.", 15, false)); return; }
        CheckBox mail = new CheckBox(this);
        mail.setText("E-Mail nach jedem Anruf an " + me.optJSONObject("nutzer").optString("email"));
        mail.setMinHeight(dp(48));
        mail.setChecked(pr.optBoolean("notifyEmail"));
        mail.setOnCheckedChangeListener((c, an) -> {
            JSONObject b = new JSONObject(); try { b.put("notifyEmail", an); } catch (Exception ignored) {}
            Api.put(this, "/api/profil", b, j -> { if (an) funnel("benachrichtigung", "erledigt"); aktualisiere(); });
        });
        k.addView(mail);
        k.addView(text("Push: im Dashboard (Browser) „Push aktivieren“ antippen. Aktive Push-Geräte: " + me.optInt("pushAbos"), 14, false));
        k.addView(knopf("Dashboard öffnen (Push)", v -> web("/app"), false));
        k.addView(text("Telegram: für Beta-Nutzer noch nicht verfügbar.", 14, false));
    }

    private void rechte(LinearLayout k) {
        boolean rolle = rolleGehalten(), kontakte = kontakteOk(), akku = akkuOk();
        k.addView(zeile(rolle, "Anrufer-ID- und Spam-App (Anruf-Filter)"));
        if (!rolle) k.addView(knopf("Rolle anfragen", v -> {
            RoleManager rm = getSystemService(RoleManager.class);
            if (rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), 11);
            else toast("Dieses Gerät bietet die Rolle nicht an.");
        }, true));
        k.addView(zeile(kontakte, "Kontakte lesen (nur so bleiben Kontakte unberührt)"));
        if (!kontakte) k.addView(knopf("Kontakte erlauben", v -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, 12), true));
        k.addView(zeile(akku, "Ausnahme von der Akku-Optimierung"));
        if (!akku) k.addView(knopf("Akku-Ausnahme anfragen", v -> {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()));
            try { startActivity(i); } catch (Exception e) { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
        }, true));
        k.addView(text(herstellerHinweis(), 14, false));
        k.addView(knopf("App-Info öffnen (Akku/Hintergrund)", v -> startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))), false));
    }

    static String herstellerHinweis() {
        String m = (Build.MANUFACTURER + "").toLowerCase();
        if (m.contains("oneplus") || m.contains("oppo") || m.contains("realme"))
            return "ColorOS: App-Info › Akkunutzung › „Hintergrundaktivität zulassen“ einschalten. Sonst friert das System die App ein und unbekannte Anrufe klingeln normal.";
        if (m.contains("samsung")) return "Samsung: App-Info › Akku › „Nicht eingeschränkt“ wählen.";
        if (m.contains("xiaomi") || m.contains("redmi") || m.contains("poco"))
            return "Xiaomi/HyperOS: App-Info › Akkusparmodus › „Keine Einschränkungen“ und „Autostart“ einschalten.";
        return "Falls dein Hersteller Apps im Hintergrund einschränkt: in der App-Info Akku „nicht eingeschränkt“ wählen.";
    }

    private void umleitung(LinearLayout k) {
        String ein = me == null ? "" : me.optJSONObject("umleitung").optString("ein");
        k.addView(zeile(Konfig.flag(this, "umleitung_ok"), "Umleitung bei besetzt auf deine Gemma-Nummer"));
        if (ein.isEmpty()) { k.addView(text("Erst im Schritt „FritzBox / SIP“ die Rufnummer eintragen.", 15, false)); return; }
        TextView code = text(ein, 22, true);
        code.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        k.addView(code);
        k.addView(text("Die Weiterleitung kostet laut deinem Mobilfunktarif wie ein Anruf ins deutsche Festnetz (in Allnet-Flats meist enthalten). Eine bestehende Mailbox-Umleitung bei besetzt wird ersetzt.", 14, false));
        k.addView(knopf("Umleitung jetzt einschalten", v -> waehle(ein, true), true));
        k.addView(knopf("Status prüfen (*#67#)", v -> waehle("*#67#", false), false));
        k.addView(knopf("Umleitung ausschalten (##67#)", v -> { Konfig.setzeFlag(this, "umleitung_ok", false); waehle("##67#", false); }, false));
    }

    private boolean frageNachUmleitung = false;
    /** MMI-Code waehlen: nationales Format, '#' als %23 (das '+' geht in tel:-URIs verloren). */
    private void waehle(String code, boolean einschalten) {
        Uri u = Uri.parse("tel:" + code.replace("#", Uri.encode("#")));
        boolean darf = checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        if (!darf) { requestPermissions(new String[]{Manifest.permission.CALL_PHONE}, 13); toast("Bitte „Anrufe tätigen“ erlauben oder in der Telefon-App Anruftaste drücken."); }
        frageNachUmleitung = einschalten;
        try { startActivity(new Intent(darf ? Intent.ACTION_CALL : Intent.ACTION_DIAL, u)); } catch (Exception e) { toast("Konnte nicht wählen: " + e.getMessage()); }
    }

    private void test(LinearLayout k) {
        boolean ok = me.optJSONObject("letzterAnruf") != null;
        k.addView(zeile(ok, ok ? "Ein Anruf ist angekommen" : "Noch kein Anruf angekommen"));
        k.addView(text("Lass dich von einer Nummer anrufen, die nicht in deinen Kontakten steht (z. B. mit unterdrückter Nummer). Dein Handy klingelt nicht, Gemma meldet sich. Danach steht die Zusammenfassung im Dashboard.", 14, false));
        k.addView(knopf("Aktualisieren", v -> aktualisiere(), false));
        k.addView(knopf("Dashboard öffnen", v -> web("/app"), false));
    }

    @Override
    protected void onRestart() {
        super.onRestart();
        if (frageNachUmleitung) {
            frageNachUmleitung = false;
            new AlertDialog.Builder(this).setTitle("Rufumleitung")
                    .setMessage("Hat das Netz „Rufumleitung aktiviert“ (oder ähnlich) gemeldet?")
                    .setPositiveButton("Ja", (d, w) -> { Konfig.setzeFlag(this, "umleitung_ok", true); funnel("umleitung", "erledigt"); offen = "test"; aktualisiere(); })
                    .setNegativeButton("Nein", (d, w) -> dialog("Umleitung", "Prüfe mit *#67#. Manche Netze brauchen das Format ohne Leerzeichen. Hilfe: Anleitung › Rufumleitung."))
                    .show();
        }
    }
    @Override protected void onActivityResult(int r, int c, Intent d) { super.onActivityResult(r, c, d); aktualisiere(); }
    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) { super.onRequestPermissionsResult(r, p, g); aktualisiere(); }

    // ---------------- Geraete-Pruefungen ----------------
    private boolean rolleGehalten() { RoleManager rm = getSystemService(RoleManager.class); return rm != null && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING); }
    private boolean kontakteOk() { return checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED; }
    private boolean akkuOk() { PowerManager pm = getSystemService(PowerManager.class); return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName()); }

    // ---------------- Feedback ----------------
    private void feedback() {
        Bitmap shot = bildschirmfoto();
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.VERTICAL);
        f.setPadding(dp(20), dp(8), dp(20), 0);
        RadioGroup kat = new RadioGroup(this); kat.setOrientation(RadioGroup.HORIZONTAL);
        String[][] ks = {{"fehler", "Fehler"}, {"idee", "Idee"}, {"lob", "Lob"}};
        for (String[] x : ks) { RadioButton rb = new RadioButton(this); rb.setText(x[1]); rb.setTag(x[0]); rb.setId(View.generateViewId()); kat.addView(rb); if (x[0].equals("idee")) kat.check(rb.getId()); }
        f.addView(kat);
        RatingBar rb = new RatingBar(this); rb.setNumStars(5); rb.setStepSize(1); rb.setRating(0);
        LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rb.setLayoutParams(wl);
        f.addView(rb);
        EditText t = eingabe("Was ist dir aufgefallen?", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        t.setMinLines(3);
        f.addView(t);
        CheckBox mitBild = new CheckBox(this); mitBild.setText("Bildschirmfoto der App anhängen"); mitBild.setChecked(false);
        if (shot != null) f.addView(mitBild);
        new AlertDialog.Builder(this).setTitle("Feedback zur Beta").setView(f)
                .setPositiveButton("Senden", (d, w) -> {
                    JSONObject b = new JSONObject();
                    try {
                        View sel = kat.findViewById(kat.getCheckedRadioButtonId());
                        b.put("art", "feedback").put("kategorie", sel == null ? "idee" : sel.getTag()).put("text", t.getText().toString())
                                .put("appVersion", version()).put("geraet", Build.MANUFACTURER + " " + Build.MODEL).put("android", Build.VERSION.RELEASE)
                                .put("schritt", offen == null ? "status" : offen);
                        if (rb.getRating() > 0) b.put("sterne", (int) rb.getRating());
                        if (mitBild.isChecked() && shot != null) b.put("screenshot", "data:image/jpeg;base64," + jpegB64(shot));
                    } catch (Exception ignored) {}
                    if (Konfig.geraeteToken(this).isEmpty()) { toast("Bitte erst mit gemivo verbinden (Schritt 1)."); return; }
                    Api.post(this, "/api/feedback", b, j -> toast(j.optBoolean("ok") ? "Danke! Feedback ist angekommen." : Api.fehler(j)));
                }).setNegativeButton("Abbrechen", null).show();
    }

    private void einrichtungBewerten() {
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.VERTICAL);
        f.setPadding(dp(20), dp(8), dp(20), 0);
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
        TextView t = new TextView(this); t.setText(s); t.setTextSize(sp); t.setTextColor(Color.rgb(27, 29, 31));
        if (fett) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(4), 0, dp(4)); t.setLineSpacing(0, 1.15f);
        return t;
    }
    private TextView zeile(boolean ok, String s) { TextView t = text((ok ? "✓ " : "✗ ") + s, 15, false); t.setTextColor(ok ? GRUEN : ROT); return t; }
    private TextView link(String s, String url) {
        TextView t = text(s, 15, false); t.setTextColor(AKZENT); t.setMinHeight(dp(44)); t.setGravity(Gravity.CENTER_VERTICAL);
        t.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))));
        return t;
    }
    private Button knopf(String s, View.OnClickListener l, boolean primaer) {
        Button b = new Button(this); b.setText(s); b.setAllCaps(false); b.setOnClickListener(l); b.setMinHeight(dp(48));
        if (primaer) { b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(AKZENT)); b.setTextColor(Color.WHITE); }
        return b;
    }
    private LinearLayout.LayoutParams gewicht() { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f); p.setMargins(dp(2), 0, dp(2), 0); return p; }
    private EditText eingabe(String hint, int typ) { EditText e = new EditText(this); e.setHint(hint); e.setInputType(typ); e.setMinHeight(dp(48)); return e; }
    private EditText feld(LinearLayout k, String label, String wert, int typ) {
        TextView l = text(label, 13, true); k.addView(l);
        EditText e = eingabe("", typ == InputType.TYPE_TEXT_VARIATION_URI ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI : typ);
        e.setText(wert == null || "null".equals(wert) ? "" : wert);
        k.addView(e);
        return e;
    }
}
