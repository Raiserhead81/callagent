package de.gemivo.callagent;

import android.Manifest;
import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.telecom.TelecomManager;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private TextView statusText;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.main);

        statusText = findViewById(R.id.status);
        Button btnDialer = findViewById(R.id.btn_dialer);
        Button btnRechte = findViewById(R.id.btn_rechte);
        Button btnModell = findViewById(R.id.btn_modell);
        Button btnLog = findViewById(R.id.btn_log);
        Button btnToken = findViewById(R.id.btn_token);
        android.widget.EditText tokenEingabe = findViewById(R.id.token_eingabe);
        Switch swKi = findViewById(R.id.sw_ki);

        btnToken.setOnClickListener(v -> {
            String t = tokenEingabe.getText().toString().trim();
            if (t.length() < 10) {
                Toast.makeText(this, "Token sieht zu kurz aus", Toast.LENGTH_SHORT).show();
                return;
            }
            Konfig.setzeToken(this, t);
            Toast.makeText(this, "Token gespeichert ✅", Toast.LENGTH_SHORT).show();
        });

        btnDialer.setOnClickListener(v -> frageDialerRolle());
        btnRechte.setOnClickListener(v -> frageRechte());
        btnModell.setOnClickListener(v ->
            startActivity(new Intent(this, ModellDownload.class)));
        btnLog.setOnClickListener(v -> {
            String cfg = Konfig.lade(this);
            android.net.Uri u = android.net.Uri.parse("https://callagent.gemivo.de/log?token="
                + Konfig.token(this));
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        });

        swKi.setOnCheckedChangeListener((btn, on) -> Konfig.setzeKiAktiv(this, on));
        swKi.setChecked(Konfig.kiAktiv(this));

        aktualisiereStatus();
    }

    @Override
    protected void onResume() { super.onResume(); aktualisiereStatus(); }

    private void frageDialerRolle() {
        RoleManager rm = getSystemService(RoleManager.class);
        if (rm.isRoleAvailable(RoleManager.ROLE_DIALER)
                && !rm.isRoleHeld(RoleManager.ROLE_DIALER)) {
            startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_DIALER), 1);
        } else {
            Toast.makeText(this, "CallAgent ist bereits Standard-Telefon-App", Toast.LENGTH_SHORT).show();
        }
    }

    private void frageRechte() {
        requestPermissions(new String[]{
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ANSWER_PHONE_CALLS,
            Manifest.permission.POST_NOTIFICATIONS
        }, 2);
    }

    private void aktualisiereStatus() {
        TelecomManager tm = getSystemService(TelecomManager.class);
        boolean dialer = "de.gemivo.callagent".equals(tm.getDefaultDialerPackage());
        boolean rechte = checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.READ_CONTACTS)
                == PackageManager.PERMISSION_GRANTED;
        boolean modell = Konfig.modellDa(this);
        boolean ki = Konfig.kiAktiv(this);

        StringBuilder s = new StringBuilder();
        s.append(dialer ? "✅" : "❌").append(" Standard-Telefon-App (nötig für Audio)\n");
        s.append(rechte ? "✅" : "❌").append(" Rechte (Kontakte, Mikrofon)\n");
        s.append(modell ? "✅" : "❌").append(" Vosk-Sprachmodell offline\n");
        s.append(ki ? "✅" : "⏸️").append(" KI-Annahme unbekannter Anrufe\n");
        s.append("\nBekannte Nummern klingeln normal.\n");
        s.append("Unbekannte Nummern: Gemma nimmt an.");
        statusText.setText(s.toString());
    }
}
