#!/usr/bin/env bash
# NUR MIT KAYS OK AUSFUEHREN: erzeugt den Upload-Schluessel fuer de.gemivo.callagent (Play App Signing)
# und signiert das AAB. Schluessel-Datei + Passwort sicher aufbewahren (Verlust = Ruecksetzung beim Play-Support noetig).
# Aufruf auf gemivo:  bash /opt/callagent-play/play-signieren.sh
set -euo pipefail
D=/opt/callagent-play; KS=$D/anruf-upload.jks; AAB=$(ls -t $D/gemivo-anruf-*-UNSIGNIERT.aab | head -1)
if [ ! -f "$KS" ]; then
  read -rsp "Neues Keystore-Passwort (mind. 12 Zeichen): " PW; echo
  keytool -genkeypair -v -keystore "$KS" -alias upload -keyalg RSA -keysize 4096 -validity 9125 \
    -storepass "$PW" -keypass "$PW" -dname "CN=Kay Conrad, O=gemivo, L=Luebeck, C=DE"
  chmod 600 "$KS"; echo "$PW" > $D/.anruf-upload-pass; chmod 600 $D/.anruf-upload-pass
fi
PW=$(cat $D/.anruf-upload-pass)
OUT=${AAB%-UNSIGNIERT.aab}-signiert.aab
cp "$AAB" "$OUT"
jarsigner -keystore "$KS" -storepass "$PW" -sigalg SHA256withRSA -digestalg SHA-256 "$OUT" upload
jarsigner -verify "$OUT" | tail -1
keytool -list -v -keystore "$KS" -storepass "$PW" | grep -E "SHA256:" | head -1
echo "Fertig: $OUT  -> in der Play Console hochladen"
