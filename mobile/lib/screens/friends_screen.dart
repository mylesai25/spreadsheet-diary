import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/bars.dart';

const _ranges = [('7d', '7 days'), ('30d', '30 days'), ('90d', '90 days'), ('ytd', 'This year'), ('all', 'All')];
const _slotIcon = {'Hat': '🧢', 'Shirt': '👕', 'Pants': '👖', 'Socks': '🧦', 'Shoes': '👟', 'Jacket': '🧥'};
const _top = 10;

/// Friends tab: a leaderboard of everyone seen in person, then one friend's full profile.
class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});
  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  String _range = 'ytd';
  late Future<FriendsData> _future;
  String? _who;
  bool _showAll = false;
  final _scroll = ScrollController();
  final _profileKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<FriendsData> _load() => ApiScope.api(context).friends(_range);
  void _setRange(String r) => setState(() { _range = r; _future = _load(); });

  void _select(String name) {
    setState(() => _who = name);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _profileKey.currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), alignment: 0.02);
    });
  }

  Widget _chips() => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (final r in _ranges) Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(label: Text(r.$2), selected: _range == r.$1, showCheckmark: false, onSelected: (_) => _setRange(r.$1))),
        ]),
      );

  static String _fmt(String iso) => DateFormat('MMM d').format(DateTime.parse(iso));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Friends'), actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: () => setState(() => _future = _load()))]),
      body: RefreshIndicator(
        onRefresh: () async { setState(() => _future = _load()); await _future; },
        child: FutureBuilder<FriendsData>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return ListView(children: [Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 0), child: _chips()), const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))]);
            if (snap.hasError) return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}'))]);
            final d = snap.data!;
            final selected = d.friends.where((f) => f.name == _who).firstOrNull ?? d.friends.firstOrNull;
            final rows = _showAll ? d.friends : d.friends.take(_top).toList();
            return ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              children: [
                _chips(),
                Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('${_fmt(d.start)} – ${_fmt(d.end)} · ${d.daysLogged} days · ${d.friends.length} people', style: Fig.small)),
                if (d.friends.isEmpty) const FigCard(title: 'Nobody here yet', sub: 'Log people under “People seen in person”', child: SizedBox(height: 8)),
                if (d.friends.isNotEmpty) ...[
                  FigCard(
                    title: 'Leaderboard',
                    sub: 'Most days together first · tap a row for the profile',
                    child: Column(children: [
                      const Row(children: [
                        SizedBox(width: 26, child: Text('#', style: Fig.tileLabel)),
                        Expanded(child: Text('FRIEND', style: Fig.tileLabel)),
                        SizedBox(width: 44, child: Text('DAYS', style: Fig.tileLabel, textAlign: TextAlign.right)),
                        SizedBox(width: 40, child: Text('FUN', style: Fig.tileLabel, textAlign: TextAlign.right)),
                        SizedBox(width: 44, child: Text('LIFT', style: Fig.tileLabel, textAlign: TextAlign.right)),
                        SizedBox(width: 62, child: Text('SEEN', style: Fig.tileLabel, textAlign: TextAlign.right)),
                      ]),
                      const Divider(height: 10, thickness: 1, color: Fig.frame),
                      for (var i = 0; i < rows.length; i++) _LeaderRow(f: rows[i], rank: i + 1, selected: rows[i].name == selected?.name, onTap: () => _select(rows[i].name)),
                      if (d.friends.length > _top)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton(onPressed: () => setState(() => _showAll = !_showAll), child: Text(_showAll ? 'Show fewer' : 'Show ${d.friends.length - _top} more…')),
                        ),
                    ]),
                  ),
                  if (selected != null) ...[
                    Padding(
                      key: _profileKey,
                      padding: const EdgeInsets.fromLTRB(2, 6, 2, 10),
                      child: Row(children: [
                        Expanded(child: FigHeading(selected.name)),
                        DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: selected.name,
                            dropdownColor: Fig.surface,
                            borderRadius: BorderRadius.circular(Fig.radius),
                            style: const TextStyle(color: Fig.ink, fontSize: 14),
                            items: [for (final f in d.friends) DropdownMenuItem(value: f.name, child: Text(f.name))],
                            onChanged: (v) { if (v != null) _select(v); },
                          ),
                        ),
                      ]),
                    ),
                    _Profile(f: selected, year: d.year),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _LeaderRow extends StatelessWidget {
  const _LeaderRow({required this.f, required this.rank, required this.selected, required this.onTap});
  final FriendProfile f;
  final int rank;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final lift = f.funLift;
    final liftColor = lift == null || lift == 0 ? Fig.muted : lift > 0 ? Fig.neon : Fig.red;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
        decoration: BoxDecoration(color: selected ? Fig.accentSoft.withValues(alpha: 0.6) : null, borderRadius: BorderRadius.circular(4)),
        child: Row(children: [
          SizedBox(width: 26, child: Text('$rank', style: Fig.smallMuted)),
          Expanded(child: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Fig.neon, fontWeight: FontWeight.w700, fontSize: 14))),
          SizedBox(width: 44, child: Text('${f.days}', textAlign: TextAlign.right, style: const TextStyle(color: Fig.ink, fontWeight: FontWeight.w700, fontSize: 14))),
          SizedBox(width: 40, child: Text(f.avgFun?.toStringAsFixed(1) ?? '—', textAlign: TextAlign.right, style: Fig.small)),
          SizedBox(width: 44, child: Text(lift == null ? '—' : '${lift > 0 ? '+' : ''}${lift.toStringAsFixed(1)}', textAlign: TextAlign.right, style: TextStyle(color: liftColor, fontSize: 12, fontWeight: FontWeight.w700))),
          SizedBox(width: 62, child: Text(f.daysSince == 0 ? 'today' : '${f.daysSince}d ago', textAlign: TextAlign.right, style: Fig.smallMuted)),
        ]),
      ),
    );
  }
}

