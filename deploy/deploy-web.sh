#!/usr/bin/env bash
# Deploy der Web-App nach gemivo:/opt/gemivo-anruf (vom Repo-Root aus aufrufen)
set -euo pipefail
G="ssh -i $HOME/.ssh/gemivo -o BatchMode=yes root@116.203.204.226"
rsync -az --delete --exclude node_modules --exclude .next --exclude .git --exclude test-results --exclude "*.tsbuildinfo" \
  -e "ssh -i $HOME/.ssh/gemivo -o BatchMode=yes" web/ root@116.203.204.226:/opt/gemivo-anruf/
$G 'set -e; cd /opt/gemivo-anruf
  for g in 192 512; do rsvg-convert -w $g -h $g public/icons/icon.svg -o public/icons/icon-$g.png; done
  rsvg-convert -w 512 -h 512 public/icons/icon-maskable.svg -o public/icons/icon-maskable-512.png
  npm ci --no-audit --no-fund >/tmp/anruf-npm.log 2>&1
  npm run build >/tmp/anruf-build.log 2>&1 || { tail -30 /tmp/anruf-build.log; exit 1; }
  systemctl restart gemivo-anruf && sleep 3 && systemctl is-active gemivo-anruf
  curl -s http://127.0.0.1:3124/VERSION'
