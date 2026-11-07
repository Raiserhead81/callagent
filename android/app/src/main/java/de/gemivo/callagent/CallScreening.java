package de.gemivo.callagent;

import android.telecom.Call;
import android.telecom.CallScreeningService;

/**
 * Screening eingehender Anrufe (App haelt nur ROLE_CALL_SCREENING, nicht Dialer):
 * - Nummer im Adressbuch (oder KI aus, oder ausgehend) -> normal klingeln lassen
 * - Nummer NICHT im Adressbuch / unterdrueckt -> Anruf ABLEHNEN.
 *   Das Netz wertet das als "besetzt" und leitet per Rufumleitung bei besetzt
 *   (**67*<eigene Gemma-Nummer>#) auf die FritzBox-/SIP-Nummer -> Gemma am Server (SIP, je Nutzer).
 * Grund: Android laesst Fremd-Apps im Mobilfunkanruf weder Mikro noch Einspeisen zu.
 */
public class CallScreening extends CallScreeningService {

    private static final String TAG = "CallAgent";

    @Override
    public void onScreenCall(Call.Details details) {
        String nummer = details.getHandle() == null ? ""
                : details.getHandle().getSchemeSpecificPart();
        boolean eingehend = details.getCallDirection() == Call.Details.DIRECTION_INCOMING;
        // Sicherung: ohne Kontakte-Recht ist jeder "unbekannt" -> dann NIE ablehnen
        boolean kontakteOk = checkSelfPermission(android.Manifest.permission.READ_CONTACTS)
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
        boolean anGemma = eingehend && kontakteOk && Konfig.kiAktiv(this)
                && !ContactHelper.istBekannt(this, nummer);

        android.util.Log.i(TAG, "[Screening] " + (anGemma ? "an Gemma (abgelehnt): " : "durchlassen: ") + nummer
                + (kontakteOk ? "" : " [kein Kontakte-Recht]"));
        respondToCall(details, new CallScreeningService.CallResponse.Builder()
                .setDisallowCall(anGemma)
                .setRejectCall(anGemma)
                .setSkipCallLog(false)
                .setSkipNotification(anGemma)
                .build());
    }
}
