/// Plain data classes mirroring the Next.js API payloads.
library;

import 'package:flutter/material.dart' show Color;

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
  Field({required this.key, this.label, required this.type, this.min, this.max, this.step, this.stepper = false, this.unit, this.hint, this.closet, this.showIf, this.options = const []});
  final String key;
  final String? label;
  final FieldType type;
  final double? min, max, step;
  final bool stepper;
  final String? unit, hint, closet;
  final ShowIf? showIf;
  final List<String> options;
  String get title => label ?? key;

  factory Field.fromJson(Map<String, dynamic> j) => Field(
        key: _s(j['key']), label: j['label'] as String?, type: _type(j['type']),
        min: _d(j['min']), max: _d(j['max']), step: _d(j['step']), stepper: j['stepper'] == true, unit: j['unit'] as String?, hint: j['hint'] as String?, closet: j['closet'] as String?,
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
    required this.options, required this.closet, required this.isLogged, required this.loggedDates, required this.storeKind, this.weatherNote, this.outfits, this.week = const [],
  });
  final List<WeekDay> week;
  final OutfitSuggestions? outfits;
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
        closet: j['closet'] == null ? const {} : (j['closet'] as Map).map((k, v) => MapEntry(k.toString(), (v as List).map((e) => ClosetItem.fromJson(e as Map<String, dynamic>)).toList())),
        isLogged: j['isLogged'] == true, loggedDates: (j['loggedDates'] as List).map(_s).toList(), storeKind: _s(j['storeKind']),
        week: (j['week'] as List? ?? []).map((e) => WeekDay.fromJson(e as Map<String, dynamic>)).toList(),
        outfits: j['outfits'] == null ? null : OutfitSuggestions.fromJson(j['outfits'] as Map<String, dynamic>),
      );
}

class OutfitPiece {
  OutfitPiece(this.slot, this.id, this.label, this.values, this.why, {this.isNew = false});
  final String slot, id, label, why;
  final Map<String, String> values;
  /// Never worn this year (e.g. just added to the Virtual Closet).
  final bool isNew;
  factory OutfitPiece.fromJson(Map<String, dynamic> j) =>
      OutfitPiece(_s(j['slot']), _s(j['id']), _s(j['label']), _strMap(j['values']), _s(j['why']), isNew: j['isNew'] == true);
}

class OutfitSuggestion {
  OutfitSuggestion(this.title, this.tagline, this.pieces);
  final String title, tagline;
  final List<OutfitPiece> pieces;
  factory OutfitSuggestion.fromJson(Map<String, dynamic> j) =>
      OutfitSuggestion(_s(j['title']), _s(j['tagline']), (j['pieces'] as List).map((e) => OutfitPiece.fromJson(e as Map<String, dynamic>)).toList());

  /// Form patch mirroring the server's outfitToPatch().
  Map<String, String> toPatch() {
    final patch = <String, String>{};
    for (final p in pieces) {
      patch.addAll(p.values);
    }
    final hat = pieces.any((p) => p.slot == 'hat'), jacket = pieces.any((p) => p.slot == 'jacket'), socks = pieces.any((p) => p.slot == 'socks');
    if (!socks) {
      for (final c in ['Sock ID', 'Sock Color Primary', 'Sock Color Secondary', 'Sock Company', 'Sock Design', 'Sock Color Short']) {
        patch[c] = '';
      }
    }
    patch['Hat?'] = hat ? 'TRUE' : 'FALSE';
    patch['Jacket?'] = jacket ? 'TRUE' : 'FALSE';
    patch['Clothes Layers'] = jacket ? '2' : '1';
    if (!hat) {
      for (final c in ['Hat ID', 'Hat Type', 'Hat Color Primary', 'Hat Color Secondary', 'Hat Company', 'Hat Design', 'Hat Color Short']) {
        patch[c] = '';
      }
    }
    if (!jacket) {
      for (final c in ['Jacket ID', 'Jacket Type', 'Jacket Color Primary', 'Jacket Color Secondary', 'Jacket Company', 'Jacket Design', 'Jacket Color Short']) {
        patch[c] = '';
      }
    }
    return patch;
  }
}

