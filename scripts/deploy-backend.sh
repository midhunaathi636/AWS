#!/usr/bin/env bash
# Deploy CloudFormation + Lambda API (free-tier)
set -euo pipefail

STACK="${STACK_NAME:-sclp-free}"
REGION="${AWS_REGION:-eu-north-1}"
WEB_ORIGIN="${WEB_ORIGIN:-https://main.d22xvq956m9ny4.amplifyapp.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Packaging Lambda"
cd "$ROOT/infra/lambda"
npm install --omit=dev
zip -r /tmp/sclp-api.zip index.mjs node_modules package.json

echo "==> Deploying CloudFormation stack: $STACK"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$ROOT/infra/cloudformation.yaml" \
  --parameter-overrides "WebOrigin=$WEB_ORIGIN" ProjectName=sclp \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo "==> Updating Lambda function code"
FN=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
# Get function name
FUNC_NAME="sclp-api"
aws lambda update-function-code \
  --region "$REGION" \
  --function-name "$FUNC_NAME" \
  --zip-file fileb:///tmp/sclp-api.zip >/dev/null

echo "==> Stack outputs"
aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query 'Stacks[0].Outputs' --output table

echo ""
echo "Next:"
echo "  1. Run: ./scripts/seed-cognito-users.sh"
echo "  2. Set Amplify env vars from outputs (VITE_API_URL, VITE_COGNITO_*)"
echo "  3. Redeploy Amplify app"
