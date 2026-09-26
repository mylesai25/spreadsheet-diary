import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../main.dart';
import '../models/models.dart';
import '../theme.dart';

const _ranges = [('7d', '7 days'), ('30d', '30 days'), ('90d', '90 days'), ('ytd', 'This year'), ('all', 'All')];

/// Key metrics from /api/dashboard: tiles + a handful of fl_chart charts, drawn like the Diary_Graphs figures.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _range = '30d';
  late Future<Dashboard> _future;
  bool _closet = false;
  Future<ClosetStats>? _closetFuture;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Dashboard> _load() => ApiScope.api(context).dashboard(_range);

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
                    const Divider(height: 10, thickness: 1.5, color: Fig.neon),
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
                FigCard(title: 'My Closet by Color — Percent', sub: 'Short color of every piece', child: _VerticalBars(s.colorFamilies, colorByName: true, asPercentOf: s.total.toDouble())),
                FigCard(title: "My Closet's Shades of Green — Percent", sub: 'Primary color of the $green green pieces', child: _VerticalBars(s.greenShades.take(8).toList(), colorByName: true, asPercentOf: green.toDouble())),
                const FigHeading('Wear'),
                FigCard(title: 'Brands in the Closet — Percent', sub: 'Share of all pieces per brand', child: _VerticalBars(s.brands.take(8).toList(), asPercentOf: s.total.toDouble())),
                FigCard(title: 'Green goes with', sub: 'Accent colors on green pieces', child: _RankBars(s.greenAccents, colorByName: true)),
                FigCard(title: 'Most worn in ${s.year}', sub: 'Days worn, top two pieces of each kind', child: _RankBars(s.mostWorn, labelWidth: 150)),
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
        child: FutureBuilder<Dashboard>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
            if (snap.hasError) return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}'))]);
            final d = snap.data!;
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              children: [
                _chips(),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text('${_fmtDate(d.start)} – ${_fmtDate(d.end)} · ${d.daysLogged} days logged${d.missingDays > 0 ? ' · ${d.missingDays} missing' : ''}', style: Fig.small),
                ),
                _tiles(d.tiles),
                const SizedBox(height: 12),
                FigCard(title: 'Sleep', sub: 'Hours slept with 7-day average', child: _sleepChart(d)),
                FigCard(title: 'Fun & productivity', sub: 'Daily self-ratings, 1–10', child: _funChart(d)),
                FigCard(title: 'Steps', sub: d.days.length > 60 ? 'Average per day, by week' : 'Per day', child: _stepsChart(d)),
                FigCard(title: 'Gym days per week', child: _weekBars(d.weeks.map((w) => w.gymDays).toList(), d.weeks.map((w) => w.label).toList())),
                FigCard(title: 'Drinks per week', child: _weekBars(d.weeks.map((w) => w.drinks).toList(), d.weeks.map((w) => w.label).toList())),
                if (d.golf.isNotEmpty) FigCard(title: 'Golf', sub: 'Score to par per round', child: _golfChart(d)),
                FigCard(title: 'Shirt colors', sub: 'Days worn', child: _RankBars(d.shirtColors, colorByName: true)),
                FigCard(title: 'People seen most', sub: 'Days together', child: _RankBars(d.people)),
                FigCard(title: 'Woke up in', sub: 'Days per city', child: _RankBars(d.wakeCities)),
                FigCard(title: 'Cuisines', sub: 'Restaurant visits', child: _RankBars(d.cuisines)),
                FigCard(title: 'Sky', sub: 'Days', child: _RankBars(d.sky)),
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
      BarChartRodData(toY: y, color: fill ?? Fig.fill, width: width, borderRadius: BorderRadius.zero, borderSide: BorderSide(color: stroke ?? Fig.neon, width: 1.2));

  Widget _sleepChart(Dashboard d) {
    if (d.days.isEmpty) return const _Empty();
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
    if (d.days.isEmpty) return const _Empty();
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
    if (d.days.isEmpty) return const _Empty();
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
    if (values.isEmpty) return const _Empty();
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

class _Empty extends StatelessWidget {
  const _Empty();
  @override
  Widget build(BuildContext context) => const SizedBox(height: 120, child: Center(child: Text('No data in this range', style: Fig.smallMuted)));
}

String _fmtCount(double v) => v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1);

/// Horizontal ranked bars, brightest at the top (the brands figure's ramp), each with a lime outline.
/// `colorByName` paints each bar with the named color it represents (shirt colors, shades of green).
class _RankBars extends StatelessWidget {
  const _RankBars(this.data, {this.colorByName = false, this.labelWidth = 96});
  final List<Count> data;
  final bool colorByName;
  final double labelWidth;
  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const _Empty();
    final max = data.map((d) => d.value).reduce((a, b) => a > b ? a : b);
    return Column(children: [
      for (var i = 0; i < data.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            SizedBox(width: labelWidth, child: Text(data[i].name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, color: Fig.ink))),
            const SizedBox(width: 8),
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: (data[i].value / max).clamp(0.03, 1),
                  child: Container(height: 15, decoration: BoxDecoration(color: colorByName ? (Fig.colorFor(data[i].name) ?? Fig.ramp(i, data.length)) : Fig.ramp(i, data.length), border: Border.all(color: Fig.neon, width: 1.2))),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(width: 34, child: Text(_fmtCount(data[i].value), style: Fig.barLabel)),
          ]),
        ),
    ]);
  }
}

/// Vertical ranked bars with angled labels and values on top — the "most-worn brands" / "shades of green" figures.
/// `asPercentOf` labels each bar as a share of that total (the figures' "— Percent" variant).
class _VerticalBars extends StatelessWidget {
  const _VerticalBars(this.data, {this.colorByName = false, this.asPercentOf});
  final List<Count> data;
  final bool colorByName;
  final double? asPercentOf;
  static const height = 150.0;
  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const _Empty();
    final max = data.map((d) => d.value).reduce((a, b) => a > b ? a : b);
    String label(double v) => asPercentOf != null && asPercentOf! > 0 ? '${(v / asPercentOf! * 100).toStringAsFixed(v / asPercentOf! * 100 >= 10 ? 0 : 1)}%' : _fmtCount(v);
    return Column(children: [
      Container(
        height: height,
        decoration: const BoxDecoration(border: Border(left: BorderSide(color: Fig.axis), bottom: BorderSide(color: Fig.axis))),
        padding: const EdgeInsets.only(left: 4, right: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (var i = 0; i < data.length; i++)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(label(data[i].value), style: Fig.barLabel.copyWith(fontSize: 10), maxLines: 1, overflow: TextOverflow.visible, softWrap: false),
                      const SizedBox(height: 2),
                      Container(
                        height: ((data[i].value / max) * (height - 22)).clamp(2.0, height - 22),
                        decoration: BoxDecoration(color: colorByName ? (Fig.colorFor(data[i].name) ?? Fig.ramp(i, data.length)) : Fig.ramp(i, data.length), border: Border.all(color: Fig.neon, width: 1.5)),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      ClipRect(
        child: SizedBox(
        height: 86,
        child: Row(children: [
          for (final d in data)
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: OverflowBox(
                  maxWidth: 110, minWidth: 110, alignment: Alignment.topCenter,
                  child: Transform.translate(
                    offset: const Offset(-8, 8),
                    child: Transform.rotate(
                      angle: -1.05, alignment: Alignment.topRight,
                      child: SizedBox(width: 110, child: Text(d.name, textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Fig.ink, fontSize: 10, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
              ),
            ),
        ]),
      ),
      ),
    ]);
  }
}
