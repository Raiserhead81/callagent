#!/usr/bin/env bash
# Erzeugt /etc/asterisk/pjsip_callagent.conf aus /opt/callagent/sip.env und laedt PJSIP neu.
# Aufruf: /opt/callagent/sip/sip-konfig.sh   (idempotent)
set -euo pipefail
ENV=/opt/callagent/sip.env
ZIEL=/etc/asterisk/pjsip_callagent.conf
[ -f "$ENV" ] || { echo "FEHLER: $ENV fehlt (Vorlage: sip.env.beispiel)"; exit 1; }
[ "$(stat -c %a "$ENV")" = "600" ] || { chmod 600 "$ENV"; echo "Hinweis: $ENV auf 600 gesetzt"; }
set -a; . "$ENV"; set +a
: "${SIP_MODUS:=aus}" "${SIP_PORT:=5060}" "${SIP_CODECS:=alaw,ulaw}"
TMP=$(mktemp)
echo "; erzeugt von sip-konfig.sh am $(date -Is) - Modus: $SIP_MODUS - NICHT von Hand aendern" > "$TMP"
if [ "$SIP_MODUS" != "aus" ]; then
  for v in SIP_SERVER SIP_USER SIP_PASS; do
    [ -n "${!v:-}" ] || { echo "FEHLER: $v leer in $ENV"; rm -f "$TMP"; exit 1; }
  done
  DOMAIN=${SIP_DOMAIN:-$SIP_SERVER}
  AUTHU=${SIP_AUTH_USER:-$SIP_USER}
  {
    if [ -n "${SIP_BIND_IP:-}" ]; then
      cat <<T
[transport-anbieter]
type=transport
protocol=udp
bind=${SIP_BIND_IP}:5062
T
      TP="transport=transport-anbieter"
    else
      TP="transport=transport-udp"
    fi
    cat <<T

[anbieter-auth]
type=auth
auth_type=userpass
username=${AUTHU}
password=${SIP_PASS}

[anbieter]
type=aor
contact=sip:${SIP_SERVER}:${SIP_PORT}
qualify_frequency=60

[anbieter]
type=endpoint
${TP}
context=callagent-in
disallow=all
allow=${SIP_CODECS}
outbound_auth=anbieter-auth
aors=anbieter
from_user=${SIP_USER}
from_domain=${DOMAIN}
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
dtmf_mode=rfc4733

[anbieter]
type=identify
endpoint=anbieter
match=${SIP_SERVER}

[anbieter-reg]
type=registration
${TP}
outbound_auth=anbieter-auth
server_uri=sip:${SIP_SERVER}:${SIP_PORT}
client_uri=sip:${SIP_USER}@${DOMAIN}
contact_user=${SIP_USER}
retry_interval=60
forbidden_retry_interval=600
expiration=300
line=yes
endpoint=anbieter
T
  } >> "$TMP"
fi
install -m 640 -o root -g asterisk "$TMP" "$ZIEL"; rm -f "$TMP"
asterisk -rx "module reload res_pjsip.so" >/dev/null
sleep 2
echo "OK: Modus $SIP_MODUS geschrieben nach $ZIEL"
asterisk -rx "pjsip show registrations" | sed -n '1,12p'
