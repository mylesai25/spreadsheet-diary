import 'package:diary/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Section parses fields and groups', () {
    final s = Section.fromJson({
      'id': 'sleep', 'title': 'Sleep', 'icon': '🛏️',
      'items': [
        {'key': 'Wake Up Time', 'type': 'time', 'default': 'mode'},
        {'group': 'Location', 'fields': [{'key': 'Wake Up City', 'type': 'select'}, {'key': 'Hat?', 'type': 'bool', 'showIf': {'key': 'Hat?', 'equals': 'TRUE'}}]},
      ],
    });
    expect(s.fields.length, 3);
    expect(s.items[1].group!.title, 'Location');
    expect(s.fields[2].showIf!.equals, 'TRUE');
    expect(s.fields[0].type, FieldType.time);
  });

  test('DailyData parses closet items and options', () {
    final d = DailyData.fromJson({
      'date': '2026-09-22', 'today': '2026-09-22', 'rowNumber': 266, 'values': {'Sky': 'Rain'}, 'defaults': {'Wake Up Time': '08:00'}, 'prev': {}, 'prevDate': '2026-09-21',
      'options': {'Sky': ['Cloudy', 'Sunny']}, 'closet': {'shirt': [{'id': '24', 'label': 'Lime Green · T-Shirt', 'values': {'Shirt Type': 'T-Shirt'}}]},
      'isLogged': false, 'loggedDates': ['2026-09-21'], 'storeKind': 'csv', 'weatherNote': null,
    });
    expect(d.closet['shirt']!.first.values['Shirt Type'], 'T-Shirt');
    expect(d.options['Sky'], ['Cloudy', 'Sunny']);
    expect(d.isLogged, false);
  });
}
