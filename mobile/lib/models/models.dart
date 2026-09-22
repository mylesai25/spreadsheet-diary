/// Plain data classes mirroring the Next.js API payloads.
library;

String _s(dynamic v) => v == null ? '' : v.toString();
Map<String, String> _strMap(dynamic m) => m == null ? {} : (m as Map).map((k, v) => MapEntry(k.toString(), _s(v)));
double? _d(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));

class Health {
  Health({required this.store, required this.authRequired});
  final String store;
  final bool authRequired;
  factory Health.fromJson(Map<String, dynamic> j) => Health(store: _s(j['store']), authRequired: j['authRequired'] == true);
}

enum FieldType { text, textarea, number, bool, time, select, multi, rating, closet, date }

FieldType _type(dynamic v) => FieldType.values.firstWhere((t) => t.name == v, orElse: () => FieldType.text);

class ShowIf {
  ShowIf(this.key, this.equals);
  final String key, equals;
}

class Field {
  Field({required this.key, this.label, required this.type, this.min, this.max, this.step, this.unit, this.hint, this.closet, this.showIf, this.options = const []});
  final String key;
  final String? label;
  final FieldType type;
  final double? min, max, step;
  final String? unit, hint, closet;
  final ShowIf? showIf;
  final List<String> options;
  String get title => label ?? key;

  factory Field.fromJson(Map<String, dynamic> j) => Field(
        key: _s(j['key']), label: j['label'] as String?, type: _type(j['type']),
        min: _d(j['min']), max: _d(j['max']), step: _d(j['step']), unit: j['unit'] as String?, hint: j['hint'] as String?, closet: j['closet'] as String?,
        showIf: j['showIf'] == null ? null : ShowIf(_s(j['showIf']['key']), _s(j['showIf']['equals'])),
        options: (j['options'] as List?)?.map(_s).toList() ?? const [],
      );
}

class FieldGroup {
  FieldGroup(this.title, this.fields);
  final String title;
  final List<Field> fields;
}

/// A section item is either a single field or a titled group of fields.
class SectionItem {
  SectionItem.field(this.field) : group = null;
  SectionItem.group(this.group) : field = null;
  final Field? field;
  final FieldGroup? group;
  List<Field> get fields => field != null ? [field!] : group!.fields;
}

class Section {
  Section({required this.id, required this.title, required this.icon, required this.items});
  final String id, title, icon;
  final List<SectionItem> items;
  List<Field> get fields => items.expand((i) => i.fields).toList();

  factory Section.fromJson(Map<String, dynamic> j) => Section(
        id: _s(j['id']), title: _s(j['title']), icon: _s(j['icon']),
        items: (j['items'] as List).map((it) {
          final m = it as Map<String, dynamic>;
          if (m.containsKey('group')) {
            return SectionItem.group(FieldGroup(_s(m['group']), (m['fields'] as List).map((f) => Field.fromJson(f as Map<String, dynamic>)).toList()));
          }
          return SectionItem.field(Field.fromJson(m));
        }).toList(),
      );
}

class ClosetItem {
  ClosetItem(this.id, this.label, this.values);
  final String id, label;
  final Map<String, String> values;
  factory ClosetItem.fromJson(Map<String, dynamic> j) => ClosetItem(_s(j['id']), _s(j['label']), _strMap(j['values']));
}

class DailyData {
  DailyData({
    required this.date, required this.today, required this.values, required this.defaults, required this.prev, this.prevDate,
    required this.options, required this.closet, required this.isLogged, required this.loggedDates, required this.storeKind, this.weatherNote,
  });
  final String date, today, storeKind;
  final Map<String, String> values, defaults, prev;
  final String? prevDate, weatherNote;
  final Map<String, List<String>> options;
  final Map<String, List<ClosetItem>> closet;
  final bool isLogged;
  final List<String> loggedDates;

  factory DailyData.fromJson(Map<String, dynamic> j) => DailyData(
        date: _s(j['date']), today: _s(j['today']), values: _strMap(j['values']), defaults: _strMap(j['defaults']), prev: _strMap(j['prev']),
        prevDate: j['prevDate'] as String?, weatherNote: j['weatherNote'] as String?,
        options: (j['options'] as Map).map((k, v) => MapEntry(k.toString(), (v as List).map(_s).toList())),
        closet: (j['closet'] as Map).map((k, v) => MapEntry(k.toString(), (v as List).map((e) => ClosetItem.fromJson(e as Map<String, dynamic>)).toList())),
        isLogged: j['isLogged'] == true, loggedDates: (j['loggedDates'] as List).map(_s).toList(), storeKind: _s(j['storeKind']),
      );
}

class WeatherResult {
  WeatherResult(this.values, this.place);
  final Map<String, String> values;
  final String place;
  factory WeatherResult.fromJson(Map<String, dynamic> j) => WeatherResult(_strMap(j['values']), _s(j['place']));
}

