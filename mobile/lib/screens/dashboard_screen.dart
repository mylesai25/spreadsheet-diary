import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../main.dart';
import '../models/models.dart';

const _ranges = [('7d', '7 days'), ('30d', '30 days'), ('90d', '90 days'), ('ytd', 'This year'), ('all', 'All')];

/// Key metrics from /api/dashboard: tiles + a handful of fl_chart charts.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _range = '30d';
  late Future<Dashboard> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Dashboard> _load() => ApiScope.api(context).dashboard(_range);

  void _setRange(String r) => setState(() { _range = r; _future = _load(); });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard'), actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: () => setState(() => _future = _load()))]),
      body: RefreshIndicator(
        onRefresh: () async { setState(() => _future = _load()); await _future; },
        child: FutureBuilder<Dashboard>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
            if (snap.hasError) return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}'))]);
            final d = snap.data!;
            final cs = Theme.of(context).colorScheme;
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    for (final r in _ranges) Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(label: Text(r.$2), selected: _range == r.$1, onSelected: (_) => _setRange(r.$1))),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text('${_fmtDate(d.start)} – ${_fmtDate(d.end)} · ${d.daysLogged} days logged${d.missingDays > 0 ? ' · ${d.missingDays} missing' : ''}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                ),
                GridView.count(
                  crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.9,
                  children: [for (final t in d.tiles) _TileCard(t)],
                ),
                const SizedBox(height: 12),
                _ChartCard(title: 'Sleep', sub: 'Hours slept with 7-day average', child: _sleepChart(d, cs)),
                _ChartCard(title: 'Fun & productivity', sub: 'Daily self-ratings, 1–10', child: _funChart(d, cs)),
                _ChartCard(title: 'Steps', sub: d.days.length > 60 ? 'Average per day, by week' : 'Per day', child: _stepsChart(d, cs)),
                _ChartCard(title: 'Gym days per week', child: _weekBars(d.weeks.map((w) => w.gymDays).toList(), d.weeks.map((w) => w.label).toList(), cs)),
                _ChartCard(title: 'Drinks per week', child: _weekBars(d.weeks.map((w) => w.drinks).toList(), d.weeks.map((w) => w.label).toList(), cs)),
                if (d.golf.isNotEmpty) _ChartCard(title: 'Golf', sub: 'Score to par per round', child: _golfChart(d, cs)),
                _ChartCard(title: 'Shirt colors', sub: 'Days worn', child: _RankBars(d.shirtColors, colorByName: true)),
                _ChartCard(title: 'People seen most', sub: 'Days together', child: _RankBars(d.people)),
                _ChartCard(title: 'Woke up in', sub: 'Days per city', child: _RankBars(d.wakeCities)),
                _ChartCard(title: 'Cuisines', sub: 'Restaurant visits', child: _RankBars(d.cuisines)),
                _ChartCard(title: 'Sky', sub: 'Days', child: _RankBars(d.sky)),
              ],
            );
          },
        ),
      ),
    );
  }

  static String _fmtDate(String iso) => DateFormat('MMM d').format(DateTime.parse(iso));

  // ── charts ──

  static FlTitlesData _dateTitles(List<String> dates, ColorScheme cs, {String Function(double)? left}) {
    final n = dates.length;
    final every = n <= 10 ? 1 : n <= 35 ? 7 : n <= 120 ? 15 : 30;
    return FlTitlesData(
      topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
      leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, m) => Text(left?.call(v) ?? v.toStringAsFixed(0), style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)))),
      bottomTitles: AxisTitles(sideTitles: SideTitles(
        showTitles: true, reservedSize: 22, interval: 1,
        getTitlesWidget: (v, m) {
          final i = v.toInt();
          if (i < 0 || i >= n) return const SizedBox.shrink();
          final dt = DateTime.parse(dates[i]);
          final show = n <= 10 || (n <= 35 && dt.weekday == DateTime.sunday) || (n > 35 && n <= 120 && (dt.day == 1 || dt.day == 15)) || (n > 120 && dt.day == 1);
          if (!show || (every > 1 && false)) return const SizedBox.shrink();
          return Padding(padding: const EdgeInsets.only(top: 4), child: Text(DateFormat(n > 120 ? 'MMM' : 'MMM d').format(dt), style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)));
        },
      )),
    );
  }

  static FlGridData _grid(ColorScheme cs) => FlGridData(drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: cs.outlineVariant.withValues(alpha: 0.5), strokeWidth: 1));

  static LineChartBarData _line(List<FlSpot> spots, Color color, {bool dashed = false, bool fill = false, bool dots = false}) => LineChartBarData(
        spots: spots, color: color, barWidth: 2, isCurved: true, curveSmoothness: 0.25, preventCurveOverShooting: true,
        dashArray: dashed ? [5, 4] : null, dotData: FlDotData(show: dots, getDotPainter: (s, p, b, i) => FlDotCirclePainter(radius: 2.5, color: color, strokeWidth: 0)),
        belowBarData: BarAreaData(show: fill, color: color.withValues(alpha: 0.12)),
      );

  static List<FlSpot> _spots(List<DayPoint> days, double? Function(DayPoint) f) => [for (var i = 0; i < days.length; i++) if (f(days[i]) != null) FlSpot(i.toDouble(), f(days[i])!)];

  Widget _sleepChart(Dashboard d, ColorScheme cs) {
    if (d.days.isEmpty) return const _Empty();
    return SizedBox(
      height: 200,
      child: LineChart(LineChartData(
        minY: 0, maxY: 12, gridData: _grid(cs), borderData: FlBorderData(show: false),
        titlesData: _dateTitles(d.days.map((x) => x.date).toList(), cs, left: (v) => '${v.toInt()}h'),
        lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(getTooltipItems: (spots) => spots.map((s) => LineTooltipItem('${_fmtDate(d.days[s.x.toInt()].date)}\n${s.y.toStringAsFixed(1)}h', TextStyle(color: cs.onInverseSurface, fontSize: 12))).toList())),
        lineBarsData: [_line(_spots(d.days, (x) => x.hoursSlept), cs.primary, fill: true, dots: d.days.length <= 60), _line(_spots(d.days, (x) => x.sleep7), cs.onSurface, dashed: true)],
      )),
    );
  }

  Widget _funChart(Dashboard d, ColorScheme cs) {
    if (d.days.isEmpty) return const _Empty();
    const blue = Color(0xFF2A78D6);
    return Column(children: [
      SizedBox(
        height: 200,
        child: LineChart(LineChartData(
          minY: 0, maxY: 10, gridData: _grid(cs), borderData: FlBorderData(show: false),
          titlesData: _dateTitles(d.days.map((x) => x.date).toList(), cs),
          lineBarsData: [_line(_spots(d.days, (x) => x.fun), cs.primary, dots: d.days.length <= 60), _line(_spots(d.days, (x) => x.productivity), blue, dots: d.days.length <= 60)],
        )),
      ),
      _Legend(const [('Fun meter', null), ('Productivity', blue)], cs),
    ]);
  }

  Widget _stepsChart(Dashboard d, ColorScheme cs) {
    if (d.days.isEmpty) return const _Empty();
    if (d.days.length > 60) return _weekBars(d.weeks.map((w) => w.stepsAvg ?? 0).toList(), d.weeks.map((w) => w.label).toList(), cs, fmt: (v) => NumberFormat.compact().format(v));
    return SizedBox(
      height: 200,
      child: BarChart(BarChartData(
        gridData: _grid(cs), borderData: FlBorderData(show: false), alignment: BarChartAlignment.spaceBetween,
        titlesData: _dateTitles(d.days.map((x) => x.date).toList(), cs, left: (v) => NumberFormat.compact().format(v)),
        barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(getTooltipItem: (g, gi, r, ri) => BarTooltipItem('${_fmtDate(d.days[g.x].date)}\n${NumberFormat.decimalPattern().format(r.toY)}', TextStyle(color: cs.onInverseSurface, fontSize: 12)))),
        barGroups: [for (var i = 0; i < d.days.length; i++) BarChartGroupData(x: i, barRods: [BarChartRodData(toY: d.days[i].steps ?? 0, color: cs.primary, width: d.days.length > 31 ? 4 : 8, borderRadius: const BorderRadius.vertical(top: Radius.circular(3)))])],
      )),
    );
  }

  Widget _weekBars(List<double> values, List<String> labels, ColorScheme cs, {String Function(double)? fmt}) {
    if (values.isEmpty) return const _Empty();
    final step = (labels.length / 6).ceil().clamp(1, 99);
    return SizedBox(
      height: 200,
      child: BarChart(BarChartData(
        gridData: _grid(cs), borderData: FlBorderData(show: false), alignment: BarChartAlignment.spaceAround,
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, m) => Text(fmt?.call(v) ?? v.toStringAsFixed(0), style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 22, interval: 1, getTitlesWidget: (v, m) {
            final i = v.toInt();
            if (i % step != 0 || i >= labels.length) return const SizedBox.shrink();
            return Padding(padding: const EdgeInsets.only(top: 4), child: Text(labels[i], style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)));
          })),
        ),
        barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(getTooltipItem: (g, gi, r, ri) => BarTooltipItem('Week of ${labels[g.x]}\n${fmt?.call(r.toY) ?? r.toY.toStringAsFixed(0)}', TextStyle(color: cs.onInverseSurface, fontSize: 12)))),
        barGroups: [for (var i = 0; i < values.length; i++) BarChartGroupData(x: i, barRods: [BarChartRodData(toY: values[i], color: cs.primary, width: values.length > 20 ? 6 : 14, borderRadius: const BorderRadius.vertical(top: Radius.circular(4)))])],
      )),
    );
  }

  Widget _golfChart(Dashboard d, ColorScheme cs) {
    final rounds = d.golf;
    return SizedBox(
      height: 200,
      child: LineChart(LineChartData(
        gridData: _grid(cs), borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, m) => Text(v > 0 ? '+${v.toInt()}' : v.toInt().toString(), style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 22, interval: (rounds.length / 5).ceilToDouble().clamp(1, 99), getTitlesWidget: (v, m) {
            final i = v.toInt();
            if (i < 0 || i >= rounds.length) return const SizedBox.shrink();
            return Padding(padding: const EdgeInsets.only(top: 4), child: Text(_fmtDate(rounds[i].date), style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)));
          })),
        ),
        lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(getTooltipItems: (spots) => spots.map((s) { final r = rounds[s.x.toInt()]; return LineTooltipItem('${r.course}\n${r.score.toInt()} (${r.toPar >= 0 ? '+' : ''}${r.toPar.toInt()})', TextStyle(color: cs.onInverseSurface, fontSize: 12)); }).toList())),
        lineBarsData: [_line([for (var i = 0; i < rounds.length; i++) FlSpot(i.toDouble(), rounds[i].toPar)], cs.primary, dots: true)],
      )),
    );
  }
}

