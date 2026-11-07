package de.gemivo.callagent;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import android.telecom.TelecomManager;

/**
 * Screening eingehender Anrufe:
 * - Nummer im Adressbuch -> normal klingeln lassen
 * - Nummer NICHT im Adressbuch -> Anruf annehmen (acceptRingingCall)
 *   und AudioLoop (Gemma) starten. ColorOS verweigert die Dialer-Rolle,
 *   deshalb nehmen wir direkt ueber TelecomManager an.
 */
public class CallScreening extends CallScreeningService {

    private static final String TAG = "CallAgent";

    @Override
    public void onScreenCall(Call.Details details) {
        String nummer = details.getHandle() == null ? ""
                : details.getHandle().getSchemeSpecificPart();

        boolean bekannt = ContactHelper.istBekannt(this, nummer);
        boolean kiAn = Konfig.kiAktiv(this);

        // Default-Dialer: InCall nimmt an (sonst doppelte Annahme) -> hier nur durchlassen
        TelecomManager tmx = getSystemService(TelecomManager.class);
        boolean binDialer = tmx != null && getPackageName().equals(tmx.getDefaultDialerPackage());
        if (!binDialer && kiAn && !bekannt) {
            // KEIN respondToCall (ColorOS crasht darauf bei Drittanbietern).
            // Telecom behandelt den Anruf nach Timeout als erlaubt - er klingelt kurz.
            // Wir nehmen parallel selbst an:
            final CallScreening ich = this;
            final String nr = nummer;
            new Thread(() -> {
                try { Thread.sleep(900); } catch (InterruptedException e) {}
                try {
                    TelecomManager tm = getSystemService(TelecomManager.class);
                    if (tm != null && checkSelfPermission(
                            android.Manifest.permission.ANSWER_PHONE_CALLS)
                            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        android.util.Log.i(TAG, "[Screening] nehme an: " + nr);
                        tm.acceptRingingCall();
                        AudioLoop.start(ich, nr);
                    } else {
                        android.util.Log.w(TAG, "[Screening] keine Annahme-Recht");
                    }
                } catch (Exception e) {
                    android.util.Log.e(TAG, "[Screening] accept: " + e);
                }
            }, "ki-accept").start();
        } else {
            respondToCall(details, new CallScreeningService.CallResponse.Builder()
                    .setDisallowCall(false)
                    .setRejectCall(false)
                    .build());
        }
    }
}
