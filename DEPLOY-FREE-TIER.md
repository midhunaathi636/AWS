# Free-Tier Deployment Guide (Amplify + CloudFormation/SAM)

This guide keeps the platform inside (or near) the AWS Free Tier for new accounts.

## 1. Create / use a free-tier eligible account

- New AWS accounts get 12 months of free tier for many services.
- Always set a **Billing alarm** (AWS Budgets) at $1 and $5.

## 2. Network prerequisites (one-time)

The SAM template expects an existing VPC with **two private subnets**.

Quick option with default VPC (if it has private subnets) or create a minimal VPC:

```bash
# Example: note your VPC and two private subnet IDs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock]' --output table
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxxx" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone,MapPublicIpOnLaunch]' --output table
```

If you have only public subnets you must create private ones + NAT (NAT Gateway is **not** free). For pure free-tier demos you can temporarily place Lambda outside a VPC, but the current template requires VPC for RDS/EFS.

## 3. Deploy backend (SAM)

```bash
export AWS_REGION=ap-south-1          # or your preferred free-tier region
export VPC_ID=vpc-xxxxxxxx
export PRIVATE_SUBNET_A=subnet-aaaa
export PRIVATE_SUBNET_B=subnet-bbbb
export WEB_ORIGIN=https://main.xxxxx.amplifyapp.com   # update after Amplify is live

./scripts/deploy-free-tier.sh
```

Key free-tier parameter defaults already baked in:

- `DatabaseInstanceClass=db.t4g.micro` (or change to `db.t3.micro`)
- `DatabaseMultiAz=false`
- Single RDS instance, no Multi-AZ

After deploy, copy stack outputs:

```bash
aws cloudformation describe-stacks --stack-name sclp-api --query 'Stacks[0].Outputs'
```

You need at least:

- `ApiUrl`
- Cognito User Pool ID
- Cognito Client ID
- Region

## 4. Bootstrap admin + Cognito user

```bash
# Reachable network to RDS Proxy / DB
export PLATFORM_DATABASE_URL="postgresql://user:pass@proxy-endpoint:5432/secureplatform"
node scripts/bootstrap-production-admin.mjs
```

Create the same email in Cognito User Pool (Console → Users → Create user). Sign-in is Cognito only in production.

## 5. Amplify frontend from GitHub

1. Push this repo to a GitHub repository.
2. Amplify Console → New app → Host web app → GitHub → select repo/branch.
3. Build settings are taken from `amplify.yml`.
4. Environment variables:

   ```
   VITE_API_URL=<ApiUrl from SAM>
   VITE_COGNITO_USER_POOL_ID=<pool id>
   VITE_COGNITO_CLIENT_ID=<client id>
   VITE_AWS_REGION=ap-south-1
   ```

5. Deploy. Copy the Amplify URL.
6. Update SAM parameter `WebOrigin` to that Amplify URL and run `sam deploy` again so CORS is correct.

## 6. Optional static S3 + CloudFront (instead of Amplify Hosting)

```bash
# Create a private bucket + CloudFront (or public website hosting for demos)
npm run build
./scripts/sync-static-to-s3.sh your-frontend-bucket [cloudfront-distribution-id]
```

## 7. Database only operations

- Connect with any Postgres client using the Secrets Manager secret or RDS Proxy endpoint.
- Migration from local SQLite:

  ```bash
  PLATFORM_DATABASE_URL=... node scripts/migrate-sqlite-to-postgres.mjs ./data/app.db
  aws s3 sync ./data/encrypted s3://DATA_BUCKET/encrypted --sse aws:kms
  ```

## 8. Cost control after free-tier window

- Stop or delete the RDS instance when not needed.
- Delete the CloudFormation stack: `aws cloudformation delete-stack --stack-name sclp-api`
- Amplify apps can be deleted from the console.
- Never leave SageMaker training jobs or Fargate services running.

## 9. What is intentionally excluded from free tier

| Component | Reason |
|-----------|--------|
| SageMaker training | Charged per instance-hour |
| ECS Fargate coordinator | Charged per vCPU/memory |
| Multi-AZ RDS | Doubles cost |
| NAT Gateway | Hourly + data charges |
| Large Lambda memory × long timeouts | Can exceed free 400 000 GB-s |

Keep the “remote-secure” federated learning path disabled for free-tier use. Local FL simulation inside the API is sufficient for demos.
