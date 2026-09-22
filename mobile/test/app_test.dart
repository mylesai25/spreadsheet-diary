import 'package:diary/api/client.dart';
import 'package:diary/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('app shell builds every tab without inherited-widget errors', (tester) async {
    SharedPreferences.setMockInitialValues({'baseUrl': 'http://127.0.0.1:1', 'password': ''});
    final settings = await AppSettings.load();
    await tester.pumpWidget(DiaryApp(settings: settings));
    await tester.pump(const Duration(milliseconds: 100));

    for (final tab in ['Dashboard', 'Activities', 'Settings', 'Log']) {
      await tester.tap(find.text(tab));
      await tester.pump(const Duration(milliseconds: 100));
    }
    // Network is unavailable in tests: screens must degrade to their error views, not throw.
    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull);
    expect(find.byType(NavigationBar), findsOneWidget);
  });
}