class _Profile extends StatelessWidget {
  const _Profile({required this.f, required this.year});
  final FriendProfile f;
  final String year;

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Row(children: [SizedBox(width: 120, child: Text(k, style: Fig.small)), Expanded(child: Text(v, style: const TextStyle(color: Fig.ink, fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis))]),
      );

  @override
  Widget build(BuildContext context) {
    String n(double? v, {int d = 0}) => v == null ? '—' : NumberFormat.decimalPattern().format(d == 0 ? v.round() : v);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.5,
        children: [for (final t in f.tiles) FigTile(label: t.label, value: t.value, sub: t.sub, subLines: 2)],
      ),
      const SizedBox(height: 12),
      FigCard(title: 'Days together by month', sub: 'Longest streak ${f.longestStreak} day${f.longestStreak == 1 ? '' : 's'} in a row', child: VerticalBars(f.byMonth)),
      FigCard(title: 'Day of the week', sub: f.topDay == null ? 'Days together' : 'Mostly ${f.topDay}s', child: RankBars(f.weekdays, labelWidth: 40)),
      FigCard(title: '$year together', sub: 'Days in the same place this year', child: _YearDots(seen: f.seenDates, year: year)),
      FigCard(title: 'Sports we play', sub: 'Days with a sport logged', child: RankBars(f.sports)),
      FigCard(title: 'Sky', sub: 'Weather on days together', child: RankBars(f.skies)),
      FigCard(title: 'Where we were', sub: 'Cities visited that day', child: RankBars(f.cities)),
      FigCard(title: 'Also there', sub: 'People seen the same days', child: RankBars(f.companions)),
      FigCard(title: 'Restaurants together', sub: 'From the Restaurant sheet · ${f.mealsOut} meal${f.mealsOut == 1 ? '' : 's'}${f.foodRating == null ? '' : ' · food ${f.foodRating}/10'}', child: RankBars(f.restaurants, labelWidth: 120)),
      if (f.restaurantTypes.isNotEmpty) FigCard(title: 'Cuisines together', sub: 'Restaurant type', child: RankBars(f.restaurantTypes)),
      if (f.videoGames.isNotEmpty) FigCard(title: 'Video games', sub: 'Played on days together', child: RankBars(f.videoGames, labelWidth: 120)),
      FigCard(
        title: 'What I wear around ${f.name}',
        sub: 'Most common piece per slot',
        child: f.fit.isEmpty ? const EmptyChart() : Column(children: [
          for (final p in f.fit)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(children: [
                Text('${_slotIcon[p.slot] ?? ''} ', style: const TextStyle(fontSize: 14)),
                Expanded(child: RichText(text: TextSpan(style: const TextStyle(color: Fig.ink, fontSize: 13), children: [TextSpan(text: '${p.color} ', style: const TextStyle(color: Fig.neon, fontWeight: FontWeight.w700)), TextSpan(text: p.type)]), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('${p.days}d', style: Fig.smallMuted),
              ]),
            ),
        ]),
      ),
      FigCard(
        title: 'Day in numbers',
        sub: 'Averages on days together',
        child: Column(children: [
          _kv('Productivity', f.avgProductivity == null ? '—' : '${f.avgProductivity} / 10'),
          _kv('Steps', n(f.avgSteps)),
          _kv('Calories', n(f.avgCalories)),
          _kv('Went outside', '${f.outsidePct.round()}%'),
          _kv('Gym', '${f.gymPct.round()}%'),
          _kv('Naps', '${f.avgNaps ?? 0} / day'),
          _kv('Meat · fruit · veg', [f.meat, f.fruit, f.veg].map((x) => x ?? '—').join(' · ')),
          _kv('Mini golf', f.miniRounds == 0 ? '—' : '${f.miniRounds} rounds · ${f.miniWins} wins'),
          _kv('Disc golf', f.discRounds == 0 ? '—' : '${f.discRounds} rounds · ${f.discWins} wins'),
          _kv('Climbing', f.climbs == 0 ? '—' : '${f.climbs} sessions'),
        ]),
      ),
      if (f.golf.rounds > 0) ..._golf(f),
      FigCard(title: 'By year', sub: 'Days together, all journals', child: RankBars(f.byYear, labelWidth: 48)),
    ]);
  }

  static String _hrs(int m) => '${(m / 60).toStringAsFixed(1)} h';

  /// The notebook's "Friendship Golf" block.
  List<Widget> _golf(FriendProfile f) {
    final g = f.golf;
    final sc = g.scramble;
    String d(double? v) => v == null ? '—' : (v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1));
    return [
      FigHeading('Golf with ${f.name}'),
      GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.5,
        children: [
          FigTile(label: 'Rounds together', value: '${g.rounds}', sub: '${g.wins} win${g.wins == 1 ? '' : 's'} · ${_hrs(g.minutes)} on the course', subLines: 2),
          FigTile(label: '18-hole score', value: d(g.score18), sub: g.best18 != null ? 'best ${d(g.best18)}${g.score9 != null ? ' · 9-hole avg ${d(g.score9)}' : ''}' : g.score9 != null ? '9-hole avg ${d(g.score9)}' : 'solo formats only', subLines: 2),
          FigTile(label: 'Putts', value: d(g.putts18 ?? g.putts9), sub: g.putts18 != null ? 'per 18 holes${g.putts9 != null ? ' · ${d(g.putts9)} per 9' : ''}' : 'per 9 holes', subLines: 2),
          FigTile(label: 'GIR · FIR', value: g.gir == null && g.fir == null ? '—' : '${g.gir?.round() ?? '—'}% · ${g.fir?.round() ?? '—'}%', sub: 'greens · fairways in regulation', subLines: 2),
          FigTile(label: 'Hazards', value: '${g.water} · ${g.bunkers}', sub: 'water balls · bunker shots', subLines: 2),
          FigTile(label: 'Usual setup', value: g.teeBox ?? '—', sub: '${g.teeBox != null ? 'tees' : ''}${g.cart != null ? ' · cart ${g.cart!.toLowerCase()}' : ''}${g.topCourse != null ? ' · ${g.topCourse}' : ''}', subLines: 2),
        ],
      ),
      const SizedBox(height: 12),
      FigCard(title: 'My 18-hole scores with ${f.name}', sub: 'Solo formats, in order played', child: _ScoreLine(g.scores)),
      FigCard(title: 'Courses', sub: 'Rounds per course', child: RankBars(g.courses, labelWidth: 130)),
      FigCard(title: 'Formats', sub: 'Games played', child: RankBars(g.games)),
      if (sc != null)
        FigCard(
          title: 'Scramble with ${f.name}',
          sub: '${sc['rounds']} round${sc['rounds'] == 1 ? '' : 's'} · ${_hrs((sc['minutes'] as num? ?? 0).toInt())}',
          child: Column(children: [
            _kv('Best 9', '${sc['best9'] ?? '—'}'),
            _kv('Eagles', '${sc['eagles']}'), _kv('Birdies', '${sc['birdies']}'), _kv('Pars', '${sc['pars']}'),
            _kv('Bogeys', '${sc['bogeys']}'), _kv('Doubles', '${sc['doubles']}'), _kv('Triple+', '${sc['triples']}'),
          ]),
        ),
    ];
  }
}

