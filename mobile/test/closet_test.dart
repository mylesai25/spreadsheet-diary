import 'package:diary/api/client.dart';
import 'package:diary/main.dart';
import 'package:diary/models/models.dart';
import 'package:diary/screens/closet_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('ClosetItem round-trips its photo URL through the cache JSON', () {
    final it = ClosetItem.fromJson({'id': '12', 'label': 'Lime Green · Polo', 'values': {'Shirt Color Primary': 'Lime Green', 'Shirt Type': 'Polo'}, 'image': '/api/closet/photo/shirt/12?v=abc'});
    expect(it.hasImage, isTrue);
    expect(ClosetItem.fromJson(it.toJson()).image, '/api/closet/photo/shirt/12?v=abc');
    expect(it.withImage(null).hasImage, isFalse);
    expect(it.col('Color Primary'), 'Lime Green');
    expect(ClosetItem.fromJson({'id': '1', 'label': 'x', 'values': {}}).hasImage, isFalse);
  });

  test('kind labels', () {
    expect(kindLabel('shoes'), 'Shoes');
    expect(kindLabel('pants'), 'Pants');
  });

  testWidgets('closet screen degrades to its error view offline and the piece sheet renders without a photo', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);   // the sheet's square photo pushes the buttons below a 600 px viewport
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({'baseUrl': 'http://127.0.0.1:1', 'password': ''});
    final settings = await AppSettings.load();
    await tester.pumpWidget(ApiScope(settings: settings, child: const MaterialApp(home: ClosetScreen())));
    await tester.pump(const Duration(seconds: 2));
    expect(find.textContaining('Could not load the closet'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final item = ClosetItem('7', 'Forest Green · Hoodie · Patagonia', {'Jacket Type': 'Hoodie', 'Jacket Color Primary': 'Forest Green', 'Jacket Company': 'Patagonia', 'Jacket Design': ''});
    await tester.pumpWidget(ApiScope(settings: settings, child: MaterialApp(home: Scaffold(body: PieceSheet(kind: 'jacket', item: item)))));
    await tester.pump();
    expect(find.text('#7'), findsOneWidget);
    expect(find.text('Hoodie · Jacket'), findsOneWidget);
    expect(find.text('Take photo'), findsOneWidget);
    expect(find.text('Choose photo'), findsOneWidget);
    expect(find.text('Remove photo'), findsNothing);   // nothing attached yet
    expect(find.text('Patagonia'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
