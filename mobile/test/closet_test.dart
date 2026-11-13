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

  test('short color family guess mirrors the server', () {
    expect(AddPieceSheetGuess.guess('Hunter Green'), 'Green');
    expect(AddPieceSheetGuess.guess('Navy Blue'), 'Blue');
    expect(AddPieceSheetGuess.guess('Charcoal Heather'), 'Gray');
    expect(AddPieceSheetGuess.guess('Paisley'), '');
  });

  testWidgets('add-piece sheet renders the columns, marks required ones and preselects the guessed family', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({'baseUrl': 'http://127.0.0.1:1', 'password': ''});
    final settings = await AppSettings.load();
    final form = ClosetKindForm.fromJson({
      'kind': 'shirt', 'nextId': '142',
      'columns': [
        {'key': 'Shirt Type', 'label': 'Type', 'type': 'suggest', 'required': false, 'options': ['T-Shirt', 'Polo']},
        {'key': 'Shirt Color Primary', 'label': 'Color Primary', 'type': 'suggest', 'required': true, 'options': ['Lime Green']},
        {'key': 'Shirt Color Short', 'label': 'Color Short', 'type': 'select', 'required': true, 'options': ['Green', 'Blue']},
      ],
    });
    await tester.pumpWidget(ApiScope(settings: settings, child: MaterialApp(home: Scaffold(body: AddPieceSheet(kind: 'shirt', form: form)))));
    await tester.pump();
    expect(find.text('#142'), findsOneWidget);
    expect(find.text('New shirt'), findsOneWidget);
    expect(find.text('Color Primary *'), findsOneWidget);
    expect(find.text('Type'), findsOneWidget);
    await tester.tap(find.text('Add to closet'));
    await tester.pump();
    expect(find.text('Color Primary is required.'), findsOneWidget);
    expect(tester.takeException(), isNull);
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