/// Score per round, in order played — the notebook's "18-Hole Golf Scores" figure (green line, white dots).
class _ScoreLine extends StatelessWidget {
  const _ScoreLine(this.data);
  final List<GolfScore> data;
  @override
  Widget build(BuildContext context) {
    if (data.length < 2) return SizedBox(height: 80, child: Center(child: Text(data.isEmpty ? 'No 18-hole rounds together' : 'Only one 18-hole round so far', style: Fig.smallMuted)));
    final scores = data.map((d) => d.score).toList();
    final lo = ((scores.reduce((a, b) => a < b ? a : b) - 5) / 10).floor() * 10.0, hi = ((scores.reduce((a, b) => a > b ? a : b) + 5) / 10).ceil() * 10.0;
    return SizedBox(
      height: 200,
      child: LineChart(LineChartData(
        minY: lo, maxY: hi, minX: 1, maxX: data.length.toDouble(),
        gridData: FlGridData(drawVerticalLine: false, getDrawingHorizontalLine: (_) => const FlLine(color: Fig.grid, strokeWidth: 1)),
        borderData: FlBorderData(show: true, border: const Border(left: BorderSide(color: Fig.axis), bottom: BorderSide(color: Fig.axis))),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 34, interval: 10, getTitlesWidget: (v, m) => Text(v.toInt().toString(), style: Fig.axisText))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 22, interval: data.length > 12 ? 2 : 1, getTitlesWidget: (v, m) => v % 1 == 0 ? Padding(padding: const EdgeInsets.only(top: 4), child: Text(v.toInt().toString(), style: Fig.axisText)) : const SizedBox.shrink())),
        ),
        lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(getTooltipColor: (_) => Fig.surface2, getTooltipItems: (spots) => spots.map((s) { final r = data[s.x.toInt() - 1]; return LineTooltipItem('${r.course}\n${r.score.toInt()} (${r.toPar >= 0 ? '+' : ''}${r.toPar.toInt()})', const TextStyle(color: Fig.ink, fontSize: 12, fontWeight: FontWeight.w700)); }).toList())),
        lineBarsData: [LineChartBarData(
          spots: [for (var i = 0; i < data.length; i++) FlSpot(i + 1.0, data[i].score)],
          color: Fig.neon, barWidth: 2.5, isCurved: false,
          dotData: FlDotData(show: true, getDotPainter: (s, p, b, i) => FlDotCirclePainter(radius: 3.5, color: Fig.white, strokeWidth: 0)),
        )],
      )),
    );
  }
}

