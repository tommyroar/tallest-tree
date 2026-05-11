terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Local state by default — fine for a single operator running from a Mac mini.
  # To share state between Mac mini + CI, uncomment and configure an R2 backend:
  #
  # backend "s3" {
  #   bucket                      = "tallest-tree-tfstate"
  #   key                         = "deploy/terraform.tfstate"
  #   region                      = "auto"
  #   endpoints                   = { s3 = "https://<account-id>.r2.cloudflarestorage.com" }
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_s3_checksum            = true
  #   use_path_style              = true
  # }
}
