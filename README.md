<<<<<<< HEAD
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

=======
# Secure Collaborative Learning Platform — AWS Free-Tier + Amplify

GitHub-ready repository for deploying the Secure Collaborative Learning Platform using **AWS free-tier eligible services** and **AWS Amplify** for the frontend.

## Architecture (Free-Tier Oriented)

| Layer | Service | Free-tier notes |
|-------|---------|-----------------|
| Frontend | **AWS Amplify Hosting** | Free for personal/hobby; GitHub CI/CD |
| API | API Gateway + Lambda (Node.js 22) | 1M requests + 400k GB-s free |
| Auth | Amazon Cognito | 50k MAU free |
| Database | **Amazon RDS PostgreSQL** `db.t4g.micro` / `db.t3.micro` | 750 hrs/month free (12 months for new accounts) |
| Files / Models | S3 (encrypted) | 5 GB free |
| Secrets | Secrets Manager | First secret free tier eligible |
| Monitoring | CloudWatch | Basic free tier |
| Optional FL workers | SageMaker / ECS Fargate | **Not free** — use only for paid pilot |

Local development still uses SQLite + encrypted files under `data/`. Production uses RDS + S3 + Cognito.

## Quick start (local)

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # set GEMINI_API_KEY, SESSION_SECRET, FILE_ENCRYPTION_KEY
npm run api                  # terminal 1 — Express API on :4000
npm run dev                  # terminal 2 — Vite on :3000
```

Demo accounts (password `Demo@123`):

- `vikram.sharma@apollohospitals.demo` — System Admin
- `rajesh.kulkarni@fortishealthcare.demo` — Doctor
- `ananya.iyer@abcresearch.demo` — Researcher

## Deploy backend (CloudFormation / SAM) — free-tier defaults

### Prerequisites

1. AWS CLI + SAM CLI installed and configured (`aws configure`).
2. An existing VPC with **two private subnets** (required by the template for Lambda + RDS).
3. Permission to create S3, Lambda, API Gateway, RDS, Cognito, EFS, Secrets Manager, IAM, CloudWatch.

### Deploy API stack

```bash
# From repo root
sam build --template-file aws/template.yaml

sam deploy --guided \
  --template-file .aws-sam/build/template.yaml \
  --stack-name sclp-api \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    DatabaseInstanceClass=db.t4g.micro \
    DatabaseMultiAz=false \
    WebOrigin=https://main.d1234567890.amplifyapp.com
```

When prompted, supply:

- `VpcId`, `PrivateSubnetA`, `PrivateSubnetB`
- `WebOrigin` = your Amplify app URL (update later if needed)
- Accept defaults for database name (`secureplatform`) and Multi-AZ = `false`

**Outputs** (note these):

- `ApiUrl` → set as Amplify env `VITE_API_URL`
- Cognito User Pool ID / Client ID → Amplify env vars
- RDS secret ARN, S3 bucket names (used by Lambda automatically)

### Bootstrap first admin (production)

From a machine that can reach the RDS Proxy / database:

```bash
export PLATFORM_DATABASE_URL="postgres://..."   # or use AWS_RDS_SECRET_ARN + proxy
node scripts/bootstrap-production-admin.mjs
```

Then create the matching user in Cognito (same email). Production sign-in is Cognito-only; no demo accounts are seeded.

### Optional: migrate existing SQLite

```bash
PLATFORM_DATABASE_URL=... node scripts/migrate-sqlite-to-postgres.mjs /path/to/sqlite.db
# Then sync encrypted files to the data S3 bucket
aws s3 sync ./data/encrypted s3://YOUR_DATA_BUCKET/encrypted --sse aws:kms
```

## Deploy frontend with AWS Amplify (GitHub)

1. Push this repository to GitHub.
2. AWS Console → **Amplify** → **Host web app** → **GitHub** → select this repo + branch.
3. Amplify detects `amplify.yml` automatically.
4. Add environment variables in Amplify Console (App settings → Environment variables):

   | Key | Value |
   |-----|--------|
   | `VITE_API_URL` | API Gateway URL from SAM outputs |
   | `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
   | `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
   | `VITE_AWS_REGION` | e.g. `ap-south-1` |

5. Save and redeploy. Amplify builds with Vite and hosts the SPA.
6. Update the SAM stack `WebOrigin` parameter to the Amplify domain and redeploy so CORS matches.

### Manual static deploy (alternative to Amplify Hosting)

```bash
npm run build
aws s3 sync dist/ s3://YOUR_FRONTEND_BUCKET --delete
# Optional CloudFront distribution in front of the bucket
```

## Free-tier cost control checklist

- [ ] RDS: `db.t4g.micro` (or `db.t3.micro`), **Single-AZ**, stop instance when not in use (or delete after 12-month free period).
- [ ] Lambda memory: template uses 2048 MB for heavy FL endpoints; reduce to 512–1024 MB for pure API if needed.
- [ ] S3: lifecycle rules already abort incomplete multipart uploads.
- [ ] Cognito: stay under 50k MAU.
- [ ] Do **not** enable Multi-AZ, RDS Proxy scaling, SageMaker training jobs, or ECS Fargate coordinator unless you accept charges.
- [ ] Set AWS Budgets / Billing alerts at $1 and $5.

## Repository layout

```
├── amplify.yml              # Amplify build spec
├── aws/
│   ├── template.yaml        # Main SAM/CloudFormation API + RDS + S3 + Cognito
│   ├── coordinator-template.yaml
│   ├── org-worker-template.yaml
│   └── ...
├── src/                     # React + Vite frontend
├── server.js                # Express API (runs on Lambda via serverless-express)
├── aws-services.js          # S3, Cognito, RDS, SageMaker helpers
├── production_fl/           # Flower SecAgg+ coordinator & workers (optional)
├── ml_service/              # Local FL simulation trainers
├── scripts/                 # Bootstrap, migrate, approve helpers
└── tests/
```

## Environment variables

See `.env.example`. Production values are injected by Lambda (from Secrets Manager / stack outputs) or Amplify env vars for the frontend.

## Federated Learning notes

- **Local FL** (UI “Run Local FL”): runs on the same host / Lambda; free-tier friendly for demos.
- **Remote secure FL** (`production_fl/`): requires SageMaker + ECS Fargate + multi-account PrivateLink — **outside free tier**. Keep disabled for free-tier deployments.

## Verification

```bash
npm run lint
npm run build
npm run test:integration
python3 -m unittest discover -s tests -p 'test_*.py'
```

## License / disclaimer

Educational / research prototype. Privacy claims (DP, SecAgg+) have unit tests but are **not** independently audited. Do not use for real patient data without proper legal, security, and clinical review.
>>>>>>> 8d9d8f65e7ee8820c7f761724c46793848afe9a1
