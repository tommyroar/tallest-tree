#!/usr/bin/env bash
# Assemble the static asset directory that gets uploaded to Cloudflare Pages.
# The frontend is a single self-contained HTML file (no build step), so this
# is just a controlled copy — we don't want to upload the entire repo.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${PROJECT_DIR}/dist"

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

cp "${PROJECT_DIR}/index.html" "${DIST_DIR}/index.html"

echo "Built Pages dist at ${DIST_DIR}"
ls -la "${DIST_DIR}"
