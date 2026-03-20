#!/usr/bin/env bash
# GitHub Deployment Status manager for Kiro-managed dev servers.
# Usage:
#   gh-deploy-status.sh start   — create deployments + mark in_progress
#   gh-deploy-status.sh success — mark active deployments as success
#   gh-deploy-status.sh stop    — mark active deployments as inactive
set -euo pipefail

REPO="tommyroar/tallest-tree"
ENVS=("kiro-vite" "kiro-flask")
TAILSCALE_URL="https://tommys-mac-mini.tail59a169.ts.net/tallest-trees"
BACKEND_URL="http://127.0.0.1:5111/api/health"
STATE_DIR="/tmp/kiro-deploy"

ACTION="${1:-}"

env_url() {
  case "$1" in
    kiro-vite)  echo "$TAILSCALE_URL" ;;
    kiro-flask) echo "$BACKEND_URL" ;;
  esac
}

create_deployment() {
  local env="$1"
  local ref
  ref=$(git rev-parse HEAD)
  gh api "repos/$REPO/deployments" \
    --input - <<EOF | jq -r '.id // empty'
{
  "ref": "$ref",
  "environment": "$env",
  "auto_merge": false,
  "required_contexts": []
}
EOF
}

post_status() {
  local deploy_id="$1" state="$2" env="$3"
  local url
  url=$(env_url "$env")
  gh api "repos/$REPO/deployments/$deploy_id/statuses" \
    -f state="$state" \
    -f description="Deployed via Kiro" \
    -f environment_url="$url" \
    --silent 2>/dev/null
}

deactivate_previous() {
  local env="$1"
  local ids
  ids=$(gh api "repos/$REPO/deployments?environment=$env&per_page=5" --jq '.[].id' 2>/dev/null || true)
  for id in $ids; do
    local current_state
    current_state=$(gh api "repos/$REPO/deployments/$id/statuses?per_page=1" --jq '.[0].state' 2>/dev/null || true)
    if [[ "$current_state" == "success" || "$current_state" == "in_progress" ]]; then
      gh api "repos/$REPO/deployments/$id/statuses" \
        -f state=inactive \
        --silent 2>/dev/null && echo "Deactivated $env #$id"
    fi
  done
}

case "$ACTION" in
  start)
    mkdir -p "$STATE_DIR"
    for env in "${ENVS[@]}"; do
      deactivate_previous "$env"
      id=$(create_deployment "$env")
      if [[ -n "$id" ]]; then
        echo "$id" > "$STATE_DIR/$env.id"
        post_status "$id" "in_progress" "$env"
        echo "Created $env deployment #$id (in_progress)"
      else
        echo "Failed to create $env deployment" >&2
      fi
    done
    ;;

  success)
    for env in "${ENVS[@]}"; do
      if [[ -f "$STATE_DIR/$env.id" ]]; then
        id=$(cat "$STATE_DIR/$env.id")
        post_status "$id" "success" "$env"
        echo "Marked $env #$id as success"
      else
        echo "No active $env deployment found" >&2
      fi
    done
    ;;

  stop)
    for env in "${ENVS[@]}"; do
      if [[ -f "$STATE_DIR/$env.id" ]]; then
        id=$(cat "$STATE_DIR/$env.id")
        post_status "$id" "inactive" "$env"
        echo "Marked $env #$id as inactive"
        rm -f "$STATE_DIR/$env.id"
      else
        deactivate_previous "$env"
      fi
    done
    rm -rf "$STATE_DIR"
    ;;

  *)
    echo "Usage: $0 {start|success|stop}" >&2
    exit 1
    ;;
esac
