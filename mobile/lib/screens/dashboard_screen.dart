import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/activity_charts.dart';
import '../widgets/bars.dart';

const _ranges = [('7d', '7 days'), ('30d', '30 days'), ('90d', '90 days'), ('ytd', 'This year'), ('all', 'All')];

/// The chart menu, grouped like the Diary_Graphs notebook (same ids as the web app's chartCatalog.ts).
class _Cat {
  const _Cat(this.key, this.label, this.icon);
  final String key, label, icon;
}

class _Chart {
  const _Chart(this.id, this.cat, this.title, [this.sub]);
  final String id, cat, title;
  final String? sub;
}

const _cats = [
  _Cat('overview', 'Overview', '📓'), _Cat('sleep', 'Sleep & mood', '😴'), _Cat('fitness', 'Fitness', '💪'), _Cat('golf', 'Golf', '⛳'),
  _Cat('minigolf', 'Mini golf', '🏌️'), _Cat('discgolf', 'Disc golf', '🥏'),
  _Cat('climbing', 'Climbing', '🧗'), _Cat('skiing', 'Skiing', '⛷️'), _Cat('food', 'Food & drink', '🍜'), _Cat('wardrobe', 'Wardrobe', '👕'),
  _Cat('people', 'People', '👥'), _Cat('travel', 'Travel & weather', '🚆'), _Cat('work', 'Work', '💻'), _Cat('fun', 'Games & screen', '🎮'),
];