class OutfitSuggestions {
  OutfitSuggestions({required this.feelsLike, required this.sky, required this.similarDays, required this.outfits, required this.shownKeys, required this.round, this.note, this.weekday = '', this.habits = const [], this.engine = 'history', this.claudeAvailable = false});
  final double? feelsLike;
  final String sky, weekday;
  /// 'claude' when Claude composed the outfits, 'history' for the instant/fallback picks.
  final String engine;
  final bool claudeAvailable;
  final List<String> habits;
  final int similarDays, round;
  final List<OutfitSuggestion> outfits;
  final List<String> shownKeys;
  final String? note;
  factory OutfitSuggestions.fromJson(Map<String, dynamic> j) => OutfitSuggestions(
        feelsLike: _d(j['weather']?['feelsLike']), sky: _s(j['weather']?['sky']), similarDays: (j['similarDays'] as num? ?? 0).toInt(),
        outfits: (j['outfits'] as List? ?? []).map((e) => OutfitSuggestion.fromJson(e as Map<String, dynamic>)).toList(),
        shownKeys: (j['shownKeys'] as List? ?? []).map(_s).toList(), round: (j['round'] as num? ?? 0).toInt(), note: j['note'] as String?,
        weekday: _s(j['weekday']), habits: (j['habits'] as List? ?? []).map(_s).toList(), engine: _s(j['engine']).isEmpty ? 'history' : _s(j['engine']), claudeAvailable: j['claudeAvailable'] == true);
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

class ClosetKindStats {
  ClosetKindStats(this.kind, this.label, this.total, this.green, this.greenPct, this.anyGreen, this.anyGreenPct, this.wornThisYear, this.wornPct, this.types);
  final String kind, label;
  final int total, green, anyGreen, wornThisYear;
  final double greenPct, anyGreenPct, wornPct;
  final List<Count> types;
  factory ClosetKindStats.fromJson(Map<String, dynamic> j) => ClosetKindStats(
      _s(j['kind']), _s(j['label']), (j['total'] as num? ?? 0).toInt(), (j['green'] as num? ?? 0).toInt(), _d(j['greenPct']) ?? 0,
      (j['anyGreen'] as num? ?? 0).toInt(), _d(j['anyGreenPct']) ?? 0, (j['wornThisYear'] as num? ?? 0).toInt(), _d(j['wornPct']) ?? 0,
      (j['types'] as List? ?? []).map((e) => Count.fromJson(e as Map<String, dynamic>)).toList());
}

/// /api/closet/stats — how green the Virtual Closet is, and how much of it gets worn.
class ClosetStats {
  ClosetStats({required this.year, required this.total, required this.greenPct, required this.anyGreenPct, required this.wornPct, required this.tiles, required this.kinds,
      required this.colorFamilies, required this.greenShades, required this.greenAccents, required this.brands, required this.mostWorn});
  final String year;
  final int total;
  final double greenPct, anyGreenPct, wornPct;
  final List<Tile> tiles;
  final List<ClosetKindStats> kinds;
  final List<Count> colorFamilies, greenShades, greenAccents, brands, mostWorn;
  static List<Count> _counts(dynamic v) => (v as List? ?? []).map((e) => Count.fromJson(e as Map<String, dynamic>)).toList();
  factory ClosetStats.fromJson(Map<String, dynamic> j) => ClosetStats(
        year: _s(j['year']), total: (j['total'] as num? ?? 0).toInt(), greenPct: _d(j['greenPct']) ?? 0, anyGreenPct: _d(j['anyGreenPct']) ?? 0, wornPct: _d(j['wornPct']) ?? 0,
        tiles: (j['tiles'] as List? ?? []).map((e) => Tile.fromJson(e as Map<String, dynamic>)).toList(),
        kinds: (j['kinds'] as List? ?? []).map((e) => ClosetKindStats.fromJson(e as Map<String, dynamic>)).toList(),
        colorFamilies: _counts(j['colorFamilies']), greenShades: _counts(j['greenShades']), greenAccents: _counts(j['greenAccents']), brands: _counts(j['brands']), mostWorn: _counts(j['mostWorn']),
      );
}

/// A day on the home calendar: shirt color is the fill, fun meter the number.
class CalendarDay {
  CalendarDay.fromJson(Map<String, dynamic> j)
      : date = _s(j['date']),
        logged = j['logged'] == true,
        future = j['future'] == true,
        fun = _d(j['fun']),
        hoursSlept = _d(j['hoursSlept']),
        sleepQuality = _d(j['sleepQuality']),
        productivity = _d(j['productivity']),
        steps = _d(j['steps']),
        shirtName = (j['shirt'] as Map?)?['name'] as String?,
        shirtHex = (j['shirt'] as Map?)?['hex'] as String?;
  final String date;
  final bool logged, future;
  final double? fun, hoursSlept, sleepQuality, productivity, steps;
  final String? shirtName, shirtHex;
  int get day => int.parse(date.substring(8, 10));
}

class CalendarMonth {
  CalendarMonth.fromJson(Map<String, dynamic> j)
      : month = _s(j['month']),
        label = _s(j['label']),
        today = _s(j['today']),
        days = (j['days'] as List? ?? []).map((e) => CalendarDay.fromJson(e as Map<String, dynamic>)).toList();
  final String month, label, today;
  final List<CalendarDay> days;
}

class WeekDay {
  WeekDay(this.date, this.logged, this.hex);
  final String date;
  final bool logged;
  final String? hex;
  factory WeekDay.fromJson(Map<String, dynamic> j) => WeekDay(_s(j['date']), j['logged'] == true, j['hex'] as String?);
}

/// "#4ade80" → Color.
Color hexColor(String? hex, [Color fallback = const Color(0xFF4ADE80)]) {
  if (hex == null || hex.length < 7) return fallback;
  final v = int.tryParse(hex.substring(1, 7), radix: 16);
  return v == null ? fallback : Color(0xFF000000 | v);
}

class Dashboard {
  Dashboard({required this.range, required this.start, required this.end, required this.daysLogged, required this.missingDays, required this.tiles, required this.days, required this.weeks,
      required this.shirtColors, required this.sky, required this.wakeCities, required this.people, required this.cuisines, required this.restaurants, required this.golf, this.calendar, this.streak = 0});
  final CalendarMonth? calendar;
  final int streak;
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
      calendar: j['calendar'] == null ? null : CalendarMonth.fromJson(j['calendar'] as Map<String, dynamic>), streak: (j['streak'] as num? ?? 0).toInt(),
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

/// /api/friends — per-person stats for days spent together (the Friends tab).
class FitPiece {
  FitPiece(this.slot, this.type, this.color, this.days);
  final String slot, type, color;
  final int days;
  factory FitPiece.fromJson(Map<String, dynamic> j) => FitPiece(_s(j['slot']), _s(j['type']), _s(j['color']), (j['days'] as num? ?? 0).toInt());
}

class GolfScore {
  GolfScore(this.date, this.course, this.score, this.toPar);
  final String date, course;
  final double score, toPar;
  factory GolfScore.fromJson(Map<String, dynamic> j) => GolfScore(_s(j['date']), _s(j['course']), _d(j['score']) ?? 0, _d(j['toPar']) ?? 0);
}

/// The notebook's per-person golf summary ("Friendship Golf").
class FriendGolf {
  FriendGolf.fromJson(Map<String, dynamic> j)
      : rounds = (j['rounds'] as num? ?? 0).toInt(),
        wins = (j['wins'] as num? ?? 0).toInt(),
        topCourse = j['topCourse'] as String?,
        minutes = (j['minutes'] as num? ?? 0).toInt(),
        water = (j['water'] as num? ?? 0).toInt(),
        bunkers = (j['bunkers'] as num? ?? 0).toInt(),
        score9 = _d(j['score9']),
        score18 = _d(j['score18']),
        best18 = _d(j['best18']),
        putts9 = _d(j['putts9']),
        putts18 = _d(j['putts18']),
        gir = _d(j['gir']),
        fir = _d(j['fir']),
        teeBox = j['teeBox'] as String?,
        cart = j['cart'] as String?,
        courses = (j['courses'] as List? ?? []).map((e) => Count.fromJson(e as Map<String, dynamic>)).toList(),
        games = (j['games'] as List? ?? []).map((e) => Count.fromJson(e as Map<String, dynamic>)).toList(),
        scores = (j['scores'] as List? ?? []).map((e) => GolfScore.fromJson(e as Map<String, dynamic>)).toList(),
        scramble = j['scramble'] == null ? null : Map<String, dynamic>.from(j['scramble'] as Map);
  final int rounds, wins, minutes, water, bunkers;
  final String? topCourse, teeBox, cart;
  final double? score9, score18, best18, putts9, putts18, gir, fir;
  final List<Count> courses, games;
  final List<GolfScore> scores;
  final Map<String, dynamic>? scramble;
}

class FriendProfile {
  FriendProfile.fromJson(Map<String, dynamic> j)
      : name = _s(j['name']),
        days = (j['days'] as num? ?? 0).toInt(),
        share = _d(j['share']) ?? 0,
        firstSeen = _s(j['firstSeen']),
        lastSeen = _s(j['lastSeen']),
        longestStreak = (j['longestStreak'] as num? ?? 0).toInt(),
        daysSince = (j['daysSince'] as num? ?? 0).toInt(),
        avgFun = _d(j['avgFun']),
        funLift = _d(j['funLift']),
        avgProductivity = _d(j['avgProductivity']),
        avgSleep = _d(j['avgSleep']),
        totalSleep = (j['totalSleep'] as num? ?? 0).toInt(),
        avgNaps = _d(j['avgNaps']),
        totalNaps = (j['totalNaps'] as num? ?? 0).toInt(),
        avgBattery = _d(j['avgBattery']),
        avgDrinks = _d(j['avgDrinks']),
        totalDrinks = (j['totalDrinks'] as num? ?? 0).toInt(),
        drinkDayPct = _d(j['drinkDayPct']) ?? 0,
        avgSteps = _d(j['avgSteps']),
        avgCalories = _d(j['avgCalories']),
        outsidePct = _d(j['outsidePct']) ?? 0,
        gymPct = _d(j['gymPct']) ?? 0,
        topSport = j['topSport'] as String?,
        topSky = j['topSky'] as String?,
        topDay = j['topDay'] as String?,
        sports = _counts(j['sports']),
        skies = _counts(j['skies']),
        weekdays = _counts(j['weekdays']),
        byMonth = _counts(j['byMonth']),
        cities = _counts(j['cities']),
        companions = _counts(j['companions']),
        restaurants = _counts(j['restaurants']),
        restaurantTypes = _counts(j['restaurantTypes']),
        foodRating = _d(j['foodRating']),
        videoGames = _counts(j['videoGames']),
        fit = (j['fit'] as List? ?? []).map((e) => FitPiece.fromJson(e as Map<String, dynamic>)).toList(),
        meat = (j['food'] as Map?)?['meat'] as String?,
        fruit = (j['food'] as Map?)?['fruit'] as String?,
        veg = (j['food'] as Map?)?['veg'] as String?,
        seenDates = (j['seenDates'] as List? ?? []).map(_s).toSet(),
        golf = FriendGolf.fromJson(Map<String, dynamic>.from(j['golf'] as Map? ?? {})),
        miniRounds = ((j['miniGolf'] as Map?)?['rounds'] as num? ?? 0).toInt(),
        miniWins = ((j['miniGolf'] as Map?)?['wins'] as num? ?? 0).toInt(),
        discRounds = ((j['discGolf'] as Map?)?['rounds'] as num? ?? 0).toInt(),
        discWins = ((j['discGolf'] as Map?)?['wins'] as num? ?? 0).toInt(),
        climbs = (j['climbs'] as num? ?? 0).toInt(),
        mealsOut = ((j['mealsOut'] as Map?)?['count'] as num? ?? 0).toInt(),
        topSpot = (j['mealsOut'] as Map?)?['topSpot'] as String?,
        byYear = (j['byYear'] as List? ?? []).map((e) => Count(_s((e as Map)['year']), _d(e['days']) ?? 0)).toList(),
        tiles = (j['tiles'] as List? ?? []).map((e) => Tile.fromJson(e as Map<String, dynamic>)).toList();

