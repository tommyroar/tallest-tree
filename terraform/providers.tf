provider "cloudflare" {
  # Reads CLOUDFLARE_API_TOKEN from the environment. On the Mac mini, the
  # Cloudflare MCP tool can mint a scoped token for you; in CI, the token is
  # injected via the CLOUDFLARE_API_TOKEN GitHub secret.
  api_token = var.cloudflare_api_token
}