class _TileCard extends StatelessWidget {
  const _TileCard(this.t);
  final Tile t;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      color: cs.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(t.label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant)),
            Text(t.value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
            if (t.sub != null) Text(t.sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  const _ChartCard({required this.title, this.sub, required this.child});
  final String title;
  final String? sub;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        color: cs.surfaceContainerLow,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleSmall),
              if (sub != null) Text(sub!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
              const SizedBox(height: 10),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.items, this.cs);
  final List<(String, Color?)> items;
  final ColorScheme cs;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Wrap(spacing: 12, children: [
          for (final i in items)
            Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: i.$2 ?? cs.primary)), const SizedBox(width: 4), Text(i.$1, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))]),
        ]),
      );
}

class _Empty extends StatelessWidget {
  const _Empty();
  @override
  Widget build(BuildContext context) => SizedBox(height: 120, child: Center(child: Text('No data in this range', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant))));
}

const _named = {'Green': Color(0xFF1A7F37), 'Black': Color(0xFF3B3B3B), 'Blue': Color(0xFF2A78D6), 'White': Color(0xFFD9D9D4), 'Gray': Color(0xFF8A8A8A), 'Brown': Color(0xFF8B5A2B), 'Red': Color(0xFFD03B3B), 'Purple': Color(0xFF7A4BD1), 'Yellow': Color(0xFFE0B000), 'Orange': Color(0xFFEB6834)};

/// Horizontal ranked bars drawn with plain widgets (lighter than a chart for short lists).
class _RankBars extends StatelessWidget {
  const _RankBars(this.data, {this.colorByName = false});
  final List<Count> data;
  final bool colorByName;
  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const _Empty();
    final cs = Theme.of(context).colorScheme;
    final max = data.map((d) => d.value).reduce((a, b) => a > b ? a : b);
    return Column(children: [
      for (final d in data)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            SizedBox(width: 96, child: Text(d.name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.right, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))),
            const SizedBox(width: 8),
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: (d.value / max).clamp(0.02, 1),
                  child: Container(height: 14, decoration: BoxDecoration(color: colorByName ? (_named[d.name] ?? cs.primary) : cs.primary, borderRadius: BorderRadius.circular(4))),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(width: 32, child: Text(d.value % 1 == 0 ? d.value.toInt().toString() : d.value.toStringAsFixed(1), style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))),
          ]),
        ),
    ]);
  }
}