const _charts = [
  _Chart('tiles', 'overview', 'Headline numbers', 'Days logged, sleep, fun, steps, gym, drinks, meals'),
  _Chart('streaks', 'overview', 'Streaks', 'Longest run of each good habit in this range, and where it stands now'),
  _Chart('weekday', 'overview', 'Weekday profile', 'Average fun, productivity and sleep by day of the week'),
  _Chart('sleep', 'sleep', 'Sleep', 'Hours slept with 7-day average'),
  _Chart('funProd', 'sleep', 'Fun & productivity', 'Daily self-ratings, 1–10'),
  _Chart('hours', 'sleep', 'Bedtime & wake-up', 'Nights by bedtime hour, mornings by wake-up hour'),
  _Chart('battery', 'sleep', 'Morning phone battery', 'Mornings by battery left when you woke up'),
  _Chart('funSky', 'sleep', 'Fun by weather', 'Average fun meter on days with each sky (3+ days)'),
  _Chart('steps', 'fitness', 'Steps'),
  _Chart('gymWeeks', 'fitness', 'Gym days per week'),
  _Chart('sportBubbles', 'fitness', 'Hours by sport', 'Circle area = time played'),
  _Chart('sportDays', 'fitness', 'Days by sport', 'Days each sport was played'),
  _Chart('stepsWeekday', 'fitness', 'Steps by weekday', 'Average steps per day of the week'),
  _Chart('golfTiles', 'golf', 'Golf numbers', 'Solo rounds (Regular / Wolf), like the notebook'),
  _Chart('golfScores18', 'golf', '18-hole scores', 'Every solo 18-hole round, in order played'),
  _Chart('golfToPar', 'golf', 'Score to par', 'Per round, over time'),
  _Chart('golfOutcomes', 'golf', 'Hole outcomes', 'Birdies, pars, bogeys… across solo rounds'),
  _Chart('golfCumulative', 'golf', 'Outcomes, round by round', 'Running count of each hole result'),
  _Chart('golfPutts', 'golf', 'Putting', 'Holes by putt count'),
  _Chart('golfCourses', 'golf', 'Courses played', 'Rounds per course'),
  _Chart('golfFairways', 'golf', 'Fairways & greens hit', 'FIR% and GIR% per solo round, in order played'),
  _Chart('golfByCourse', 'golf', 'Score to par by course', 'Average strokes over par, solo rounds · easiest first'),
  _Chart('golfCart', 'golf', 'Cart vs walking', 'Median 18-hole score'),
  _Chart('miniTiles', 'minigolf', 'Mini golf numbers', 'Rounds, scoring, hole-in-ones, wins'),
  _Chart('miniScores', 'minigolf', 'Rounds to par', 'Strokes over par per round, in order played'),
  _Chart('miniPutts', 'minigolf', 'Putts per hole', 'Hole-in-ones to four-putts'),
  _Chart('miniCourses', 'minigolf', 'Courses played', 'Rounds per course'),
  _Chart('miniWinners', 'minigolf', 'Who won', 'Rounds won by each player'),
  _Chart('discTiles', 'discgolf', 'Disc golf numbers', 'Rounds, scoring, birdies, wins, miles'),
  _Chart('discScores', 'discgolf', 'Rounds to par', 'Throws over par per round, in order played'),
  _Chart('discOutcomes', 'discgolf', 'Hole outcomes', 'Aces, birdies, pars, bogeys…'),
  _Chart('discCumulative', 'discgolf', 'Outcomes, round by round', 'Running count of each hole result'),
  _Chart('discCourses', 'discgolf', 'Courses played', 'Rounds per course'),
  _Chart('discWinners', 'discgolf', 'Who won', 'Rounds won by each player'),
  _Chart('climbTiles', 'climbing', 'Climbing numbers', 'Sessions, time on the wall, sends'),
  _Chart('climbGrades', 'climbing', 'Climbs completed', 'By V-grade'),
  _Chart('climbCumulative', 'climbing', 'Sends, session by session', 'Running count of completed climbs per grade'),
  _Chart('climbSendRate', 'climbing', 'Send rate', 'Completed ÷ attempted, per grade'),
  _Chart('climbGyms', 'climbing', 'Gyms', 'Sessions per gym'),
  _Chart('climbColors', 'climbing', 'Color circuits sent', 'Gyms that grade by color instead of V-grade'),
  _Chart('climbColorRate', 'climbing', 'Send rate by color', 'Completed ÷ attempted, per circuit'),
  _Chart('skiTiles', 'skiing', 'Ski numbers', 'Days, hours, runs, falls'),
  _Chart('skiRuns', 'skiing', 'Runs by difficulty', 'Green to double black'),
  _Chart('skiCumulative', 'skiing', 'Runs, day by day', 'Running count of runs per difficulty'),
  _Chart('skiFalls', 'skiing', 'Falls by difficulty', 'Where the wipeouts happen'),
  _Chart('drinks', 'food', 'Drinks per week'),
  _Chart('cuisines', 'food', 'Cuisines', 'Restaurant visits'),
  _Chart('restaurants', 'food', 'Top restaurants', 'Visits'),
  _Chart('drinkTypes', 'food', 'What you drank', 'Days each drink type showed up'),
  _Chart('cuisineRatings', 'food', 'Best-rated cuisines', 'Average food rating, 2+ visits'),
  _Chart('shirtColors', 'wardrobe', 'Shirt colors', 'Days worn'),
  _Chart('jacketTemp', 'wardrobe', 'When the jacket comes out', 'Share of days with a jacket, hat or two layers, by high temperature'),
  _Chart('people', 'people', 'People seen most', 'Days together'),
  _Chart('sky', 'travel', 'Sky', 'Days'),
  _Chart('wakeCities', 'travel', 'Woke up in', 'Days per city'),
  _Chart('projects', 'work', 'Projects', 'Days worked on each'),
  _Chart('projectProd', 'work', 'Productivity by project', 'Average productivity on days you worked on each (3+ days)'),
  _Chart('gameRatings', 'fun', 'Game ratings', 'Your Video Game Rankings sheet, out of 10'),
  _Chart('boardGames', 'fun', 'Board games', 'Days played'),
  _Chart('tvRatings', 'fun', 'TV ratings', 'Your Year Rankings sheet, out of 10'),
  _Chart('movieRatings', 'fun', 'Movie ratings', 'Your Year Rankings sheet, out of 10'),
  _Chart('broadwayRatings', 'fun', 'Broadway ratings', 'Your Year Rankings sheet, out of 10'),
  _Chart('shows', 'fun', 'Dinner-table TV', 'Shows watched during meals, by days'),
  _Chart('services', 'fun', 'Streaming services', 'Meals watched on each'),
];

const _defaultCharts = [
  'tiles', 'streaks', 'weekday', 'sleep', 'funProd', 'steps', 'gymWeeks', 'sportBubbles',
  'golfTiles', 'golfScores18', 'golfOutcomes', 'golfCumulative',
  'climbTiles', 'climbGrades', 'climbCumulative',
  'drinks', 'shirtColors', 'people', 'sky',
];
const _kCharts = 'dash_charts';
/// Build-time starting selection (comma-separated ids), e.g. for simulator screenshots; saved choices still win.
const _presetCharts = String.fromEnvironment('DIARY_CHARTS');
/// Build-time starting range (7d/30d/90d/ytd/all), also for screenshots.
const _presetRange = String.fromEnvironment('DIARY_RANGE', defaultValue: '30d');

