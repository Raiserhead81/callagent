package de.gemivo.callagent;

import android.accessibilityservice.AccessibilityService;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/** Leerer Bedienungshilfen-Dienst: nur damit die Mikro-Aufnahme im Anruf nicht stummgeschaltet wird. */
public class AudioHelfer extends AccessibilityService {
    static volatile boolean aktiv;
    @Override protected void onServiceConnected() { aktiv = true; Log.i("CallAgent", "AudioHelfer verbunden"); }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) { }
    @Override public void onInterrupt() { }
    @Override public void onDestroy() { aktiv = false; super.onDestroy(); }
}