  static List<Count> _counts(dynamic v) => (v as List? ?? []).map((e) => Count.fromJson(e as Map<String, dynamic>)).toList();

  final String name, firstSeen, lastSeen;
  final int days, longestStreak, daysSince, totalSleep, totalNaps, totalDrinks, miniRounds, miniWins, discRounds, discWins, climbs, mealsOut;
  final FriendGolf golf;
  final double? foodRating;
  final double share, drinkDayPct, outsidePct, gymPct;
  final double? avgFun, funLift, avgProductivity, avgSleep, avgNaps, avgBattery, avgDrinks, avgSteps, avgCalories;
  final String? topSport, topSky, topDay, meat, fruit, veg, topSpot;
  final List<Count> sports, skies, weekdays, byMonth, cities, companions, restaurants, restaurantTypes, videoGames, byYear;
  final List<FitPiece> fit;
  final Set<String> seenDates;
  final List<Tile> tiles;
}

class FriendsData {
  FriendsData.fromJson(Map<String, dynamic> j)
      : start = _s(j['start']),
        end = _s(j['end']),
        year = _s(j['year']),
        daysLogged = (j['daysLogged'] as num? ?? 0).toInt(),
        friends = (j['friends'] as List? ?? []).map((e) => FriendProfile.fromJson(e as Map<String, dynamic>)).toList();
  final String start, end, year;
  final int daysLogged;
  final List<FriendProfile> friends;
}