/// Key metrics from /api/dashboard: tiles + a handful of fl_chart charts, drawn like the Diary_Graphs figures.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _range = _presetRange;
  late Future<(Dashboard, ActivityStats)> _future;
  bool _closet = false;
  Future<ClosetStats>? _closetFuture;
  Set<String> _selected = _presetCharts.isEmpty ? _defaultCharts.toSet() : _presetCharts.split(',').toSet();

  @override
  void initState() {
    super.initState();
    _future = _load();
    SharedPreferences.getInstance().then((p) {
      final saved = p.getStringList(_kCharts);
      if (saved != null && mounted) setState(() => _selected = saved.where((id) => _charts.any((c) => c.id == id)).toSet());
    });
  }

  Future<(Dashboard, ActivityStats)> _load() async {
    final api = ApiScope.api(context);
    final r = await Future.wait([api.dashboard(_range), api.activityStats(_range)]);
    return (r[0] as Dashboard, r[1] as ActivityStats);
  }

  void _select(Set<String> next) {
    setState(() => _selected = next);
    SharedPreferences.getInstance().then((p) => p.setStringList(_kCharts, next.toList()));
  }

  void _toggle(String id) => _select(_selected.contains(id) ? (_selected.toSet()..remove(id)) : (_selected.toSet()..add(id)));
  List<_Chart> _inCat(String cat) => _charts.where((c) => c.cat == cat).toList();
  int _catCount(String cat) => _inCat(cat).where((c) => _selected.contains(c.id)).length;
  void _toggleCat(String cat) {
    final ids = _inCat(cat).map((c) => c.id).toSet();
    _select(_catCount(cat) > 0 ? _selected.difference(ids) : _selected.union(ids));
  }

  /// Category chips: tap to show or hide a whole section; the count shows how many of its figures are on.
  Widget _catChips() => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [
          for (final c in _cats)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: FilterChip(
                label: Text('${c.icon} ${c.label} ${_catCount(c.key)}/${_inCat(c.key).length}'),
                labelStyle: TextStyle(color: _catCount(c.key) > 0 ? Fig.paper : Fig.ink2, fontSize: 13, fontWeight: _catCount(c.key) > 0 ? FontWeight.w700 : FontWeight.w500),
                selected: _catCount(c.key) > 0, showCheckmark: false, onSelected: (_) => _toggleCat(c.key),
              ),
            ),
          ActionChip(avatar: const Icon(Icons.tune, size: 16), label: const Text('Customize'), onPressed: _customize),
        ]),
      );

  /// Bottom sheet with a checkbox for every chart.
  Future<void> _customize() => showModalBottomSheet<void>(
        context: context, isScrollControlled: true, useSafeArea: true,
        builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
          void pick(Set<String> next) { _select(next); setSheet(() {}); }
          return DraggableScrollableSheet(
            expand: false, initialChildSize: 0.85, maxChildSize: 0.95,
            builder: (ctx, scroll) => ListView(
              controller: scroll, padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Choose your charts', style: Fig.cardTitle), Text('${_selected.length} of ${_charts.length} on · saved on this phone', style: Fig.cardSub)])),
                  TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
                ]),
                Wrap(spacing: 6, children: [
                  OutlinedButton(onPressed: () => pick(_charts.map((c) => c.id).toSet()), child: const Text('Show all')),
                  OutlinedButton(onPressed: () => pick({}), child: const Text('Hide all')),
                  OutlinedButton(onPressed: () => pick(_defaultCharts.toSet()), child: const Text('Reset')),
                ]),
                for (final cat in _cats) ...[
                  Padding(
                    padding: const EdgeInsets.only(top: 14, bottom: 2),
                    child: Row(children: [
                      Expanded(child: Text('${cat.icon} ${cat.label}', style: const TextStyle(color: Fig.ink, fontSize: 15, fontWeight: FontWeight.w800))),
                      TextButton(onPressed: () => pick(_inCat(cat.key).map((c) => c.id).toSet()), child: const Text('only')),
                      TextButton(onPressed: () { final ids = _inCat(cat.key).map((c) => c.id).toSet(); pick(_catCount(cat.key) > 0 ? _selected.difference(ids) : _selected.union(ids)); }, child: Text(_catCount(cat.key) > 0 ? 'none' : 'all')),
                    ]),
                  ),
                  for (final c in _inCat(cat.key))
                    CheckboxListTile(
                      dense: true, contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, activeColor: Fig.neon,
                      value: _selected.contains(c.id), onChanged: (_) => pick(_selected.contains(c.id) ? (_selected.toSet()..remove(c.id)) : (_selected.toSet()..add(c.id))),
                      title: Text(c.title, style: const TextStyle(color: Fig.ink, fontSize: 14)), subtitle: c.sub == null ? null : Text(c.sub!, style: Fig.smallMuted, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                ],
              ],
            ),
          );
        }),
      );

  /// Draws one catalogue entry from the merged data.
  Widget _chart(String id, Dashboard d, ActivityStats a) {
    switch (id) {
      case 'tiles': return _tiles(d.tiles);
      case 'streaks': return TileRow(a.extras.streaks);
      case 'weekday': return GroupBars(a.extras.weekday, keys: const ['fun', 'productivity', 'sleep'], names: const ['Fun meter', 'Productivity', 'Hours slept'], max: 10);
      case 'sleep': return _sleepChart(d);
      case 'funProd': return _funChart(d);
      case 'hours': return GroupBars(a.extras.hours, keys: const ['bed', 'wake'], names: const ['Bedtime', 'Wake-up']);
      case 'battery': return GroupBars([for (final c in a.extras.battery) GroupRow(c.name.replaceAll('–', '-').replaceAll('%', ''), {'days': c.value}, 0)], keys: const ['days'], names: const ['Mornings']);
      case 'funSky': return RankBars(a.extras.funBySky, max: 10);
      case 'steps': return _stepsChart(d);
      case 'gymWeeks': return _weekBars(d.weeks.map((w) => w.gymDays).toList(), d.weeks.map((w) => w.label).toList());
      case 'sportBubbles': return BubblePack(a.sportHours);
      case 'sportDays': return RankBars(a.extras.sportDays);
      case 'stepsWeekday': return GroupBars(a.extras.weekday, keys: const ['steps'], names: const ['Avg steps']);
      case 'golfTiles': return TileRow(a.golf.tiles);
      case 'golfScores18': return ScoreLine(a.golf.scores18);
      case 'golfToPar': return d.golf.isEmpty ? const EmptyChart() : _golfChart(d);
      case 'golfOutcomes': return DonutChart(a.golf.outcomes, unit: 'holes');
      case 'golfCumulative': return CumulativeChart(a.golf.cumulative);
      case 'golfPutts': return RankBars(a.golf.putts);
      case 'golfCourses': return RankBars(a.golf.courses, labelWidth: 130);
      case 'golfFairways': return CumulativeChart(a.golf.fairwaysGreens, maxY: 100, unit: '%');
      case 'golfByCourse': return RankBars(a.golf.byCourse, labelWidth: 130);
      case 'golfCart': return RankBars(a.golf.cart);
      case 'miniTiles': return TileRow(a.miniGolf.tiles);
      case 'miniScores': return ScoreLine(a.miniGolf.scores, toPar: true);
      case 'miniPutts': return DonutChart(a.miniGolf.putts, unit: 'holes');
      case 'miniCourses': return RankBars(a.miniGolf.courses, labelWidth: 130);
      case 'miniWinners': return RankBars(a.miniGolf.winners);
      case 'discTiles': return TileRow(a.discGolf.tiles);
      case 'discScores': return ScoreLine(a.discGolf.scores, toPar: true);
      case 'discOutcomes': return DonutChart(a.discGolf.outcomes, unit: 'holes');
      case 'discCumulative': return CumulativeChart(a.discGolf.cumulative);
      case 'discCourses': return RankBars(a.discGolf.courses, labelWidth: 130);
      case 'discWinners': return RankBars(a.discGolf.winners);
      case 'climbTiles': return TileRow(a.climb.tiles);
      case 'climbGrades': return DonutChart(a.climb.grades, unit: 'climbs');
      case 'climbCumulative': return CumulativeChart(a.climb.cumulative);
      case 'climbSendRate': return SendRateBars(a.climb.sendRate);
      case 'climbGyms': return RankBars(a.climb.gyms);
      case 'climbColors': return DonutChart(a.climb.colors, unit: 'climbs');
      case 'climbColorRate': return SendRateBars(a.climb.colorSendRate);
      case 'skiTiles': return TileRow(a.ski.tiles);
      case 'skiRuns': return DonutChart(a.ski.runs, unit: 'runs');
      case 'skiCumulative': return CumulativeChart(a.ski.cumulative);
      case 'skiFalls': return DonutChart(a.ski.falls, unit: 'falls');
      case 'drinks': return _weekBars(d.weeks.map((w) => w.drinks).toList(), d.weeks.map((w) => w.label).toList());
      case 'cuisines': return RankBars(d.cuisines);
      case 'restaurants': return RankBars(d.restaurants, labelWidth: 130);
      case 'drinkTypes': return RankBars(a.extras.drinkTypes);
      case 'cuisineRatings': return RankBars(a.extras.cuisineRatings, max: 10);
      case 'shirtColors': return RankBars(d.shirtColors, colorByName: true);
      case 'jacketTemp': return GroupBars(a.extras.jacketByTemp, keys: const ['jacket', 'hat', 'layers'], names: const ['Jacket', 'Hat', '2 layers'], max: 100, unit: '%', fmt: (v) => v.toInt().toString());
      case 'people': return RankBars(d.people);
      case 'sky': return RankBars(d.sky);
      case 'wakeCities': return RankBars(d.wakeCities);
      case 'projects': return RankBars(a.extras.projects);
      case 'projectProd': return RankBars(a.extras.projectProd, max: 10);
      case 'gameRatings': return RankBars(a.extras.games, max: 10, labelWidth: 130);
      case 'boardGames': return RankBars(a.extras.boardGames);
      case 'tvRatings': return RankBars(a.extras.tv, max: 10, labelWidth: 150);
      case 'movieRatings': return RankBars(a.extras.movies, max: 10, labelWidth: 130);
      case 'broadwayRatings': return RankBars(a.extras.broadway, max: 10, labelWidth: 130);
      case 'shows': return RankBars(a.extras.shows, labelWidth: 150);
      case 'services': return RankBars(a.extras.services);
      default: return const EmptyChart();
    }
  }

  String? _sub(_Chart c, Dashboard d, ActivityStats a) {
    if (c.id == 'golfOutcomes' || c.id == 'golfPutts') return a.golf.note;
    if (c.id == 'steps') return d.days.length > 60 ? 'Average per day, by week' : 'Per day';
    if (c.id == 'miniTiles' || c.id == 'miniScores') return a.miniGolf.rounds > 0 ? '${a.miniGolf.rounds} rounds in range' : 'No mini golf in range';
    if (c.id == 'discTiles' || c.id == 'discScores') return a.discGolf.rounds > 0 ? '${a.discGolf.rounds} rounds in range' : 'No disc golf in range';
    return c.sub;
  }

  void _setRange(String r) => setState(() { _closet = false; _range = r; _future = _load(); });
  void _showCloset() => setState(() { _closet = true; _closetFuture ??= ApiScope.api(context).closetStats(); });
  void _refresh() => setState(() { if (_closet) { _closetFuture = ApiScope.api(context).closetStats(); } else { _future = _load(); } });

  /// Time-range chips plus the Closet tab (the whole Virtual Closet, not a time range).
  Widget _chips() => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (final r in _ranges) Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(label: Text(r.$2), selected: !_closet && _range == r.$1, showCheckmark: false, onSelected: (_) => _setRange(r.$1))),
          Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(label: const Text('👕 Closet'), selected: _closet, showCheckmark: false, onSelected: (_) => _showCloset())),
        ]),
      );

  Widget _tiles(List<Tile> tiles) => GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.85,
        children: [for (final t in tiles) FigTile(label: t.label, value: t.value, sub: t.sub)],
      );

  Widget _closetBody() => RefreshIndicator(
        onRefresh: () async { _refresh(); await _closetFuture; },
        child: FutureBuilder<ClosetStats>(
          future: _closetFuture,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return ListView(children: [_chips(), const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))]);
            if (snap.hasError) return ListView(children: [_chips(), Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}'))]);
            final s = snap.data!;
            final green = s.kinds.fold<int>(0, (n, k) => n + k.green);
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              children: [
                _chips(),
                Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('${s.total} pieces · ${s.greenPct}% green · ${s.anyGreenPct}% with some green', style: Fig.small)),
                _tiles(s.tiles),
                const SizedBox(height: 12),
                FigCard(
                  title: 'By kind',
                  sub: 'Share of each kind that is green, has any green, and was worn in ${s.year}',
                  child: Column(children: [
                    const Row(children: [
                      SizedBox(width: 64),
                      Expanded(child: Text('PCS', style: Fig.tileLabel)),
                      Expanded(child: Text('GREEN', style: Fig.tileLabel)),
                      Expanded(child: Text('ANY', style: Fig.tileLabel)),
                      Expanded(child: Text('WORN', style: Fig.tileLabel)),
                    ]),
                    const Divider(height: 10, thickness: 1, color: Fig.frame),
                    for (final k in s.kinds)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            SizedBox(width: 64, child: Text(k.label, style: const TextStyle(color: Fig.ink, fontWeight: FontWeight.w800, fontSize: 13))),
                            Expanded(child: Text('${k.total}', style: Fig.small)),
                            Expanded(child: Text('${k.greenPct.round()}%', style: const TextStyle(fontSize: 13, color: Fig.neon, fontWeight: FontWeight.w800))),
                            Expanded(child: Text('${k.anyGreenPct.round()}%', style: Fig.small)),
                            Expanded(child: Text('${k.wornPct.round()}%', style: Fig.small)),
                          ]),
                          if (k.types.isNotEmpty) Padding(padding: const EdgeInsets.only(left: 64), child: Text(k.types.map((t) => '${t.name} (${t.value.toInt()})').join(', '), style: Fig.smallMuted, maxLines: 1, overflow: TextOverflow.ellipsis)),
                        ]),
                      ),
                  ]),
                ),
                const FigHeading('Colors'),
                FigCard(title: 'My Closet by Color — Percent', sub: 'Short color of every piece', child: VerticalBars(s.colorFamilies, colorByName: true, asPercentOf: s.total.toDouble())),
                FigCard(title: "My Closet's Shades of Green — Percent", sub: 'Primary color of the $green green pieces', child: VerticalBars(s.greenShades.take(8).toList(), colorByName: true, asPercentOf: green.toDouble())),
                const FigHeading('Wear'),
                FigCard(title: 'Brands in the Closet — Percent', sub: 'Share of all pieces per brand', child: VerticalBars(s.brands.take(8).toList(), asPercentOf: s.total.toDouble())),
                FigCard(title: 'Green goes with', sub: 'Accent colors on green pieces', child: RankBars(s.greenAccents, colorByName: true)),
                FigCard(title: 'Most worn in ${s.year}', sub: 'Days worn, top two pieces of each kind', child: RankBars(s.mostWorn, labelWidth: 150)),
              ],
            );
          },
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard'), actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _refresh)]),
      body: _closet ? _closetBody() : RefreshIndicator(
        onRefresh: () async { setState(() => _future = _load()); await _future; },
        child: FutureBuilder<(Dashboard, ActivityStats)>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
            if (snap.hasError) return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}'))]);
            final (d, a) = snap.data!;
            final sections = [for (final cat in _cats) (cat, _inCat(cat.key).where((c) => _selected.contains(c.id)).toList())].where((s) => s.$2.isNotEmpty).toList();
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              children: [
                _chips(),
                _catChips(),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text('${_fmtDate(d.start)} – ${_fmtDate(d.end)} · ${d.daysLogged} days logged${d.missingDays > 0 ? ' · ${d.missingDays} missing' : ''}', style: Fig.small),
                ),
                if (sections.isEmpty)
                  Card(child: Padding(padding: const EdgeInsets.all(28), child: Column(children: [
                    const Text('No charts selected', style: Fig.small),
                    const SizedBox(height: 10),
                    FilledButton(onPressed: () => _select(_defaultCharts.toSet()), child: const Text('Show the default set')),
                  ]))),
                for (final (cat, charts) in sections) ...[
                  FigHeading('${cat.icon} ${cat.label}'),
                  for (final c in charts)
                    FigCard(
                      title: c.title, sub: _sub(c, d, a),
                      trailing: IconButton(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28), tooltip: 'Hide', icon: const Icon(Icons.close, size: 16, color: Fig.muted), onPressed: () => _toggle(c.id)),
                      child: _chart(c.id, d, a),
                    ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  static String _fmtDate(String iso) => DateFormat('MMM d').format(DateTime.parse(iso));

  // ── charts ──

  static FlTitlesData _dateTitles(List<String> dates, {String Function(double)? left}) {
    final n = dates.length;
    return FlTitlesData(
      topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
      leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, m) => Text(left?.call(v) ?? v.toStringAsFixed(0), style: Fig.axisText))),
      bottomTitles: AxisTitles(sideTitles: SideTitles(
        showTitles: true, reservedSize: 22, interval: 1,
        getTitlesWidget: (v, m) {
          final i = v.toInt();
          if (i < 0 || i >= n) return const SizedBox.shrink();
          final dt = DateTime.parse(dates[i]);
          final show = n <= 10 || (n <= 35 && dt.weekday == DateTime.sunday) || (n > 35 && n <= 120 && (dt.day == 1 || dt.day == 15)) || (n > 120 && dt.day == 1);
          if (!show) return const SizedBox.shrink();
          return Padding(padding: const EdgeInsets.only(top: 4), child: Text(DateFormat(n > 120 ? 'MMM' : 'MMM d').format(dt), style: Fig.axisText));
        },
      )),
    );
  }

  static FlGridData get _grid => FlGridData(drawVerticalLine: false, getDrawingHorizontalLine: (_) => const FlLine(color: Fig.grid, strokeWidth: 1));
  static FlBorderData get _border => FlBorderData(show: true, border: const Border(left: BorderSide(color: Fig.axis), bottom: BorderSide(color: Fig.axis)));
  static const _tipText = TextStyle(color: Fig.ink, fontSize: 12, fontWeight: FontWeight.w700);
  static Color _tipColor(dynamic _) => Fig.surface2;

  static LineChartBarData _line(List<FlSpot> spots, Color color, {bool dashed = false, bool fill = false, bool dots = false, double width = 2}) => LineChartBarData(
        spots: spots, color: color, barWidth: width, isCurved: true, curveSmoothness: 0.25, preventCurveOverShooting: true,
        dashArray: dashed ? [5, 4] : null, dotData: FlDotData(show: dots, getDotPainter: (s, p, b, i) => FlDotCirclePainter(radius: 2.5, color: color, strokeWidth: 0)),
        belowBarData: BarAreaData(show: fill, color: color.withValues(alpha: 0.18)),
      );

  static List<FlSpot> _spots(List<DayPoint> days, double? Function(DayPoint) f) => [for (var i = 0; i < days.length; i++) if (f(days[i]) != null) FlSpot(i.toDouble(), f(days[i])!)];

  static BarChartRodData _rod(double y, {Color? fill, Color? stroke, double width = 8}) =>
      BarChartRodData(toY: y, color: fill ?? Fig.fill, width: width, borderRadius: const BorderRadius.vertical(top: Radius.circular(2)), borderSide: BorderSide(color: stroke ?? Fig.neon, width: 1));

  Widget _sleepChart(Dashboard d) {
    if (d.days.isEmpty) return const EmptyChart();
    return SizedBox(
      height: 200,
      child: LineChart(LineChartData(
        minY: 0, maxY: 12, gridData: _grid, borderData: _border,
        titlesData: _dateTitles(d.days.map((x) => x.date).toList(), left: (v) => '${v.toInt()}h'),
        lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(getTooltipColor: _tipColor, getTooltipItems: (spots) => spots.map((s) => LineTooltipItem('${_fmtDate(d.days[s.x.toInt()].date)}\n${s.y.toStringAsFixed(1)}h', _tipText)).toList())),
        lineBarsData: [_line(_spots(d.days, (x) => x.hoursSlept), Fig.neon, fill: true, dots: d.days.length <= 60), _line(_spots(d.days, (x) => x.sleep7), Fig.white, dashed: true, width: 1.5)],
      )),
    );
  }

  Widget _funChart(Dashboard d) {
    if (d.days.isEmpty) return const EmptyChart();
    return Column(children: [
      SizedBox(
        height: 200,
        child: LineChart(LineChartData(
          minY: 0, maxY: 10, gridData: _grid, borderData: _border,
          titlesData: _dateTitles(d.days.map((x) => x.date).toList()),
          lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(getTooltipColor: _tipColor, getTooltipItems: (spots) => spots.map((s) => LineTooltipItem(s.y.toStringAsFixed(0), _tipText.copyWith(color: s.bar.color))).toList())),
          lineBarsData: [_line(_spots(d.days, (x) => x.fun), Fig.neon, dots: d.days.length <= 60), _line(_spots(d.days, (x) => x.productivity), Fig.white, dots: d.days.length <= 60)],
        )),
      ),
      const Padding(padding: EdgeInsets.only(top: 8), child: FigLegend([('Fun meter', Fig.neon), ('Productivity', Fig.white)])),
    ]);
  }

  Widget _stepsChart(Dashboard d) {
    if (d.days.isEmpty) return const EmptyChart();
    if (d.days.length > 60) return _weekBars(d.weeks.map((w) => w.stepsAvg ?? 0).toList(), d.weeks.map((w) => w.label).toList(), fmt: (v) => NumberFormat.compact().format(v));
    return SizedBox(
      height: 200,
      child: BarChart(BarChartData(
        gridData: _grid, borderData: _border, alignment: BarChartAlignment.spaceBetween,
        titlesData: _dateTitles(d.days.map((x) => x.date).toList(), left: (v) => NumberFormat.compact().format(v)),
        barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(getTooltipColor: _tipColor, getTooltipItem: (g, gi, r, ri) => BarTooltipItem('${_fmtDate(d.days[g.x].date)}\n${NumberFormat.decimalPattern().format(r.toY)}', _tipText))),
        barGroups: [for (var i = 0; i < d.days.length; i++) BarChartGroupData(x: i, barRods: [_rod(d.days[i].steps ?? 0, width: d.days.length > 31 ? 4 : 8)])],
      )),
    );
  }

  Widget _weekBars(List<double> values, List<String> labels, {String Function(double)? fmt}) {
    if (values.isEmpty) return const EmptyChart();
    final step = (labels.length / 6).ceil().clamp(1, 99);
    return SizedBox(
      height: 200,
      child: BarChart(BarChartData(
        gridData: _grid, borderData: _border, alignment: BarChartAlignment.spaceAround,
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, m) => Text(fmt?.call(v) ?? v.toStringAsFixed(0), style: Fig.axisText))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 22, interval: 1, getTitlesWidget: (v, m) {
            final i = v.toInt();
            if (i % step != 0 || i >= labels.length) return const SizedBox.shrink();
            return Padding(padding: const EdgeInsets.only(top: 4), child: Text(labels[i], style: Fig.axisText));
          })),
        ),
        barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(getTooltipColor: _tipColor, getTooltipItem: (g, gi, r, ri) => BarTooltipItem('Week of ${labels[g.x]}\n${fmt?.call(r.toY) ?? r.toY.toStringAsFixed(0)}', _tipText))),
        barGroups: [for (var i = 0; i < values.length; i++) BarChartGroupData(x: i, barRods: [_rod(values[i], width: values.length > 20 ? 6 : 14)])],
      )),
    );
  }

  Widget _golfChart(Dashboard d) {
    final rounds = d.golf;
    return SizedBox(
      height: 200,
      child: LineChart(LineChartData(
        gridData: _grid, borderData: _border,
        extraLinesData: ExtraLinesData(horizontalLines: [HorizontalLine(y: 0, color: Fig.ink2, strokeWidth: 1, dashArray: [3, 3])]),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, m) => Text(v > 0 ? '+${v.toInt()}' : v.toInt().toString(), style: Fig.axisText))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 22, interval: (rounds.length / 5).ceilToDouble().clamp(1, 99), getTitlesWidget: (v, m) {
            final i = v.toInt();
            if (i < 0 || i >= rounds.length) return const SizedBox.shrink();
            return Padding(padding: const EdgeInsets.only(top: 4), child: Text(_fmtDate(rounds[i].date), style: Fig.axisText));
          })),
        ),
        lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(getTooltipColor: _tipColor, getTooltipItems: (spots) => spots.map((s) { final r = rounds[s.x.toInt()]; return LineTooltipItem('${r.course}\n${r.score.toInt()} (${r.toPar >= 0 ? '+' : ''}${r.toPar.toInt()})', _tipText); }).toList())),
        lineBarsData: [_line([for (var i = 0; i < rounds.length; i++) FlSpot(i.toDouble(), rounds[i].toPar)], Fig.neon, dots: true)],
      )),
    );
  }
}
