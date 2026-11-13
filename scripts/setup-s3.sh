#!/usr/bin/env bash
# One-time AWS setup for Virtual Closet photos: a private S3 bucket, an IAM user that can only touch that bucket,
# an access key, and the matching lines in .env.local. Needs the AWS CLI signed in with rights to create these.
#
#   ./scripts/setup-s3.sh [bucket-name] [region]
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'echo "✖ setup-s3.sh failed at line $LINENO (see the message above)" >&2' ERR

command -v aws >/dev/null || { echo "aws CLI not found — brew install awscli && aws configure"; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "aws CLI is not signed in — run: aws configure"; exit 1; }

BUCKET="${1:-spreadsheet-diary-closet-$(openssl rand -hex 4)}"
REGION="${2:-${AWS_REGION:-$(aws configure get region 2>/dev/null || echo us-east-1)}}"
USER_NAME=spreadsheet-diary-closet

echo "▸ Bucket $BUCKET in $REGION"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  if [ "$REGION" = "us-east-1" ]; then aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null; fi
fi
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "▸ IAM user $USER_NAME (bucket-only policy)"
aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1 || aws iam create-user --user-name "$USER_NAME" >/dev/null
POLICY=$(cat <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::$BUCKET/*"},
 {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::$BUCKET"}]}
JSON
)
aws iam put-user-policy --user-name "$USER_NAME" --policy-name closet-photos --policy-document "$POLICY"

echo "▸ Access key"
KEY_JSON=$(aws iam create-access-key --user-name "$USER_NAME" --output json)
AKID=$(echo "$KEY_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["AccessKey"]["AccessKeyId"])')
SECRET=$(echo "$KEY_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["AccessKey"]["SecretAccessKey"])')

touch .env.local
grep -v -E '^(S3_BUCKET|AWS_REGION|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)=' .env.local > .env.local.tmp || true
mv .env.local.tmp .env.local
{
  echo "S3_BUCKET=$BUCKET"
  echo "AWS_REGION=$REGION"
  echo "AWS_ACCESS_KEY_ID=$AKID"
  echo "AWS_SECRET_ACCESS_KEY=$SECRET"
} >> .env.local

cat <<MSG

✔ .env.local now has S3_BUCKET / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY. Restart npm run dev.
  Hosted app: add the same four variables on Vercel (vercel env add …), then redeploy.
MSG
