#!/usr/bin/env bash
#
# Deploy zafronix-wc-explorer to the studio VPS at /var/www/zafronix-wc-explorer.
# Mirrors zafronix-admin/deploy/deploy.sh: rsync + remote npm + restart.
#
# Usage:
#   ./deploy/deploy.sh             # rolling deploy
#   FIRST_RUN=1 ./deploy/deploy.sh # also drop systemd + nginx hint
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="$(dirname "$SCRIPT_DIR")"
SSH_HOST="${SSH_HOST:-zafronix}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/zafronix-wc-explorer}"

cd "$LOCAL_DIR"

echo "[1/5] Building locally…"
npm run build

echo "[2/5] Rsync to $SSH_HOST:$REMOTE_DIR …"
ssh "$SSH_HOST" "mkdir -p $REMOTE_DIR"
rsync -avz --delete \
  --exclude='/node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='/.next/cache' \
  "$LOCAL_DIR/" "$SSH_HOST:$REMOTE_DIR/"

echo "[3/5] Installing prod dependencies on remote…"
ssh "$SSH_HOST" "cd $REMOTE_DIR && /usr/bin/node /usr/lib/node_modules/npm/bin/npm-cli.js ci --omit=dev 2>&1 | tail -3"

if [ "${FIRST_RUN:-0}" = "1" ]; then
  echo "[FIRST RUN] Installing systemd unit…"
  ssh "$SSH_HOST" "cp $REMOTE_DIR/deploy/zafronix-wc-explorer.service /etc/systemd/system/zafronix-wc-explorer.service"
  ssh "$SSH_HOST" "systemctl daemon-reload && systemctl enable zafronix-wc-explorer"
  echo "  Manual on host (one-time):"
  echo "    1. Create /etc/sysconfig/zafronix-wc-explorer (mode 600) with:"
  echo "         WC_API_KEY=zwc_pk_<read-tier-key>"
  echo "    2. Add /wc-explorer/ location block to /etc/nginx/conf.d/api.zafronix.com.conf"
  echo "         (see deploy/zafronix-wc-explorer.nginx.conf for the snippet)"
  echo "    3. systemctl reload nginx && systemctl start zafronix-wc-explorer"
  exit 0
fi

echo "[4/5] Restarting zafronix-wc-explorer.service…"
ssh "$SSH_HOST" "systemctl restart zafronix-wc-explorer"

echo "[5/5] Smoke test…"
sleep 1
ssh "$SSH_HOST" "systemctl is-active zafronix-wc-explorer"
curl -sI https://api.zafronix.com/wc-explorer/ -o /dev/null -w "  /wc-explorer/ → %{http_code}\n" || true
echo "✓ Deployed."
