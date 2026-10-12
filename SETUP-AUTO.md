# Automatic setup (push to GitHub → API + database + frontend)

This repo supports **push-to-deploy** for the Secure Collaborative Learning Platform.

> **AppSync:** the app uses **Lambda Function URL + Express (no API Gateway)**, not AWS AppSync GraphQL. The automated stack provisions that REST API. AppSync is not part of this codebase.

## Architecture modes

| Mode | What is created | When to use |
|------|-----------------|-------------|
| **lite** (default) | Lambda Function URL (no API Gateway), Lambda, S3, Cognito pool, Secrets, SQLite + demo users | Fast demo / student projects, **no VPC** |
| **full** | Everything above + **VPC, RDS PostgreSQL, RDS Proxy, EFS** | Persistent production-like data |

## One-time setup

### 1. GitHub secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Required | Value |
|--------|----------|--------|
| `AWS_ACCESS_KEY_ID` | Yes | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | IAM secret |
| `WEB_ORIGIN` | Recommended | `https://main.xxxx.amplifyapp.com` |
| `AMPLIFY_APP_ID` | Optional | Auto-update Amplify env + rebuild |
| `AMPLIFY_BRANCH` | Optional | Default `main` |

Optional **Variables**: `AWS_REGION` (default `ap-south-1`).

IAM user needs permissions for CloudFormation, SAM, Lambda, API Gateway, S3, Cognito, Secrets Manager, IAM PassRole; for **full** mode also VPC, RDS, EFS.

### 2. Amplify Hosting

1. Amplify → Host web app → GitHub → this repo → branch `main`.
2. Build uses root `amplify.yml` (no merge-conflict markers).
3. After API deploy, set environment variables:

```text
VITE_API_URL=<ApiEndpoint from stack>
VITE_AWS_REGION=ap-south-1
```

4. Redeploy Amplify (required so Vite bakes in the API URL).

### 3. Push to deploy the API

```bash
git add .
git commit -m "Enable auto deploy"
git push origin main
```

Workflow **Deploy Platform**:

1. Builds and deploys **lite** stack (`aws/template-lite.yaml`) by default
2. Exports `ApiEndpoint`
3. Optionally updates Amplify env and starts a frontend rebuild
4. Builds a frontend artifact with the correct `VITE_API_URL`

Manual: Actions → Deploy Platform → Run workflow → mode `lite` or `full`.

## Local one-command deploy

```bash
export AWS_REGION=ap-south-1
export WEB_ORIGIN=https://main.d22xvq956m9ny4.amplifyapp.com

./scripts/deploy-all.sh lite    # recommended first
# ./scripts/deploy-all.sh full  # VPC + RDS (slower, more cost)
```

Or: `npm run deploy` / `npm run deploy:full`.

## Demo login (lite mode)

| Email | Password |
|-------|----------|
| `vikram.sharma@apollohospitals.demo` | `Demo@123` |
| `rajesh.kulkarni@fortishealthcare.demo` | `Demo@123` |
| `ananya.iyer@abcresearch.demo` | `Demo@123` |

## CORS

Redeploy the API with `WEB_ORIGIN` equal to your real Amplify URL so the API allows browser credentials from that origin.

## New / important files

| Path | Role |
|------|------|
| `.github/workflows/deploy.yml` | CI/CD on push to main |
| `aws/template-lite.yaml` | No-VPC auto stack |
| `aws/network.yaml` | VPC for full mode |
| `aws/template.yaml` | Full stack (RDS + EFS) |
| `scripts/deploy-all.sh` | Local entrypoint |
| `samconfig.toml` | SAM defaults |
| `amplify.yml` | Clean Amplify build (no conflict markers) |
| `SETUP-AUTO.md` | This guide |
