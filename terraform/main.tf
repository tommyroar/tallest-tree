# ---------------------------------------------------------------------------
# Cloudflare Pages projects (prod + staging)
# ---------------------------------------------------------------------------
# We use the "direct upload" source so wrangler / GitHub Actions own the
# deploy lifecycle. Terraform only owns the project shell + custom domain
# binding; code & container images are managed by wrangler.

resource "cloudflare_pages_project" "prod" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_prod
  production_branch = "main"
}

resource "cloudflare_pages_project" "staging" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_staging
  production_branch = "staging"
}

# ---------------------------------------------------------------------------
# Custom domains on Pages
# ---------------------------------------------------------------------------
# Pages auto-provisions the CNAME/AAAA records in the zone when the domain is
# attached, so we don't need a separate cloudflare_record. The Worker route
# defined in worker/wrangler.toml takes precedence for /api/*, so requests to
# https://<prod_hostname>/api/... hit the container while everything else
# falls through to Pages.

resource "cloudflare_pages_domain" "prod" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.prod.name
  name         = var.prod_hostname
}

resource "cloudflare_pages_domain" "staging" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.staging.name
  name         = var.staging_hostname
}
