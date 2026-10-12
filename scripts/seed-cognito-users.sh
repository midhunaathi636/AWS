#!/usr/bin/env bash
# Create demo Cognito users (password: Demo@123)
set -euo pipefail

REGION="${AWS_REGION:-eu-north-1}"
STACK="${STACK_NAME:-sclp-free}"
PASSWORD="${DEMO_PASSWORD:-Demo@123}"

POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

create_user() {
  local email="$1" name="$2" role="$3" org_id="$4" org_name="$5"
  echo "Creating $email ..."
  aws cognito-idp admin-create-user \
    --region "$REGION" \
    --user-pool-id "$POOL_ID" \
    --username "$email" \
    --user-attributes \
      Name=email,Value="$email" \
      Name=email_verified,Value=true \
      Name=name,Value="$name" \
      Name=custom:role,Value="$role" \
      Name=custom:orgId,Value="$org_id" \
      Name=custom:orgName,Value="$org_name" \
    --message-action SUPPRESS \
    2>/dev/null || echo "  (user may already exist)"

  aws cognito-idp admin-set-user-password \
    --region "$REGION" \
    --user-pool-id "$POOL_ID" \
    --username "$email" \
    --password "$PASSWORD" \
    --permanent
}

create_user "vikram.sharma@apollohospitals.demo" "Vikram Sharma" "System Admin" "org-apollo" "Apollo Hospitals"
create_user "rajesh.kulkarni@fortishealthcare.demo" "Rajesh Kulkarni" "Doctor" "org-fortis" "Fortis Healthcare"
create_user "ananya.iyer@abcresearch.demo" "Ananya Iyer" "Researcher" "org-abc" "ABC Research"

echo "Done. Password for all demo users: $PASSWORD"
