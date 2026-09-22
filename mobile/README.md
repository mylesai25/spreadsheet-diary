# Diary — Flutter client

Native iOS/Android/macOS/web client for the Spreadsheet Diary. It has no Google credentials of its own:
it talks to the Next.js app's JSON API (`/api/*`), which owns the Google Sheet, smart defaults, closet lookups
and weather. The daily form is rendered from `/api/schema`, so adding a field in `src/lib/schema/daily.ts`
shows up here automatically.

```
lib/main.dart                 app shell (green Material 3 theme, bottom nav)
lib/api/client.dart           ApiClient + persisted settings (server URL, password)
lib/models/models.dart        payload models
lib/screens/log_screen.dart   Daily Overview form (sections, derived fields, weather, diff-based save)
lib/screens/dashboard_screen.dart   tiles + fl_chart charts
lib/screens/activities_screen.dart  activity sheets: add entry + recent
lib/screens/settings_screen.dart    server URL / password / connection test
lib/widgets/fields.dart       field renderers (toggle, rating, time, autocomplete, chips, closet picker)
```

## Run

1. Start the server in the repo root: `npm run dev` (port 3000).
2. `cd mobile && flutter pub get`
3. Pick a target:
   - **Web (no Xcode needed):** `flutter run -d chrome`
   - **iOS simulator / iPhone:** install Xcode + CocoaPods (`sudo gem install cocoapods`), then `flutter run -d ios`
   - **macOS desktop:** `flutter run -d macos` (also needs Xcode)
4. Point the app at the server — either in the **Settings** tab, or bake a default into the build:
   `flutter run -d ios --dart-define=DIARY_URL=http://Myless-MacBook-Pro.local:3000`
   Settings-tab values:
   - simulator / Chrome: `http://localhost:3000`
   - real iPhone on the same Wi‑Fi: `http://Myless-MacBook-Pro.local:3000` (or `http://192.168.1.152:3000`)
   - deployed: your Vercel URL + the `APP_PASSWORD`

Plain-http local traffic is allowed in `ios/Runner/Info.plist` (ATS) and the Android manifest for development;
tighten those before shipping anything public.

## Simulator without the IDE

```bash
flutter build ios --simulator --debug --dart-define=DIARY_URL=http://localhost:3000
xcrun simctl boot "iPhone 16" && open -a Simulator
xcrun simctl install booted build/ios/iphonesimulator/Runner.app && xcrun simctl launch booted com.mylesai.diary
```

## Checks

```bash
flutter analyze
flutter test
```