class Tile {
  Tile(this.label, this.value, this.sub);
  final String label, value;
  final String? sub;
  factory Tile.fromJson(Map<String, dynamic> j) => Tile(_s(j['label']), _s(j['value']), j['sub'] as String?);
}

class DayPoint {
  DayPoint(this.date, this.hoursSlept, this.sleep7, this.fun, this.productivity, this.steps, this.steps7, this.restingHR);
  final String date;
  final double? hoursSlept, sleep7, fun, productivity, steps, steps7, restingHR;
  factory DayPoint.fromJson(Map<String, dynamic> j) => DayPoint(_s(j['date']), _d(j['hoursSlept']), _d(j['sleep7']), _d(j['fun']), _d(j['productivity']), _d(j['steps']), _d(j['steps7']), _d(j['restingHR']));
}

class WeekPoint {
  WeekPoint(this.label, this.gymDays, this.drinks, this.cooked, this.restaurant, this.stepsAvg);
  final String label;
  final double gymDays, drinks, cooked, restaurant;
  final double? stepsAvg;
  factory WeekPoint.fromJson(Map<String, dynamic> j) => WeekPoint(_s(j['label']), _d(j['gymDays']) ?? 0, _d(j['drinks']) ?? 0, _d(j['cooked']) ?? 0, _d(j['restaurant']) ?? 0, _d(j['stepsAvg']));
}

class Count {
  Count(this.name, this.value);
  final String name;
  final double value;
  factory Count.fromJson(Map<String, dynamic> j) => Count(_s(j['name']), _d(j['value']) ?? 0);
}

class GolfRound {
  GolfRound(this.date, this.course, this.score, this.toPar, this.putts);
  final String date, course;
  final double score, toPar;
  final double? putts;
  factory GolfRound.fromJson(Map<String, dynamic> j) => GolfRound(_s(j['date']), _s(j['course']), _d(j['score']) ?? 0, _d(j['toPar']) ?? 0, _d(j['putts']));
}

class Dashboard {
  Dashboard({required this.range, required this.start, required this.end, required this.daysLogged, required this.missingDays, required this.tiles, required this.days, required this.weeks,
      required this.shirtColors, required this.sky, required this.wakeCities, required this.people, required this.cuisines, required this.restaurants, required this.golf});
  final String range, start, end;
  final int daysLogged, missingDays;
  final List<Tile> tiles;
  final List<DayPoint> days;
  final List<WeekPoint> weeks;
  final List<Count> shirtColors, sky, wakeCities, people, cuisines, restaurants;
  final List<GolfRound> golf;

  factory Dashboard.fromJson(Map<String, dynamic> j) {
    List<Count> counts(String k) => (j[k] as List? ?? []).map((e) => Count.fromJson(e as Map<String, dynamic>)).toList();
    return Dashboard(
      range: _s(j['range']), start: _s(j['start']), end: _s(j['end']), daysLogged: (j['daysLogged'] as num).toInt(), missingDays: (j['missingDays'] as num? ?? 0).toInt(),
      tiles: (j['tiles'] as List).map((e) => Tile.fromJson(e as Map<String, dynamic>)).toList(),
      days: (j['days'] as List).map((e) => DayPoint.fromJson(e as Map<String, dynamic>)).toList(),
      weeks: (j['weeks'] as List).map((e) => WeekPoint.fromJson(e as Map<String, dynamic>)).toList(),
      shirtColors: counts('shirtColors'), sky: counts('sky'), wakeCities: counts('wakeCities'), people: counts('people'), cuisines: counts('cuisines'), restaurants: counts('restaurants'),
      golf: (j['golf'] as List? ?? []).map((e) => GolfRound.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class ActivityInfo {
  ActivityInfo(this.slug, this.title, this.icon, this.sheet, this.dateKey);
  final String slug, title, icon, sheet;
  final String? dateKey;
  factory ActivityInfo.fromJson(Map<String, dynamic> j) => ActivityInfo(_s(j['slug']), _s(j['title']), _s(j['icon']), _s(j['sheet']), j['dateKey'] as String?);
}

class ActivityData {
  ActivityData({required this.info, required this.groups, required this.recent, required this.total, required this.today, required this.listCols});
  final ActivityInfo info;
  final List<FieldGroup> groups;
  final List<Map<String, String>> recent;
  final int total;
  final String today;
  final List<String> listCols;

  factory ActivityData.fromJson(Map<String, dynamic> j) {
    final cfg = j['config'] as Map<String, dynamic>;
    final header = (j['header'] as List).map(_s).toList();
    return ActivityData(
      info: ActivityInfo.fromJson(cfg),
      groups: (j['groups'] as List).map((g) => FieldGroup(_s(g['title']), (g['fields'] as List).map((f) => Field.fromJson(f as Map<String, dynamic>)).toList())).toList(),
      recent: (j['recent'] as List).map(_strMap).toList(),
      total: (j['total'] as num).toInt(), today: _s(j['today']),
      listCols: (cfg['listCols'] as List?)?.map(_s).toList() ?? header.take(5).toList(),
    );
  }
}
