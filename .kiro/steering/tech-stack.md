# Tech Stack & Dependencies

## Python Backend
- Python 3.11+
- Flask + flask-cors for the API server
- rasterio + GDAL for reading GeoTIFF canopy height tiles from S3
- numpy + scipy for array processing and local-maxima tree detection
- Pillow for generating RGBA overlay PNGs
- ruff for linting and formatting

## Frontend
- Vanilla JS — no framework, no build step for the app itself
- Leaflet.js (CDN) for the interactive map
- Fonts: DM Sans + JetBrains Mono (Google Fonts)
- Vite 8 as dev server (proxy `/api` to Flask on port 5111)

## MCP Dev Server (`mcp/dev-server/`)
- Node.js ES modules (`"type": "module"`)
- `@modelcontextprotocol/sdk` for MCP server implementation
- Biome for linting/formatting (scoped to `mcp/**` only)
- Tests: Node.js built-in test runner (`node --test`)

## Testing
- Python: pytest (markers: `slow` for S3 integration tests)
- JS: vitest with jsdom environment for unit tests
- E2E: Playwright (`tests/test_smoke.js`, `tests/test_api_error.js`)

## Infrastructure
- Tailscale Serve for HTTPS exposure on tailnet
- Nomad HCL for deployment (`tallest-tree.nomad.hcl`)
