# zafronix-wc-explorer

Public sample dashboard for the [Zafronix WC API](https://api.zafronix.com/docs).
Hosted at [api.zafronix.com/wc-explorer/](https://api.zafronix.com/wc-explorer/).

The whole point of this app is to be a **showcase** — every chart, every stat,
every table is one or two HTTP calls to the WC API. Read the source if you want
to see how to consume the API for your own project.

## Stack

- **Next.js 16** (App Router, server components by default)
- **Tailwind CSS** (matches Zafronix brand: `ink-*` greys, `brand-*` purple)
- **Recharts** for visualizations
- **No database** — pure read-through to api.zafronix.com

## Pages

| URL | Purpose |
|---|---|
| `/wc-explorer/` | Landing dashboard — every tournament, big-numbers, charts, leaderboards |
| `/wc-explorer/{year}/` | Per-tournament drill-down with podium, top scorers, KO bracket trail |
| `/wc-explorer/compare/?years=…` | Multi-tournament side-by-side with charts |

## Local dev

```sh
echo "WC_API_KEY=zwc_pk_xxx" > .env.local
npm install
npm run dev    # http://localhost:3400/wc-explorer/
```

## Deploy

```sh
./deploy/deploy.sh             # rolling deploy
FIRST_RUN=1 ./deploy/deploy.sh # first-time setup (systemd + nginx hint)
```

Routes through nginx on the studio VPS — see `deploy/zafronix-wc-explorer.nginx.conf`
for the location-block snippet to add inside the existing `api.zafronix.com` vhost.

**See [RUNBOOK.md](RUNBOOK.md)** for architecture, topology, secrets,
deployment, and full bootstrap-from-scratch instructions (e.g.
rebuilding on a new host).
