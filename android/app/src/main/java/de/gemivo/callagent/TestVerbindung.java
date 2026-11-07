package de.gemivo.callagent;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.util.Log;

/**
 * Test-Leitung fuer Ende-zu-Ende-Tests OHNE zweites Telefon:
 * simuliert einen eingehenden Anruf ueber Telecom (gleicher Weg wie ein echter:
 * InCall.onCallAdded -> annehmen -> AudioLoop -> Server).
 * Aktivieren (einmalig, adb):
 *   adb shell telecom set-phone-account-enabled de.gemivo.callagent/.TestVerbindung callagent-test 0
 * Ausloesen:
 *   adb shell am start -n de.gemivo.callagent/.MainActivity --es testanruf +4940999000111
 */
public class TestVerbindung extends ConnectionService {

    private static final String TAG = "CallAgent";
    static final String KONTO_ID = "callagent-test";

    static PhoneAccountHandle handle(Context c) {
        return new PhoneAccountHandle(new ComponentName(c, TestVerbindung.class), KONTO_ID);
    }

    static void registrieren(Context c) {
        TelecomManager tm = c.getSystemService(TelecomManager.class);
        PhoneAccount pa = PhoneAccount.builder(handle(c), "CallAgent-Test")
                .setCapabilities(PhoneAccount.CAPABILITY_CALL_PROVIDER)
                .addSupportedUriScheme(PhoneAccount.SCHEME_TEL)
                .build();
        tm.registerPhoneAccount(pa);
    }

    static void anrufSimulieren(Context c, String nummer) {
        try {
            registrieren(c);
            TelecomManager tm = c.getSystemService(TelecomManager.class);
            Bundle extras = new Bundle();
            extras.putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS,
                    Uri.fromParts(PhoneAccount.SCHEME_TEL, nummer, null));
            tm.addNewIncomingCall(handle(c), extras);
            Log.i(TAG, "[Test] eingehender Testanruf von " + nummer + " gemeldet");
        } catch (Exception e) {
            Log.e(TAG, "[Test] Testanruf fehlgeschlagen (Konto aktiviert?): " + e);
        }
    }

    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle acc, ConnectionRequest req) {
        Uri adr = req.getExtras() == null ? null
                : req.getExtras().getParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS);
        Connection con = new Connection() {
            @Override public void onAnswer() { Log.i(TAG, "[Test] onAnswer"); setActive(); }
            @Override public void onAnswer(int vs) { onAnswer(); }
            @Override public void onReject() { ende(DisconnectCause.REJECTED); }
            @Override public void onDisconnect() { ende(DisconnectCause.LOCAL); }
            @Override public void onAbort() { ende(DisconnectCause.CANCELED); }
            private void ende(int grund) {
                Log.i(TAG, "[Test] Ende " + grund);
                setDisconnected(new DisconnectCause(grund));
                destroy();
            }
        };
        con.setAddress(adr, TelecomManager.PRESENTATION_ALLOWED);
        con.setConnectionCapabilities(Connection.CAPABILITY_SUPPORT_HOLD);
        con.setRinging();
        return con;
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle acc, ConnectionRequest req) {
        Log.e(TAG, "[Test] onCreateIncomingConnectionFailed");
    }
}