/// Twelve mini month grids: a filled square for each day seen, like the calendar figures.
class _YearDots extends StatelessWidget {
  const _YearDots({required this.seen, required this.year});
  final Set<String> seen;
  final String year;
  @override
  Widget build(BuildContext context) {
    final y = int.parse(year);
    return GridView.count(
      crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.92,
      children: [
        for (var m = 1; m <= 12; m++)
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(DateFormat('MMM').format(DateTime(y, m)), textAlign: TextAlign.center, style: const TextStyle(color: Fig.ink, fontSize: 11, fontWeight: FontWeight.w700)),
            const SizedBox(height: 3),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(color: Fig.surface, borderRadius: BorderRadius.circular(4), border: Border.all(color: Fig.frame)),
                child: GridView.count(
                  crossAxisCount: 7, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 2, crossAxisSpacing: 2, padding: EdgeInsets.zero,
                  children: [
                    for (var i = 0; i < DateTime(y, m, 1).weekday % 7; i++) const SizedBox(),
                    for (var d = 1; d <= DateTime(y, m + 1, 0).day; d++)
                      Container(
                        decoration: BoxDecoration(
                          color: seen.contains('$year-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}') ? Fig.neon : Fig.surface2,
                          borderRadius: BorderRadius.circular(1.5),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ]),
      ],
    );
  }
}
