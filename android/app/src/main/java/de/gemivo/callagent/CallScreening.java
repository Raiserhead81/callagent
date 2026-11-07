package de.gemivo.callagent;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.Call;
import android.telecom.CallScreeningService;

/**
 * Screening eingehender Anrufe:
 * - Nummer im Adressbuch -> normal klingeln lassen
 * - Nummer NICHT im Adressbuch -> Anruf durchstellen (unsere InCallService
 *   nimmt an und startet die KI).
 */
public class CallScreening extends CallScreeningService {

    @Override
    public void onScreenCall(Call.Details details) {
        String nummer = details.getHandle() == null ? ""
                : details.getHandle().getSchemeSpecificPart();

        boolean bekannt = ContactHelper.istBekannt(this, nummer);
        boolean kiAn = Konfig.kiAktiv(this);

        // Unknown = unterdrueckte Nummer -> auch KI
        boolean unbekannt = !bekannt;

        if (kiAn && unbekannt) {
            // Erlauben (unsere InCall-App erscheint + AudioLoop nimmt an)
            respondToCall(details, new CallScreeningService.CallResponse.Builder()
                    .setSkipCallLog(false)
                    .setSkipNotification(true)
                    .build());
        } else {
            // Bekannter Kontakt oder KI aus: normales Klingeln
            respondToCall(details, new CallScreeningService.CallResponse.Builder().build());
        }
    }
}
