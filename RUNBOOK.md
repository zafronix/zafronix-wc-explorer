# Zafronix WC Explorer — Operations Runbook

Last verified: 2026-05-19. Companion doc to
[`zafronix-wc-api/RUNBOOK.md`](https://github.com/zafronix/zafronix-wc-api/blob/main/RUNBOOK.md) —
this is the simpler service. If you're rebuilding from scratch on a
new host, do **wc-api first** (the explorer depends on it). Jump to
[§ 5 Bootstrap from scratch](#5-bootstrap-from-scratch).

## Contents

1. [What it is](#1-what-it-is)
2. [Topology](#2-topology)
3. [Configuration & secrets](#3-configuration--secrets)
4. [Routine deployment](#4-routine-deployment)
5. [Bootstrap from scratch](#5-bootstrap-from-scratch)
6. [Routine operations](#6-routine-operations)
7. [Disaster recovery](#7-disaster-recovery)

---

## 1. What it is

A **Next.js 16 sample dashboard** at `https://api.zafronix.com/wc-explorer/`,
mounted under `basePath: '/wc-explorer'`. Its job is to demo what
the wc-api can do — chart tournaments, drill into matches, show
referee/player stats, etc.

**No data of its own.** Every page fetches from the wc-api over
loopback at `http://127.0.0.1:3200`. The explorer is stateless;
restart, redeploy, or replace it freely.

### Components

| Component | Purpose | Storage |
|---|---|---|
| Next.js server | Server-rendered React, fetches wc-api | None |
| `.next/cache/fetch-cache/` | Disk cache for wc-api responses (24h TTL on most endpoints) | Disk, transient |
| `src/lib/wc-api.ts` | Typed client for wc-api endpoints | In-process |
| `src/app/robots.ts` | Layer-1 bot block list (companion to wc-api's nginx layer-2) | Generated `/robots.txt` |

### Why no DB

Same reason wc-api has no DB — the data is read-mostly and lives one
hop away as JSON. Caching at the Next.js fetch layer is enough.

---

## 2. Topology

| Item | Value |
|---|---|
| Host | `siono-prod` (same VPS as wc-api) |
| Port | `3400` (loopback only) |
| Service | `zafronix-wc-explorer.service` |
| Install path | `/var/www/zafronix-wc-explorer/` |
| URL mount | `https://api.zafronix.com/wc-explorer/` (basePath) |
| Upstream | `http://127.0.0.1:3200` (wc-api on same host) |

### nginx routing

The explorer location block lives in **wc-api's vhost** at
`/etc/nginx/conf.d/api.zafronix.com.conf` — there's no separate
explorer vhost. The relevant snippet (from the wc-api repo's nginx
conf):

```nginx
location /wc-explorer/ {
    limit_req zone=wc_explorer_per_ip burst=50 nodelay;
    proxy_pass http://127.0.0.1:3400/wc-explorer/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
}
location = /wc-explorer {
    return 308 /wc-explorer/;     # trailing-slash redirect
}
```

The bot-block map applied at the vhost level (`if ($blocked_ua) { return 403; }`)
**also protects the explorer** — same defense layer for both
services. See `zafronix-wc-api/deploy/blocked-bots.nginx.conf`.

---

## 3. Configuration & secrets

### Environment variables (in `zafronix-wc-explorer.service`)

| Var | Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Toggles dev shortcuts |
| `PORT` | `3400` | Next.js listen port (loopback) |

### Secrets — `/etc/sysconfig/zafronix-wc-explorer` (root:root, 0600)

| Name | Purpose | How to get one |
|---|---|---|
| `WC_API_KEY` | Read-tier API key the explorer uses to call wc-api over loopback | Provisioned via the wc-api admin dashboard at `/admin`; create a "read" tier key with no rate cap (loopback bypasses the IP cap anyway) |

No Stripe, email, Turnstile, or dashboard auth — those all live on
the wc-api side. The explorer needs exactly one secret.

---

## 4. Routine deployment

```bash
cd ~/Desktop/zafronix-wc-explorer
./deploy/deploy.sh
```

What it does (54 lines):

1. `npm run build` — Next.js production build → `.next/`
2. `rsync -avz --delete` to `zafronix:/var/www/zafronix-wc-explorer/` — excludes `node_modules`, `.git`, `.env*`, `.next/cache`
3. `ssh zafronix 'cd ... && npm ci --omit=dev'` — prod deps remote
4. `systemctl restart zafronix-wc-explorer`
5. Smoke test: `curl -I https://api.zafronix.com/wc-explorer/`

Typical deploy time: **15–25 seconds** (Next.js build is the long part).

### When to also bust fetch cache

When wc-api ships **dataset changes** (qwen merge, squad sync,
manual JSON edit), the explorer's fetch-cache holds stale responses
for up to 24h. Bust it:

```bash
ssh zafronix 'find /var/www/zafronix-wc-explorer/.next/cache/fetch-cache -mindepth 1 -delete && systemctl restart zafronix-wc-explorer'
```

The wc-api deploy script doesn't do this automatically — the
explorer's cache is its own concern, and code-only changes to the
explorer don't need it.

---

## 5. Bootstrap from scratch

> **Pre-req:** wc-api must already be running on this host (the
> explorer fetches from `127.0.0.1:3200`). Follow
> [`zafronix-wc-api/RUNBOOK.md` § 6](https://github.com/zafronix/zafronix-wc-api/blob/main/RUNBOOK.md#6-bootstrap-from-scratch)
> first, then come back here.

### Phase A — Add nginx routing to the existing api.zafronix.com vhost

The wc-api vhost already exists; the explorer just needs the
location blocks added. See `deploy/zafronix-wc-explorer.nginx.conf`
for the snippet — append it inside the existing `server { listen 443 ssl ... }`
block. The relevant lines (already shown in [§ 2](#2-topology)) go
above the catch-all `location / { proxy_pass http://127.0.0.1:3200; }`.

Then:

```bash
ssh zafronix 'sudo nginx -t && sudo systemctl reload nginx'
```

### Phase B — First deploy

```bash
cd ~/Desktop/zafronix-wc-explorer
FIRST_RUN=1 ./deploy/deploy.sh
```

This:
- builds Next.js locally
- rsyncs to `/var/www/zafronix-wc-explorer/`
- installs prod deps remotely
- copies `deploy/zafronix-wc-explorer.service` → `/etc/systemd/system/`
- runs `systemctl daemon-reload && systemctl enable zafronix-wc-explorer`
- stops without starting (you need to provision the API key first)

### Phase C — Provision the API key

1. Create a read-tier key via wc-api's admin dashboard at
   `https://api.zafronix.com/admin` (sign in with `DASHBOARD_AUTH_SECRET`).
2. Save it to the explorer's sysconfig:

   ```bash
   ssh zafronix 'sudo tee /etc/sysconfig/zafronix-wc-explorer > /dev/null <<EOF
   WC_API_KEY=zwc_pk_…
   EOF
   sudo chmod 0600 /etc/sysconfig/zafronix-wc-explorer
   sudo chown root: /etc/sysconfig/zafronix-wc-explorer'
   ```

### Phase D — Start + verify

```bash
ssh zafronix 'sudo systemctl start zafronix-wc-explorer'
curl -I https://api.zafronix.com/wc-explorer/
# Expect: HTTP/2 200
```

---

## 6. Routine operations

### Restart

```bash
ssh zafronix 'sudo systemctl restart zafronix-wc-explorer'
```

### Tail logs

```bash
ssh zafronix 'sudo journalctl -u zafronix-wc-explorer -f'
```

### Cache management

The Next.js fetch cache lives at `.next/cache/fetch-cache/`. Most
dataset endpoints carry `revalidate: 86400` (24h). To force fresh:

```bash
# Selective:  bust just the fetch cache (recommended)
ssh zafronix 'find /var/www/zafronix-wc-explorer/.next/cache/fetch-cache -mindepth 1 -delete && systemctl restart zafronix-wc-explorer'

# Aggressive: bust everything (rarely needed; takes longer to warm)
ssh zafronix 'find /var/www/zafronix-wc-explorer/.next/cache -mindepth 1 -delete && systemctl restart zafronix-wc-explorer'
```

### Update bot block list

The explorer hosts `/wc-explorer/robots.txt` via `src/app/robots.ts`.
That's **layer 1** (compliant bots). Layer 2 (nginx 403 for
non-compliant bots) lives in the wc-api repo's
`deploy/blocked-bots.nginx.conf` and applies host-wide. Keep both
in sync when adding/removing bots.

---

## 7. Disaster recovery

### "Explorer is 502'ing"

```bash
ssh zafronix 'sudo journalctl -u zafronix-wc-explorer -n 50 --no-pager'
```

Common causes:
- wc-api is down (explorer can't reach `127.0.0.1:3200`) → fix wc-api first
- Missing `WC_API_KEY` in sysconfig → API rejects requests
- Port `3400` already taken → `ss -tlnp | grep 3400`
- `.next/` missing → did `npm run build` complete during deploy?

### "I need to rebuild on a new host"

Follow [§ 5](#5-bootstrap-from-scratch). Nothing migration-specific —
explorer is stateless. The only "data" it has is the fetch cache,
and that rebuilds in minutes once the service is up.

### "The robots.txt change isn't reflected"

The robots route is generated at build time via Next.js metadata
routes. Rebuild + redeploy is the only path:

```bash
cd ~/Desktop/zafronix-wc-explorer
./deploy/deploy.sh
```

---

## Appendix: file/path inventory

```
LAPTOP                                  HOST
~/Desktop/zafronix-wc-explorer/  ─rsync→   /var/www/zafronix-wc-explorer/
├── src/                                  ├── .next/             (built)
├── public/                               ├── public/
├── deploy/                               ├── deploy/
│   ├── deploy.sh                         │
│   ├── zafronix-wc-explorer.service ─install→  /etc/systemd/system/zafronix-wc-explorer.service
│   └── zafronix-wc-explorer.nginx.conf ─append→ /etc/nginx/conf.d/api.zafronix.com.conf
│                                              (appended to the existing wc-api vhost, NOT a separate file)
├── next.config.ts                        └── next.config.ts
└── package.json                          
                                          /etc/sysconfig/zafronix-wc-explorer  (WC_API_KEY)
                                          # No own TLS cert / vhost — uses wc-api's via path mount
```
