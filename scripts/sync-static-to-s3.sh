#!/usr/bin/env bash
# Build frontend and sync to an S3 bucket (alternative to Amplify Hosting).
set -euo pipefail

BUCKET="${1:?Usage: $0 <s3-bucket-name> [cloudfront-distribution-id]}"
DIST_ID="${2:-}"

echo "==> Building frontend..."
npm ci --legacy-peer-deps
npm run build

echo "==> Syncing dist/ → s3://$BUCKET"
aws s3 sync dist/ "s3://$BUCKET" --delete --cache-control "public,max-age=31536000,immutable" --exclude "index.html"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache"

if [[ -n "$DIST_ID" ]]; then
  echo "==> Invalidating CloudFront $DIST_ID"
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
fi

echo "Done."
