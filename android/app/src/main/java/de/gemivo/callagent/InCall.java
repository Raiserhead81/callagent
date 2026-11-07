package de.gemivo.callagent;

import android.net.Uri;
import android.telecom.Call;
import android.telecom.CallAudioState;
import android.telecom.InCallService;
import android.telecom.TelecomManager;
import android.util.Log;

/**
 * InCallService: laeuft als Default-Dialer (ROLE_DIALER).
 * - Eingehend + unbekannte Nummer + KI an: annehmen, Lautsprecher an, Gemma telefoniert
 * - Eingehend + bekannte Nummer: CallUI (Annehmen / Gemma uebernehmen / Auflegen)
 * - Ausgehend: nur CallUI mit Auflegen (NIE KI, NIE "annehmen")
 */
public class InCall extends InCallService {

    private static final String TAG = "CallAgent";
    private static InCall instanz;
    private static Call kiCall;

    @Override
    public void onCreate() { super.onCreate(); instanz = this; }
    @Override
    public void onDestroy() { if (instanz == this) instanz = null; super.onDestroy(); }

    @Override
    public void onCallAdded(Call call) {
        super.onCallAdded(call);
        String nummer = nummer(call);
        boolean eingehend = istEingehend(call);
        boolean bekannt = ContactHelper.istBekannt(this, nummer);
        Log.i(TAG, "onCallAdded: nummer=" + nummer + " eingehend=" + eingehend
                + " state=" + call.getState() + " bekannt=" + bekannt
                + " ki=" + Konfig.kiAktiv(this));

        boolean kiUebernimmt = eingehend && !bekannt && Konfig.kiAktiv(this);
        CallUI.setzeCall(call, nummer, kiUebernimmt, eingehend);

        if (kiUebernimmt) {
            kiCall = call;
            call.registerCallback(new Call.Callback() {
                @Override public void onStateChanged(Call c, int state) {
                    Log.i(TAG, "KI-Call state=" + state);
                    if (state == Call.STATE_ACTIVE) {
                        lautsprecher(true);
                        AudioLoop.start(InCall.this, nummer);
                    }
                }
            });
            annehmen(call);
        }
        zeigen();
    }

    /** CallUI: Kay laesst Gemma einen (bekannten) Anruf uebernehmen. */
    public static void kiCallSetzen(Call c) { kiCall = c; }

    /** Vom AudioLoop: KI ist fertig -> Anruf beenden. */
    public static void kiAuflegen() {
        Call c = kiCall;
        if (c != null) {
            Log.i(TAG, "KI legt auf");
            try { c.disconnect(); } catch (Exception e) { Log.w(TAG, "disconnect: " + e); }
        }
    }

    /** Lautsprecher: TTS laeuft ueber den Lautsprecher ins Mikro (Drittanbieter
     *  duerfen weder Downlink mitschneiden noch in den Uplink einspeisen). */
    public static void lautsprecher(boolean an) {
        InCall s = instanz;
        if (s == null) return;
        try {
            s.setAudioRoute(an ? CallAudioState.ROUTE_SPEAKER : CallAudioState.ROUTE_WIRED_OR_EARPIECE);
            Log.i(TAG, "Audio-Route -> " + (an ? "Lautsprecher" : "Hoerer"));
        } catch (Exception e) { Log.w(TAG, "setAudioRoute: " + e); }
    }

    static boolean istEingehend(Call call) {
        try {
            int dir = call.getDetails().getCallDirection();
            if (dir == Call.Details.DIRECTION_INCOMING) return true;
            if (dir == Call.Details.DIRECTION_OUTGOING) return false;
        } catch (Exception e) { /* alte Plattform */ }
        return call.getState() == Call.STATE_RINGING;
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
            Log.i(TAG, "answer() gesendet");
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
        if (call == kiCall) { kiCall = null; AudioLoop.stop(); }
        CallUI.setzeCall(null, "", false, false);
        super.onCallRemoved(call);
    }

    private String nummer(Call call) {
        try {
            Uri h = call.getDetails().getHandle();
            return h == null ? "" : h.getSchemeSpecificPart();
        } catch (Exception e) { return ""; }
    }
}
