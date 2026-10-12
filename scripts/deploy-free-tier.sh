#!/usr/bin/env bash
# Deploy the API stack with free-tier friendly defaults.
# Prerequisites: AWS CLI, SAM CLI, VPC + 2 private subnets.
set -euo pipefail

STACK_NAME="${STACK_NAME:-sclp-api}"
REGION="${AWS_REGION:-ap-south-1}"
TEMPLATE="aws/template.yaml"

echo "==> Building SAM application..."
sam build --template-file "$TEMPLATE" --region "$REGION"

echo "==> Deploying stack: $STACK_NAME (free-tier defaults)"
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "DatabaseInstanceClass=db.t4g.micro" \
    "DatabaseMultiAz=false" \
    "DatabaseName=secureplatform" \
    "WebOrigin=${WEB_ORIGIN:-https://localhost}" \
    ${VPC_ID:+"VpcId=$VPC_ID"} \
    ${PRIVATE_SUBNET_A:+"PrivateSubnetA=$PRIVATE_SUBNET_A"} \
    ${PRIVATE_SUBNET_B:+"PrivateSubnetB=$PRIVATE_SUBNET_B"} \
  --guided

echo ""
echo "==> Stack outputs (copy these into Amplify environment variables):"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output table
