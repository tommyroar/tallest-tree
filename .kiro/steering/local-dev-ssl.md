---
inclusion: auto
---

# Local Dev SSL & Tailscale Serve

## HTTPS Setup

Vite uses `@vitejs/plugin-basic-ssl` to serve HTTPS locally with a self-signed cert. This is required because:
- The Geolocation API (`navigator.geolocation`) requires a secure context (HTTPS)
- The "click to locate" feature depends on geolocation
- Tailscale Serve expects the upstream to be HTTPS (`https+insecure://localhost:PORT`)

## Two Access Paths

### 1. Local (localhost)
- URL: `https://localhost:5180`
- Cert: self-signed via `@vitejs/plugin-basic-ssl` (browser will warn on first visit, click through)
- Use for: local dev on the Mac Mini itself

### 2. Tailscale (off-device, e.g. iPad)
- URL: `https://tommys-mac-mini.tail59a169.ts.net/tallest-trees`
- Cert: valid Tailscale-managed cert (no browser warning)
- Tailscale Serve proxies to `https+insecure://localhost:5180` — the `+insecure` flag tells it to accept the self-signed local cert
- Use for: testing on iPad or any device on the tailnet

## Starting the Dev Server (ALWAYS start both together)

When starting the dev environment, ALWAYS start BOTH Flask and Vite together. Never start one without the other. Vite proxies `/api` to Flask on port 5111 — if Flask isn't running, the frontend shows "Backend unavailable".

### Startup sequence:
1. Start Flask backend: `source .venv/bin/activate && python server.py` (background process, port 5111)
2. Start Vite via MCP tool: `dev_server_start` with `type: "vite"`, `project_dir: "/Users/tommydoerr/dev/tallest-tree"`, `port: 5180`, `tailscale_path: "/tallest-trees"`
3. If Tailscale Serve wasn't set up by the MCP tool, run: `tailscale serve --bg --set-path /tallest-trees "https+insecure://localhost:5180"`
4. Verify both ports are listening before declaring success

### Via npm scripts
- `npm run serve` — starts Vite + Tailscale Serve (uses `scripts/serve.sh`), but you still need Flask running separately
- `npm run serve:kill` — stops both Vite and Tailscale Serve
- `npm run dev` — starts Vite only (no Tailscale)

## How Tailscale Serve Works

`scripts/serve.sh` and `mcp/dev-server/lib/tailscale.js` both run:
```bash
tailscale serve --bg --set-path /tallest-trees https+insecure://localhost:5180
```

This tells Tailscale to:
1. Listen on the machine's Tailscale HTTPS hostname
2. Proxy requests at `/tallest-trees` to the local Vite server
3. Accept the self-signed cert (`+insecure`)

To remove: `tailscale serve --set-path /tallest-trees off`

## Clickable Links (ALWAYS)

After starting a dev server, ALWAYS output clickable markdown links for the user. This is non-negotiable.

- Local: https://localhost:5180
- Tailscale: https://tommys-mac-mini.tail59a169.ts.net/tallest-trees

If Tailscale Serve was not set up, only show the local link. Always show whichever links are active.

## Key Files
- `vite.config.js` — Vite config with `basicSsl()` plugin, proxy rules, and allowed hosts
- `scripts/serve.sh` — Shell script for starting Vite + Tailscale Serve
- `mcp/dev-server/lib/servers.js` — MCP tool's Vite start logic
- `mcp/dev-server/lib/tailscale.js` — MCP tool's Tailscale Serve helpers
