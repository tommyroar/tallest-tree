#!/usr/bin/env bash
set -euo pipefail

# Deploy tallest-tree (Flask backend + Vite frontend) via Nomad
# and create GitHub deployment records with standard payload.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JOB_SPEC="$PROJECT_DIR/tallest-tree.nomad.hcl"
REPO="tommyroar/tallest-tree"
NOMAD_UI="http://127.0.0.1:4646/ui/jobs/tallest-tree"

# Shared CLI from nomad-mcp
DP="node $HOME/dev/mcp/nomad-mcp/bin/deployment-payload.js"
DP_ARGS="--job tallest-tree --ts-path /tallest-trees --repo $REPO --service vite:5180:frontend --service flask:5111:backend"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] FAIL: $*" >&2; exit 1; }

SHA=$(git -C "$PROJECT_DIR" rev-parse HEAD)
REF=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD)
log "Deploying $REF ($SHA)"

# ---------- Nomad ----------
log "Submitting Nomad job..."
nomad job run "$JOB_SPEC"

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

# ---------- Build payload from shared schema ----------
PAYLOAD=$($DP payload $DP_ARGS)
log "Payload: $PAYLOAD"
TS_URL=$(echo "$PAYLOAD" | jq -r '.urls.tailscale')

# ---------- GitHub Deployments ----------
create_deployment() {
  local env="$1" env_url="$2"

  log "Creating GitHub deployment: $env"
  DEPLOY_ID=$(gh api "repos/$REPO/deployments" \
    --input <(jq -n \
      --arg ref "$SHA" \
      --arg env "$env" \
      --argjson payload "$PAYLOAD" \
      '{ref: $ref, environment: $env, auto_merge: false, required_contexts: [], payload: $payload}' \
    ) --jq '.id')

  gh api "repos/$REPO/deployments/$DEPLOY_ID/statuses" \
    -f state=success \
    -f environment_url="$env_url" \
    -f log_url="$NOMAD_UI" \
    -f description="Deployed via Nomad" \
    --silent

  log "  $env deployment #$DEPLOY_ID → success"
}

create_deployment "nomad-vite" "$TS_URL"
create_deployment "nomad-python" "$(echo "$PAYLOAD" | jq -r '.urls.backend_health')"

log ""
log "Deployment complete!"
echo "$PAYLOAD" | jq -r '.urls | to_entries[] | "  \(.key): \(.value)"'
