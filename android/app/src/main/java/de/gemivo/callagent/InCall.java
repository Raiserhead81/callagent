package de.gemivo.callagent;

import android.net.Uri;
import android.telecom.Call;
import android.telecom.InCallService;
import android.telecom.TelecomManager;
import android.util.Log;

/**
 * InCallService: laeuft als Default-Dialer.
 * - Unbekannte Nummer + KI an: automatisch annehmen, Gemma telefonierts
 * - Bekannte Nummer: CallUI zeigen (Annehmen-Button)
 */
public class InCall extends InCallService {

    private static final String TAG = "CallAgent";

    @Override
    public void onCallAdded(Call call) {
        super.onCallAdded(call);
        String nummer = nummer(call);
        boolean bekannt = ContactHelper.istBekannt(this, nummer);
        Log.i(TAG, "onCallAdded: nummer=" + nummer + " bekannt=" + bekannt
                + " ki=" + Konfig.kiAktiv(this));

        boolean kiUebernimmt = !bekannt && Konfig.kiAktiv(this);
        CallUI.setzeCall(call, nummer, kiUebernimmt);

        if (kiUebernimmt) {
            annehmen(call);
            AudioLoop.start(this, nummer);
        } else {
            // Bekannter Anruf: eigene Anruf-Oberflaeche zeigen
            zeigen();
        }
    }

    private void zeigen() {
        try {
            android.content.Intent i = new android.content.Intent(this, CallUI.class);
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Log.w(TAG, "CallUI: " + e);
        }
    }

    private void annehmen(Call call) {
        try {
            call.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY);
        } catch (Exception e) {
            Log.w(TAG, "answer: " + e);
            try {
                TelecomManager tm = getSystemService(TelecomManager.class);
                if (tm != null && checkSelfPermission(
                        android.Manifest.permission.ANSWER_PHONE_CALLS)
                        == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    tm.acceptRingingCall();
                }
            } catch (Exception e2) {
                Log.e(TAG, "acceptRingingCall: " + e2);
            }
        }
    }

    @Override
    public void onCallRemoved(Call call) {
        Log.i(TAG, "onCallRemoved");
        AudioLoop.stop();
        CallUI.setzeCall(null, "", false);
        super.onCallRemoved(call);
    }

    private String nummer(Call call) {
        try {
            Uri h = call.getDetails().getHandle();
            return h == null ? "" : h.getSchemeSpecificPart();
        } catch (Exception e) { return ""; }
    }
}
