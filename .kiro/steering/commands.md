# Build, Test & Run Commands

## Python

```bash
# Activate venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start Flask backend (port 5111)
python server.py

# Run fast unit tests (no network needed)
pytest -m "not slow"

# Run all tests including S3 integration
pytest

# Lint with ruff
ruff check .

# Format with ruff
ruff format .
```

## JavaScript / Frontend

```bash
# Install dependencies
npm install

# Start Vite dev server (port 5180, proxies /api to Flask)
npm run dev

# Run vitest unit tests (single run)
npm test

# Lint with Biome (scoped to mcp/**)
npm run lint

# Fix lint issues
npm run lint:fix
```

## MCP Dev Server

```bash
# Run tests
node --test test/*.test.js    # from mcp/dev-server/
```

## E2E / Smoke Tests

```bash
# Requires running Flask server + network access
node tests/test_smoke.js

# Tests graceful error when backend is unavailable (Vite only)
node tests/test_api_error.js
```

## Serve & Deploy

```bash
# Start Vite + Tailscale Serve
npm run serve

# Stop Vite + remove Tailscale Serve
npm run serve:kill

# Deploy via Nomad
npm run deploy

# Check deploy status
npm run deploy:status
```
