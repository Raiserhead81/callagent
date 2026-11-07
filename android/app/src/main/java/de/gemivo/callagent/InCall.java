package de.gemivo.callagent;

import android.net.Uri;
import android.os.Bundle;
import android.telecom.Call;
import android.telecom.InCallService;
import android.telecom.TelecomManager;
import android.util.Log;

/**
 * InCallService: laeuft als Default-Dialer. Bei unbekannter Nummer
 * nimmt er an und startet den AudioLoop (KI).
 */
public class InCall extends InCallService {

    private static final String TAG = "CallAgent";

    @Override
    public void onCallAdded(Call call) {
        super.onCallAdded(call);
        String nummer = nummer(call);
        boolean bekannt = ContactHelper.istBekannt(this, nummer);

        if (!bekannt && Konfig.kiAktiv(this)) {
            // KI-Modus: annehmen + AudioLoop starten
            try {
                call.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY);
            } catch (Exception e) {
                // Fallback fuer Geraete, die answer() blocken:
                TelecomManager tm = getSystemService(TelecomManager.class);
                if (tm != null) {
                    if (checkSelfPermission(android.Manifest.permission.ANSWER_PHONE_CALLS)
                            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        tm.acceptRingingCall();
                    }
                }
            }
            AudioLoop.start(this, nummer);
        }
        // Bekannte Nummern: Standard-Klingeln (Screening hat schon reguliert;
        // hier nichts tun - kein UI noetig, Standard-Telefon-UI des Systems fehlt
        // bewusst, wir lassen den Anruf normal laufen, der Nutzer nimmt selbst ab.)
    }

    @Override
    public void onCallRemoved(Call call) {
        AudioLoop.stop();
        super.onCallRemoved(call);
    }

    private String nummer(Call call) {
        try {
            Uri h = call.getDetails().getHandle();
            return h == null ? "" : h.getSchemeSpecificPart();
        } catch (Exception e) { return ""; }
    }
}
