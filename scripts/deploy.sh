#!/usr/bin/env bash
# tallest-tree deploy — thin wrapper around the generic deploy script.
# shellcheck source=/dev/null

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PROJECT_DIR

# Write config to a temp file (generic script sources it)
CONFIG=$(mktemp)
trap 'rm -f "$CONFIG"' EXIT

cat > "$CONFIG" <<'CONF'
JOB_SPEC="$PROJECT_DIR/tallest-tree.nomad.hcl"
JOB_ID="tallest-tree"
REPO="tommyroar/tallest-tree"
DP_ARGS="--job tallest-tree --ts-path /tallest-trees --repo tommyroar/tallest-tree --service vite:5180:frontend --service flask:5111:backend"
GH_ENVS="nomad-vite nomad-python"

health_checks() {
  log "Waiting for Flask backend..."
  for i in $(seq 1 60); do
    curl -sf http://127.0.0.1:5111/api/health >/dev/null 2>&1 && { log "Flask backend healthy"; break; }
    [ "$i" -eq 60 ] && fail "Flask backend did not become healthy within 120s"
    sleep 2
  done

  log "Waiting for Vite frontend..."
  for i in $(seq 1 30); do
    curl -sf -o /dev/null http://127.0.0.1:5180/ 2>/dev/null && { log "Vite frontend healthy"; break; }
    [ "$i" -eq 30 ] && fail "Vite frontend did not become healthy within 60s"
    sleep 2
  done
}

health_checks_status() {
  printf "  flask:  "
  curl -sf http://127.0.0.1:5111/api/health >/dev/null 2>&1 && echo "healthy" || echo "unhealthy"
  printf "  vite:   "
  curl -sf -o /dev/null http://127.0.0.1:5180/ 2>/dev/null && echo "healthy" || echo "unhealthy"
}

gh_env_url() {
  local env="$1" payload="$2"
  case "$env" in
    nomad-vite)   echo "$payload" | jq -r '.urls.tailscale' ;;
    nomad-python) echo "$payload" | jq -r '.urls.backend_health' ;;
  esac
}
CONF

exec "$HOME/dev/mcp/nomad-dev-deploys/bin/deploy.sh" "$CONFIG" "${1:-start}"
