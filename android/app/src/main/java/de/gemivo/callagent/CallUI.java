package de.gemivo.callagent;

import android.app.Activity;
import android.os.Bundle;
import android.telecom.Call;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

/**
 * Anruf-Oberflaeche (fuer bekannte Nummern; unbekannte nimmt die KI automatisch).
 * Geoeffnet vom InCallService via showInCallUI().
 */
public class CallUI extends Activity {

    private static Call aktuellerCall;
    private static String nummerText;
    private static boolean kiModus;

    public static void setzeCall(Call c, String nummer, boolean ki) {
        aktuellerCall = c; nummerText = nummer; kiModus = ki;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.callui);

        TextView tvNummer = findViewById(R.id.rufnummer);
        TextView tvStatus = findViewById(R.id.call_status);
        Button btnAnnehmen = findViewById(R.id.btn_annehmen);
        Button btnAuflegen = findViewById(R.id.btn_auflegen);
        Button btnKi = findViewById(R.id.btn_ki_uebernehmen);

        tvNummer.setText(nummerText == null || nummerText.isEmpty()
                ? "Unbekannte Nummer" : nummerText);

        if (kiModus) {
            tvStatus.setText("🤖 Gemma telefoniert für dich ...\n(siehe Protokoll)");
            btnAnnehmen.setVisibility(View.GONE);
            btnKi.setVisibility(View.GONE);
        } else {
            tvStatus.setText("Eingehender Anruf");
            btnAnnehmen.setVisibility(View.VISIBLE);
            btnKi.setVisibility(View.VISIBLE);
        }

        final Call call = aktuellerCall;
        if (call != null) {
            call.registerCallback(new Call.Callback() {
                @Override public void onStateChanged(Call c, int state) {
                    runOnUiThread(() -> {
                        if (state == Call.STATE_ACTIVE && !kiModus)
                            tvStatus.setText("Gespräch läuft");
                        if (state == Call.STATE_DISCONNECTED) finish();
                    });
                }
            });
        }

        btnAnnehmen.setOnClickListener(v -> {
            try { if (call != null) call.answer(
                    android.telecom.VideoProfile.STATE_AUDIO_ONLY); } catch (Exception e) {}
            tvStatus.setText("Gespräch läuft");
            btnAnnehmen.setVisibility(View.GONE);
        });

        btnAuflegen.setOnClickListener(v -> {
            try { if (call != null) call.disconnect(); } catch (Exception e) {}
            finish();
        });

        btnKi.setOnClickListener(v -> {
            kiModus = true;
            try { if (call != null) call.answer(
                    android.telecom.VideoProfile.STATE_AUDIO_ONLY); } catch (Exception e) {}
            AudioLoop.start(this, nummerText == null ? "" : nummerText);
            tvStatus.setText("🤖 Gemma telefoniert für dich ...");
            btnAnnehmen.setVisibility(View.GONE);
            btnKi.setVisibility(View.GONE);
        });
    }
}
