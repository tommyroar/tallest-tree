# Project Overview

## What This Is

PNW Canopy Height Explorer — a single-page web app that visualizes tree canopy heights across the Pacific Northwest (41°–50°N, 115°–126°W). Users click a Leaflet map to analyze a 1 km² area; the Flask backend reads Meta/WRI 1m canopy-height GeoTIFFs from S3 via GDAL's `/vsicurl/`, detects tree tops with scipy local-maxima, and returns ranked trees + a grayscale PNG overlay.

## Architecture

- `server.py` — Flask backend (port 5111). All logic lives here: QuadKey tile resolution, Web Mercator ↔ WGS-84 conversion, CHM window read via rasterio, Gaussian-smoothed local-max tree detection, non-max suppression, tier classification, and RGBA overlay generation.
  - Endpoints: `/api/analyze`, `/api/overlay`, `/api/health`, `/` (serves index.html)
- `index.html` — Self-contained SPA (no build step). Leaflet map + vanilla JS + CSS. No framework, no bundled components.
- `mcp/dev-server/` — Custom MCP server (Node.js, ES modules) for managing Vite/Jupyter dev servers with Tailscale integration.
- `scripts/serve.sh` — Starts Vite + optionally exposes via Tailscale Serve.
- `scripts/deploy.sh` — Nomad-based deployment wrapper.

## Data Source

Meta/WRI Global Canopy Height Map tiles from public S3 bucket `dataforgood-fb-data`. Accessed with `AWS_NO_SIGN_REQUEST=YES` — no credentials needed. Tiles are zoom-9 QuadKey GeoTIFFs in EPSG:3857.

## Key Constants (server.py)

- `TIERS` — height classification: Common (<50m), Tall (50–70m), Regional (70–80m), National (80–90m), Global (≥90m)
- `MAE = 2.8` — mean absolute error in metres
- `QUADKEY_ZOOM = 9`, `TILE_PX = 65536`
