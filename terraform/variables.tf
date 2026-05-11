variable "cloudflare_api_token" {
  description = "Cloudflare API token with Pages:Edit, Workers Scripts:Edit, DNS:Edit, Zone:Read scopes."
  type        = string
  sensitive   = true
  default     = null
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Pages projects and Workers."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the apex domain (e.g. tallesttree.example)."
  type        = string
}

variable "prod_hostname" {
  description = "Hostname that serves production (frontend + /api/*). Must be inside the zone above."
  type        = string
}

variable "staging_hostname" {
  description = "Hostname that serves staging (frontend + /api/*). Must be inside the zone above."
  type        = string
}

variable "pages_project_prod" {
  description = "Name of the production Cloudflare Pages project."
  type        = string
  default     = "tallest-tree"
}

variable "pages_project_staging" {
  description = "Name of the staging Cloudflare Pages project."
  type        = string
  default     = "tallest-tree-staging"
}
