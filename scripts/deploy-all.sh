#!/usr/bin/env bash
# One-command bootstrap: network (optional) + API + print Amplify env values.
# Usage:
#   ./scripts/deploy-all.sh              # lite mode (no VPC, demo seed)
#   ./scripts/deploy-all.sh full         # full RDS + EFS + VPC
#   WEB_ORIGIN=https://main.xxx.amplifyapp.com ./scripts/deploy-all.sh
set -euo pipefail

MODE="${1:-lite}"
REGION="${AWS_REGION:-ap-south-1}"
PROJECT_NAME="${PROJECT_NAME:-sclp}"
WEB_ORIGIN="${WEB_ORIGIN:-https://localhost}"
STACK_LITE="${STACK_NAME:-sclp-api-lite}"
STACK_FULL="${STACK_NAME_FULL:-sclp-api}"
NETWORK_STACK="${NETWORK_STACK:-sclp-network}"

command -v aws >/dev/null || { echo "Install AWS CLI"; exit 1; }
command -v sam >/dev/null || { echo "Install AWS SAM CLI"; exit 1; }

echo "==> Region: $REGION  Mode: $MODE  WebOrigin: $WEB_ORIGIN"

if [ "$MODE" = "lite" ]; then
  echo "==> Building lite SAM app (no VPC)..."
  sam build --template-file aws/template-lite.yaml --region "$REGION"
  sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name "$STACK_LITE" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
      "ProjectName=$PROJECT_NAME" \
      "WebOrigin=$WEB_ORIGIN" \
      "AllowDemoSeed=true"
  STACK="$STACK_LITE"
elif [ "$MODE" = "full" ]; then
  if ! aws cloudformation describe-stacks --stack-name "$NETWORK_STACK" --region "$REGION" >/dev/null 2>&1; then
    echo "==> Creating VPC network stack..."
    aws cloudformation deploy \
      --template-file aws/network.yaml \
      --stack-name "$NETWORK_STACK" \
      --region "$REGION" \
      --parameter-overrides "ProjectName=$PROJECT_NAME" \
      --no-fail-on-empty-changeset
  fi
  VPC_ID=$(aws cloudformation describe-stacks --stack-name "$NETWORK_STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" --output text)
  SUB_A=$(aws cloudformation describe-stacks --stack-name "$NETWORK_STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnetA'].OutputValue" --output text)
  SUB_B=$(aws cloudformation describe-stacks --stack-name "$NETWORK_STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnetB'].OutputValue" --output text)
  echo "==> VPC=$VPC_ID subnets=$SUB_A $SUB_B"
  echo "==> Building full SAM app..."
  sam build --template-file aws/template.yaml --region "$REGION"
  sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name "$STACK_FULL" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
      "VpcId=$VPC_ID" \
      "PrivateSubnetA=$SUB_A" \
      "PrivateSubnetB=$SUB_B" \
      "WebOrigin=$WEB_ORIGIN" \
      "DatabaseInstanceClass=db.t4g.micro" \
      "DatabaseMultiAz=false" \
      "DatabaseName=secureplatform"
  STACK="$STACK_FULL"
else
  echo "Unknown mode: $MODE (use lite or full)"
  exit 1
fi

echo ""
echo "==> Stack outputs — set these in Amplify → Environment variables, then redeploy:"
aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query 'Stacks[0].Outputs' --output table

API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint' || OutputKey=='ApiUrl'].OutputValue | [0]" --output text)

echo ""
echo "Amplify env:"
echo "  VITE_API_URL=$API_URL"
echo "  VITE_AWS_REGION=$REGION"
echo ""
echo "After Amplify URL is known, re-run with:"
echo "  WEB_ORIGIN=https://YOUR.amplifyapp.com ./scripts/deploy-all.sh $MODE"
echo "so CORS matches your frontend."
