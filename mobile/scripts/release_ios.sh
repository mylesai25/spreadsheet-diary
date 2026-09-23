#!/usr/bin/env bash
# Build a signed App Store archive and upload it to TestFlight.
#
#   APPLE_ID=you@example.com DIARY_ALTOOL_PW=xxxx-xxxx-xxxx-xxxx ./scripts/release_ios.sh
#
# One-time prerequisites: Xcode signed in with your Apple ID (Settings → Accounts), the app created in
# App Store Connect (bundle id com.mylesai.diary), and an app-specific password from appleid.apple.com.
# The password is read from the DIARY_ALTOOL_PW env var (altool's --store-password-in-keychain-item is
# broken in Xcode 27: "Expected item argument is missing, --item"). If you have a working keychain item
# named DIARY_ALTOOL, leave DIARY_ALTOOL_PW unset and it is used instead.
set -euo pipefail
cd "$(dirname "$0")/.."
DIARY_URL="${DIARY_URL:-https://spreadsheet-diary.vercel.app}"

# Bump the build number so App Store Connect accepts the upload.
BUILD=$(date +%Y%m%d%H%M)
flutter build ios --config-only --release --build-number "$BUILD" --dart-define="DIARY_URL=$DIARY_URL"
rm -rf build/ios/archive build/ios/ipa
cat > build/ExportOptions.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>BB3LY4VRMY</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>destination</key><string>export</string>
</dict></plist>
PLIST
# xcodebuild directly so Xcode can create/refresh signing assets (-allowProvisioningUpdates).
xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -configuration Release -destination "generic/platform=iOS" \
  -archivePath build/ios/archive/Runner.xcarchive archive -allowProvisioningUpdates -quiet
xcodebuild -exportArchive -archivePath build/ios/archive/Runner.xcarchive -exportOptionsPlist build/ExportOptions.plist \
  -exportPath build/ios/ipa -allowProvisioningUpdates -quiet
IPA=$(ls build/ios/ipa/*.ipa | head -1)
echo "▸ Built $IPA (build $BUILD)"

if [ -n "${APPLE_ID:-}" ]; then
  if [ -n "${DIARY_ALTOOL_PW:-}" ]; then PW="@env:DIARY_ALTOOL_PW"; else PW="@keychain:DIARY_ALTOOL"; fi
  xcrun altool --upload-app -f "$IPA" -t ios -u "$APPLE_ID" -p "$PW"
  echo "✔ Uploaded. It shows up in TestFlight after Apple processes it (5–15 min)."
else
  echo "Set APPLE_ID to upload from here, or drag the .ipa into the Transporter app."
fi
