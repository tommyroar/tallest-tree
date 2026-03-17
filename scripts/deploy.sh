#!/usr/bin/env bash
set -euo pipefail

# Deploy, stop, or check status of tallest-tree via Nomad.
# GitHub deployment records and Tailscale serve are managed automatically:
#   - On deploy: creates GitHub deployments with standard payload
#   - On stop: Nomad poststop lifecycle hook deactivates deployments and removes Tailscale route

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JOB_SPEC="$PROJECT_DIR/tallest-tree.nomad.hcl"
JOB_ID="tallest-tree"
REPO="tommyroar/tallest-tree"
NOMAD_UI="http://127.0.0.1:4646/ui/jobs/$JOB_ID"

# Shared CLI from nomad-dev-deploys
DP="node $HOME/dev/mcp/nomad-dev-deploys/bin/deployment-payload.js"
DP_ARGS="--job $JOB_ID --ts-path /tallest-trees --repo $REPO --service vite:5180:frontend --service flask:5111:backend"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] FAIL: $*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [COMMAND]

Commands:
  start   Deploy and start all services (default)
  stop    Stop the Nomad job (triggers poststop cleanup)
  status  Show current job status and URLs
EOF
}

# ---------- Commands ----------

cmd_start() {
  SHA=$(git -C "$PROJECT_DIR" rev-parse HEAD)
  REF=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD)
  log "Deploying $REF ($SHA)"

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

  # Build payload from shared schema
  PAYLOAD=$($DP payload $DP_ARGS)
  TS_URL=$(echo "$PAYLOAD" | jq -r '.urls.tailscale')

  # Create GitHub deployments
  for env_name in nomad-vite nomad-python; do
    if [ "$env_name" = "nomad-vite" ]; then
      env_url="$TS_URL"
    else
      env_url=$(echo "$PAYLOAD" | jq -r '.urls.backend_health')
    fi

    log "Creating GitHub deployment: $env_name"
    DEPLOY_ID=$(gh api "repos/$REPO/deployments" \
      --input <(jq -n \
        --arg ref "$SHA" \
        --arg env "$env_name" \
        --argjson payload "$PAYLOAD" \
        '{ref: $ref, environment: $env, auto_merge: false, required_contexts: [], payload: $payload}' \
      ) --jq '.id')

    gh api "repos/$REPO/deployments/$DEPLOY_ID/statuses" \
      -f state=success \
      -f environment_url="$env_url" \
      -f log_url="$NOMAD_UI" \
      -f description="Deployed via Nomad" \
      --silent

    log "  $env_name deployment #$DEPLOY_ID → success"
  done

  log ""
  log "Deployment complete!"
  echo "$PAYLOAD" | jq -r '.urls | to_entries[] | "  \(.key): \(.value)"'
}

cmd_stop() {
  log "Stopping Nomad job $JOB_ID..."
  nomad job stop "$JOB_ID" 2>&1
  log "Job stopped (poststop hook will deactivate GitHub deployments and remove Tailscale route)"
}

cmd_status() {
  STATUS=$(nomad job status "$JOB_ID" 2>&1) || { echo "Job $JOB_ID not found"; exit 0; }

  JOB_STATUS=$(echo "$STATUS" | awk '/^Status/ {print $NF; exit}')
  log "Job: $JOB_ID  Status: $JOB_STATUS"

  if [ "$JOB_STATUS" = "running" ]; then
    PAYLOAD=$($DP payload $DP_ARGS 2>/dev/null) && \
      echo "$PAYLOAD" | jq -r '.urls | to_entries[] | "  \(.key): \(.value)"'

    # Health probes
    echo ""
    printf "  flask:  "
    curl -sf http://127.0.0.1:5111/api/health >/dev/null 2>&1 && echo "healthy" || echo "unhealthy"
    printf "  vite:   "
    curl -sf -o /dev/null http://127.0.0.1:5180/ 2>/dev/null && echo "healthy" || echo "unhealthy"
  fi

  # Latest GitHub deployment status
  echo ""
  for env_name in nomad-vite nomad-python; do
    LATEST=$(gh api "repos/$REPO/deployments?environment=$env_name&per_page=1" --jq '.[0] | "\(.id) \(.sha[:7])"' 2>/dev/null)
    if [ -n "$LATEST" ]; then
      DEPLOY_ID=$(echo "$LATEST" | awk '{print $1}')
      DEPLOY_SHA=$(echo "$LATEST" | awk '{print $2}')
      STATE=$(gh api "repos/$REPO/deployments/$DEPLOY_ID/statuses" --jq '.[0].state' 2>/dev/null)
      log "GitHub $env_name: #$DEPLOY_ID ($DEPLOY_SHA) → $STATE"
    fi
  done
}

# ---------- Dispatch ----------
case "${1:-start}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  -h|--help) usage ;;
  *) echo "Unknown command: $1"; usage; exit 1 ;;
esac
