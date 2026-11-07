package de.gemivo.callagent;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Laedt das Vosk-Sprachmodell (deutsch, ~40 MB) einmalig vom gemivo-Server. */
public class ModellDownload extends Activity {

    private ProgressBar balken;
    private TextView text;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.modell);
        balken = findViewById(R.id.fortschritt);
        text = findViewById(R.id.modell_status);
        Button btn = findViewById(R.id.btn_laden);
        btn.setOnClickListener(v -> new Thread(this::laden, "modell-dl").start());
        if (Konfig.modellDa(this)) text.setText("Modell bereits vorhanden ✅");
    }

    private void laden() {
        try {
            runOnUiThread(() -> text.setText("Lade Sprachmodell (ca. 40 MB) ..."));
            HttpURLConnection c = (HttpURLConnection) new URL(
                    Konfig.modellUrl()).openConnection();
            int gesamt = c.getContentLength();
            InputStream in = c.getInputStream();
            File ziel = Konfig.modellOrdner(this);
            ziel.mkdirs();
            ZipInputStream zip = new ZipInputStream(in);
            byte[] puffer = new byte[8192];
            ZipEntry e;
            int gelesen = 0;
            while ((e = zip.getNextEntry()) != null) {
                String name = e.getName();
                // aeusseren Ordner (vosk-model-small-de-0.15/) entfernen
                int slash = name.indexOf('/');
                String rest = slash >= 0 ? name.substring(slash + 1) : name;
                if (rest.isEmpty()) continue;
                File f = new File(ziel, rest);
                if (e.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                java.io.FileOutputStream out = new java.io.FileOutputStream(f);
                int n;
                while ((n = zip.read(puffer)) > 0) {
                    out.write(puffer, 0, n);
                    gelesen += n;
                    if (gesamt > 0) {
                        final int p = gelesen * 100 / gesamt;
                        runOnUiThread(() -> balken.setProgress(p));
                    }
                }
                out.close();
            }
            zip.close();
            final boolean ok = Konfig.modellDa(this);
            runOnUiThread(() -> text.setText(ok
                    ? "Modell bereit ✅  KI-Anrufe koennen starten."
                    : "Fehler: final.mdl fehlt."));
        } catch (Exception ex) {
            runOnUiThread(() -> text.setText("Fehler: " + ex.getMessage()));
        }
    }
}
