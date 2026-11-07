package de.gemivo.callagent;

import android.telecom.Call;
import android.telecom.InCallService;
import android.telecom.TelecomManager;
import android.util.Log;

/**
 * UI-loser InCallService ("Call Companion"): wird von Telecom OHNE Dialer-Rolle
 * gebunden (Registrierung: telecom add-or-remove-call-companion-app).
 * Uebernimmt bei unbekannten Nummern automatisch (Gemma), bei bekannten passiert
 * hier nichts (die OPPO-Telefon-UI klingelt normal).
 */
public class InCallControl extends InCallService {

    private static final String TAG = "CallAgent";

    @Override
    public void onCallAdded(Call call) {
        super.onCallAdded(call);
        String nummer = nummer(call);
        boolean bekannt = ContactHelper.istBekannt(this, nummer);
        Log.i(TAG, "[Control] onCallAdded nummer=" + nummer + " bekannt=" + bekannt
                + " ki=" + Konfig.kiAktiv(this));
        // Nur wenn NICHT Default-Dialer (sonst uebernimmt InCall) und nur eingehend
        TelecomManager tmx = getSystemService(TelecomManager.class);
        boolean binDialer = tmx != null && getPackageName().equals(tmx.getDefaultDialerPackage());
        if (!binDialer && InCall.istEingehend(call) && !bekannt && Konfig.kiAktiv(this)) {
            try {
                call.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY);
            } catch (Exception e) {
                Log.w(TAG, "[Control] answer: " + e);
                try {
                    TelecomManager tm = getSystemService(TelecomManager.class);
                    if (tm != null && checkSelfPermission(
                            android.Manifest.permission.ANSWER_PHONE_CALLS)
                            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        tm.acceptRingingCall();
                    }
                } catch (Exception e2) { Log.e(TAG, "[Control] accept: " + e2); }
            }
            CallUI.setzeCall(call, nummer, true, true);
            AudioLoop.start(this, nummer);
        }
    }

    @Override
    public void onCallRemoved(Call call) {
        Log.i(TAG, "[Control] onCallRemoved");
        AudioLoop.stop();
        super.onCallRemoved(call);
    }

    private String nummer(Call call) {
        try {
            android.net.Uri h = call.getDetails().getHandle();
            return h == null ? "" : h.getSchemeSpecificPart();
        } catch (Exception e) { return ""; }
    }
}
