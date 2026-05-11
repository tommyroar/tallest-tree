# Deployment

This repo ships to Cloudflare:

| Piece    | Where it runs                                  | Owned by |
| -------- | ---------------------------------------------- | -------- |
| Frontend | Cloudflare Pages (`index.html`)                | Pages    |
| Backend  | Cloudflare Worker → container running `server.py` (Flask + rasterio + scipy) | Worker + Containers |

Same hostname for both. Cloudflare matches `/api/*` against the Worker route first; everything else falls through to Pages. The frontend's existing relative `/api/...` calls keep working unchanged.

Two environments:

- **production** — deployed on push to `main`. Hostname: `prod_hostname` (tfvars).
- **staging** — deployed on push to `staging`. Hostname: `staging_hostname` (tfvars).

---

## Initial deploy (Mac mini, one time)

You'll need: a Cloudflare account, a zone you control, the `wrangler`, `terraform`, and Docker CLIs.

### 1. Create an API token

In the Cloudflare dashboard (or via the Cloudflare MCP), mint a token with:

- `Account / Cloudflare Pages / Edit`
- `Account / Workers Scripts / Edit`
- `Account / Workers Routes / Edit`
- `Zone / DNS / Edit` (your zone)
- `Zone / Zone / Read` (your zone)

Export it:

```sh
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
```

### 2. Fill in Terraform variables

```sh
cd terraform
cp environments/prod.tfvars.example environments/prod.tfvars
# edit environments/prod.tfvars with your account_id, zone_id, hostnames
```

`environments/prod.tfvars` is gitignored. The same file drives both environments — `prod_hostname` and `staging_hostname` are both declared there.

### 3. Apply Terraform (Pages projects + custom domains)

```sh
cd terraform
terraform init
terraform apply -var-file=environments/prod.tfvars
```

Terraform creates two empty Pages projects and attaches the custom domains. It does **not** touch the Worker — wrangler owns that.

### 4. Point the Worker at your zone

Edit `worker/wrangler.toml`. Replace `tallesttree.example` (in both the prod `[[routes]]` block and `[env.staging.routes]`) with the hostnames + zone you used in tfvars.

### 5. First deploy from your Mac

```sh
# Backend (prod)
cd worker
npm install
npx wrangler deploy

# Backend (staging)
npx wrangler deploy --env staging

# Frontend (prod)
cd ..
./scripts/build-pages.sh
npx wrangler pages deploy dist --project-name tallest-tree --branch main

# Frontend (staging)
npx wrangler pages deploy dist --project-name tallest-tree-staging --branch staging
```

That gets you to a working deploy on both environments. Hit `https://<prod_hostname>` — the map should load, clicks should call `/api/analyze` against the container, and overlay PNGs should render.

---

## Wire up CI/CD

Once the initial deploy works, hand the wheel to GitHub Actions.

### Secrets (Settings → Secrets and variables → Actions → Secrets)

| Name                    | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | The same scoped token used above.                |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID.                      |

### Optional variables (Settings → Secrets and variables → Actions → Variables)

These default to `tallest-tree` and `tallest-tree-staging`. Only set them if you used different Pages project names in Terraform.

| Name                    | Default                  |
| ----------------------- | ------------------------ |
| `PAGES_PROJECT_PROD`    | `tallest-tree`           |
| `PAGES_PROJECT_STAGING` | `tallest-tree-staging`   |

### How it triggers

- Push to `main` → `.github/workflows/deploy.yml` runs against production.
- Push to `staging` → same workflow runs against staging.
- Workflow can also be triggered manually from the Actions tab (`workflow_dispatch`) and lets you pick the environment.

The workflow:
1. Builds the container image and deploys it (`wrangler deploy [--env staging]`) — Cloudflare hosts the registry; no Docker Hub credentials needed.
2. Builds the Pages dist directory (a copy of `index.html`).
3. Uploads it via `wrangler pages deploy`.

---

## State management

Terraform state is **local** by default — fine while only the Mac mini runs `terraform apply`. CI never runs Terraform; it only calls `wrangler`, so there's no state conflict.

If you want CI to manage infrastructure too, uncomment the R2 backend block in `terraform/versions.tf` and run `terraform init -migrate-state` once.

---

## What lives where

```
.
├── Dockerfile                  # Flask backend container image
├── server.py                   # unchanged — bind unchanged either
├── index.html                  # unchanged — relative /api/* keeps working
├── worker/                     # Cloudflare Worker that fronts the container
│   ├── wrangler.toml           # routes, container, durable object binding
│   └── src/index.ts
├── terraform/                  # Pages projects + custom domains
│   ├── main.tf
│   ├── variables.tf
│   └── environments/prod.tfvars.example
├── scripts/build-pages.sh      # builds dist/ for wrangler pages deploy
└── .github/workflows/deploy.yml # main → prod, staging → staging
```

## Useful commands

```sh
# Tail prod Worker + container logs
cd worker && npx wrangler tail

# Tail staging logs
cd worker && npx wrangler tail --env staging

# Roll back Pages to a prior deploy (UI is easier, but:)
npx wrangler pages deployment list --project-name tallest-tree

# Local container test
docker build -t tallest-tree-api .
docker run -p 8080:8080 tallest-tree-api
curl http://localhost:8080/api/health
```
