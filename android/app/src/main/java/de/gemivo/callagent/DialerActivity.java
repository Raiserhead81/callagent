package de.gemivo.callagent;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Leere Dialer-Activity: registriert die App als Telefon-App (Role-Pflicht),
 *  oeffnet beim Oeffnen einfach die Haupt-UI. */
public class DialerActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startActivity(new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }
}
