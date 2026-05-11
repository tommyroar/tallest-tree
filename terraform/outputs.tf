output "prod_pages_project" {
  description = "Name of the production Pages project. Pass to `wrangler pages deploy --project-name`."
  value       = cloudflare_pages_project.prod.name
}

output "staging_pages_project" {
  description = "Name of the staging Pages project. Pass to `wrangler pages deploy --project-name`."
  value       = cloudflare_pages_project.staging.name
}

output "prod_url" {
  description = "Public production URL."
  value       = "https://${var.prod_hostname}"
}

output "staging_url" {
  description = "Public staging URL."
  value       = "https://${var.staging_hostname}"
}
