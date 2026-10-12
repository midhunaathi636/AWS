# Secure Collaborative Learning Platform — Full AWS Free-Tier Deploy

Working stack: **Amplify (frontend)** + **Cognito (auth)** + **API Gateway HTTP API** + **Lambda** + **DynamoDB** + **S3**.

Login no longer uses `localhost:4000`. It uses Cognito + your deployed API URL.

## Architecture

```
Browser (Amplify)
    │  Cognito USER_PASSWORD_AUTH
    ▼
Amazon Cognito  ──JWT──►  API Gateway HTTP API  ──►  Lambda
                                                      │
                                                      ▼
                                              DynamoDB tables
                                              S3 data bucket
```

## 1. Deploy backend (one-time, ~5 minutes)

Prerequisites: AWS CLI configured, permissions for CloudFormation, Cognito, DynamoDB, Lambda, API Gateway, IAM, S3.

```bash
export AWS_REGION=eu-north-1          # match your Amplify region (Stockholm)
export WEB_ORIGIN=https://main.d22xvq956m9ny4.amplifyapp.com

chmod +x scripts/*.sh
./scripts/deploy-backend.sh
./scripts/seed-cognito-users.sh
```

Demo users (password **`Demo@123`**):

| Email | Role |
|-------|------|
| vikram.sharma@apollohospitals.demo | System Admin |
| rajesh.kulkarni@fortishealthcare.demo | Doctor |
| ananya.iyer@abcresearch.demo | Researcher |

Copy stack outputs:

```bash
aws cloudformation describe-stacks --stack-name sclp-free --region eu-north-1 \
  --query 'Stacks[0].Outputs' --output table
```

You need:

- `ApiUrl` → Amplify env `VITE_API_URL`
- `UserPoolId` → `VITE_COGNITO_USER_POOL_ID`
- `UserPoolClientId` → `VITE_COGNITO_CLIENT_ID`
- Region → `VITE_AWS_REGION`

## 2. Configure Amplify frontend

Amplify Console → your app → **Hosting** → **Environment variables**:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://xxxx.execute-api.eu-north-1.amazonaws.com` |
| `VITE_COGNITO_USER_POOL_ID` | `eu-north-1_xxxxx` |
| `VITE_COGNITO_CLIENT_ID` | `xxxxxxxx` |
| `VITE_AWS_REGION` | `eu-north-1` |

**Redeploy** the Amplify app (or push a commit) so Vite bakes in the env vars.

## 3. Login

Open your Amplify URL → use a demo email + `Demo@123`.

Network tab should show calls to your `execute-api` host, **not** `localhost:4000`.

## 4. GitHub → Amplify

Push this repo root (with `amplify.yml` at root) to GitHub. Amplify builds with:

```yaml
npm ci --legacy-peer-deps
npm run build   # uses VITE_* env vars
```

## Local frontend only

```bash
npm install --legacy-peer-deps
echo 'VITE_API_URL=https://YOUR_API' > .env.local
npm run dev
```

## Free-tier notes

- DynamoDB on-demand: free tier 25 GB + request units
- Lambda + API Gateway: free tier generous for demos
- Cognito: 50k MAU free
- S3: 5 GB free
- Set a **$1 AWS Budget** alert

## Tear down

```bash
aws cloudformation delete-stack --stack-name sclp-free --region eu-north-1
```

