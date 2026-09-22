#!/usr/bin/env bash
# One-time Google setup: enables the Sheets API, creates a service account + key,
# and writes .env.local. Afterwards share both spreadsheets with the printed email (Editor).
#
#   ./scripts/setup-google.sh [gcp-project-id]
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT" ] || { echo "No project. Pass one: ./scripts/setup-google.sh my-project"; exit 1; }
SA_NAME=spreadsheet-diary
SA_EMAIL="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

echo "▸ Project: $PROJECT"
gcloud services enable sheets.googleapis.com --project "$PROJECT"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --display-name "Spreadsheet Diary" --project "$PROJECT"
fi

KEY=$(mktemp)
gcloud iam service-accounts keys create "$KEY" --iam-account "$SA_EMAIL" --project "$PROJECT" >/dev/null
B64=$(base64 < "$KEY" | tr -d '\n')
rm -f "$KEY"

if [ -f .env.local ]; then
  grep -v '^GOOGLE_SERVICE_ACCOUNT_JSON=' .env.local > .env.local.tmp || true
  mv .env.local.tmp .env.local
else
  grep -v '^#' .env.example | grep -v '^GOOGLE_SERVICE_ACCOUNT_JSON=' | sed 's/ *#.*//' > .env.local
fi
echo "GOOGLE_SERVICE_ACCOUNT_JSON=$B64" >> .env.local

cat <<MSG

✔ Wrote .env.local (service-account key is base64 in GOOGLE_SERVICE_ACCOUNT_JSON).

Now share BOTH spreadsheets with this address as Editor:

    $SA_EMAIL

Then: npm run dev
MSG
