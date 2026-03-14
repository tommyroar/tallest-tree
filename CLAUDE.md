# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

PNW Canopy Height Explorer — a single-page web app that visualizes tree canopy heights across the Pacific Northwest (41°–50°N, 115°–126°W). Users click on a Leaflet map to analyze a 1 km² area; the Flask backend reads Meta/WRI 1 m canopy-height GeoTIFFs from S3 via GDAL's `/vsicurl/`, detects tree tops with scipy local-maxima, and returns ranked trees + a grayscale PNG overlay. A "Ground Truth Mode" in the sidebar lets field users navigate to candidate trees with GPS and compare rangefinder measurements against satellite estimates.

## Architecture

- **`server.py`** — Flask backend (port 5111). All logic lives here: QuadKey tile resolution, Web Mercator ↔ WGS-84 conversion, CHM window read via rasterio, Gaussian-smoothed local-max tree detection, non-max suppression, tier classification, and RGBA overlay generation. Endpoints: `/api/analyze`, `/api/overlay`, `/api/health`.
- **`index.html`** — Self-contained SPA (no build step). Leaflet map + vanilla JS + CSS. Fetches `/api/analyze` on map click, renders circle markers, sidebar stats, canvas bar chart, and ground-truth navigation panel.
- **Data source** — `dataforgood-fb-data.s3.amazonaws.com` CHM tiles, accessed with `AWS_NO_SIGN_REQUEST=YES`. No credentials needed.

## Commands

```bash
# Install Python deps (use the project venv)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run Flask backend
python server.py          # serves on http://localhost:5111

# Run Vite frontend dev server (port 5180, strictPort)
npm run dev

# Run fast unit tests (no network)
pytest -m "not slow"

# Run all tests including S3 integration tests
pytest

# Run Playwright browser smoke test (needs running server + network)
node tests/test_smoke.js
```

## Test Structure

- **`tests/test_helpers.py`** — Unit tests for pure functions: `_latlon_to_web_mercator`, `_latlon_to_quadkey`, `_tile_origin_meters`, `_classify`.
- **`tests/test_endpoints.py`** — Flask test client tests. Fast tests (param validation, bounds checking) run without S3. Tests marked `@pytest.mark.slow` hit real S3.
- **`tests/test_smoke.js`** — Playwright end-to-end: spawns the Flask server, opens headless Chromium, verifies UI structure, fires a map click, and asserts tree results appear.
- **`tests/test_api_error.js`** — Playwright test against Vite-only (no Flask): verifies the app shows a graceful error alert when the backend is unavailable and the loading indicator is dismissed.

## Key Constants (server.py)

- `TIERS` — height classification: Common (<50m), Tall (50–70m), Regional (70–80m), National (80–90m), Global (≥90m)
- `MAE = 2.8` — mean absolute error in metres for the CHM dataset
- `QUADKEY_ZOOM = 9`, `TILE_PX = 65536` — tile grid parameters
