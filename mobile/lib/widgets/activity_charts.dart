import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../models/models.dart';
import '../theme.dart';
import 'bars.dart';

/// The notebook's Activities figures for the phone: tiles, donut (category_pie_chart),
/// running totals per session (cumulative_line_graph), send-rate bars and the packcircles bubbles.

class TileRow extends StatelessWidget {
  const TileRow(this.tiles, {super.key});
  final List<Tile> tiles;
  @override
  Widget build(BuildContext context) => GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.85,
        children: [for (final t in tiles) FigTile(label: t.label, value: t.value, sub: t.sub)],
      );
}

/// Donut with the counts beside it — the notebook's category_pie_chart.
class DonutChart extends StatelessWidget {
  const DonutChart(this.data, {super.key, this.unit = 'holes'});
  final List<Slice> data;
  final String unit;
  @override
  Widget build(BuildContext context) {
    final total = data.fold<double>(0, (a, s) => a + s.value);
    if (total == 0) return const EmptyChart();
    return Row(children: [
      SizedBox(
        width: 150, height: 150,
        child: Stack(alignment: Alignment.center, children: [
          PieChart(PieChartData(
            sectionsSpace: 2, centerSpaceRadius: 44, startDegreeOffset: -90,
            sections: [for (final s in data) PieChartSectionData(value: s.value, color: s.color, radius: 30, showTitle: false)],
          )),
          Column(mainAxisSize: MainAxisSize.min, children: [
            Text(fmtCount(total), style: const TextStyle(color: Fig.ink, fontSize: 22, fontWeight: FontWeight.w800, height: 1)),
            Text(unit, style: Fig.smallMuted),
          ]),
        ]),
      ),
      const SizedBox(width: 16),
      Expanded(
        child: Column(children: [
          for (final s in data)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(children: [
                Container(width: 12, height: 12, decoration: BoxDecoration(color: s.color, borderRadius: BorderRadius.circular(2))),
                const SizedBox(width: 6),
                Expanded(child: Text(s.name, style: const TextStyle(color: Fig.ink, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text(fmtCount(s.value), style: Fig.barLabel),
                SizedBox(width: 36, child: Text('${(s.value / total * 100).round()}%', textAlign: TextAlign.right, style: Fig.small)),
              ]),
            ),
        ]),
      ),
    ]);
  }
}

/// Running totals per series, one point per session — the notebook's cumulative_line_graph.
class CumulativeChart extends StatelessWidget {
  const CumulativeChart(this.data, {super.key});
  final Cumulative data;
  @override
  Widget build(BuildContext context) {
    if (data.rows.length < 2 || data.series.isEmpty) return const SizedBox(height: 100, child: Center(child: Text('No sessions in this range', style: Fig.smallMuted)));
    final last = data.rows.length - 1;
    final maxV = data.series.map((s) => data.rows[last].values[s.key] ?? 0).fold<double>(1, math.max);
    final maxY = _nice(maxV);
    return Column(children: [
      SizedBox(
        height: 210,
        child: LineChart(LineChartData(
          minX: 0, maxX: last.toDouble(), minY: 0, maxY: maxY,
          gridData: FlGridData(drawVerticalLine: false, horizontalInterval: maxY / 4, getDrawingHorizontalLine: (_) => const FlLine(color: Fig.grid, strokeWidth: 1)),
          borderData: FlBorderData(show: true, border: const Border(left: BorderSide(color: Fig.axis), bottom: BorderSide(color: Fig.axis))),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 34, interval: maxY / 4, getTitlesWidget: (v, m) => Text(fmtCount(v), style: Fig.axisText))),
            bottomTitles: AxisTitles(
              axisNameWidget: Text(data.xLabel, style: Fig.axisText), axisNameSize: 16,
              sideTitles: SideTitles(showTitles: true, reservedSize: 20, interval: math.max(1, (last / 6).ceilToDouble()), getTitlesWidget: (v, m) => v % 1 == 0 ? Padding(padding: const EdgeInsets.only(top: 3), child: Text(v.toInt().toString(), style: Fig.axisText)) : const SizedBox.shrink()),
            ),
          ),
          lineTouchData: LineTouchData(touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => Fig.surface2,
            getTooltipItems: (spots) => [
              for (var k = 0; k < spots.length; k++)
                LineTooltipItem(
                  k == 0 ? '${_when(data.rows[spots[k].x.toInt()])}\n' : '',
                  const TextStyle(color: Fig.ink2, fontSize: 11),
                  children: [TextSpan(text: '${data.series[spots[k].barIndex].name} ${fmtCount(spots[k].y)}', style: TextStyle(color: data.series[spots[k].barIndex].color, fontSize: 12, fontWeight: FontWeight.w700))],
                ),
            ],
          )),
          lineBarsData: [
            for (final s in data.series)
              LineChartBarData(
                spots: [for (final r in data.rows) FlSpot(r.i.toDouble(), r.values[s.key] ?? 0)],
                color: s.color, barWidth: 2, isCurved: false, dotData: const FlDotData(show: false),
              ),
          ],
        )),
      ),
      Padding(padding: const EdgeInsets.only(top: 8), child: FigLegend([for (final s in data.series) ('${s.name} ${fmtCount(data.rows[last].values[s.key] ?? 0)}', s.color)])),
    ]);
  }

  String _when(CumRow r) => r.date.isEmpty ? 'Before the first session' : '${data.xLabel} ${r.i} · ${DateFormat('MMM d').format(DateTime.parse(r.date))}';

  /// Round an axis maximum up to a tidy number so the gridlines land on whole counts.
  static double _nice(double max) {
    final mag = math.pow(10, (math.log(max) / math.ln10).floor()).toDouble();
    for (final m in [1, 2, 2.5, 5, 10]) {
      if (max <= m * mag * 1.0001) {
        final step = m * mag / 4;
        return math.max(step, (max / step).ceil() * step);
      }
    }
    return max;
  }
}

/// Completed ÷ attempted per grade, each bar in its grade color.
class SendRateBars extends StatelessWidget {
  const SendRateBars(this.data, {super.key});
  final List<SendRate> data;
  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox(height: 80, child: Center(child: Text('No attempts logged', style: Fig.smallMuted)));
    return Column(children: [
      for (final d in data)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            SizedBox(width: 30, child: Text(d.grade, style: Fig.barLabel)),
            const SizedBox(width: 8),
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: ((d.rate ?? 0) / 100).clamp(0.02, 1),
                  child: Container(height: 15, decoration: BoxDecoration(color: d.color, borderRadius: BorderRadius.circular(3), border: Border.all(color: Fig.neon.withValues(alpha: 0.7), width: 1))),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(width: 86, child: Text('${d.completed}/${d.attempted}${d.rate != null ? ' · ${d.rate!.round()}%' : ''}', style: Fig.barLabel, maxLines: 1)),
          ]),
        ),
    ]);
  }
}

/// Circle packing of hours by sport — the notebook's packcircles figure.
class BubblePack extends StatelessWidget {
  const BubblePack(this.data, {super.key, this.unit = 'hours', this.height = 240});
  final List<Count> data;
  final String unit;
  final double height;
  @override
  Widget build(BuildContext context) {
    final circles = _pack(data);
    if (circles.isEmpty) return const EmptyChart();
    return Column(children: [
      SizedBox(height: height, width: double.infinity, child: CustomPaint(painter: _BubblePainter(circles, unit))),
      const SizedBox(height: 8),
      Wrap(spacing: 12, runSpacing: 3, children: [
        for (var i = 0; i < circles.length; i++)
          Text.rich(TextSpan(children: [TextSpan(text: '${i + 1}. ', style: Fig.barLabel), TextSpan(text: '${circles[i].name} ${fmtCount(circles[i].value)} $unit', style: Fig.small)])),
      ]),
    ]);
  }

  /// Greedy packing: biggest circle at the origin, each next one walks a spiral until it touches nothing.
  static List<_Circle> _pack(List<Count> items) {
    final sorted = items.where((c) => c.value > 0).toList()..sort((a, b) => b.value.compareTo(a.value));
    final out = <_Circle>[];
    for (final it in sorted) {
      final r = math.sqrt(it.value / math.pi);
      if (out.isEmpty) { out.add(_Circle(it.name, it.value, r, 0, 0)); continue; }
      for (var t = 0; t < 4000; t++) {
        final a = t * 0.17, d = 0.06 * t;
        final x = d * math.cos(a), y = d * math.sin(a);
        if (out.every((o) => math.sqrt((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y)) >= o.r + r + 0.02 * r)) { out.add(_Circle(it.name, it.value, r, x, y)); break; }
      }
    }
    return out;
  }
}

class _Circle {
  _Circle(this.name, this.value, this.r, this.x, this.y);
  final String name;
  final double value, r, x, y;
}

class _BubblePainter extends CustomPainter {
  _BubblePainter(this.circles, this.unit);
  final List<_Circle> circles;
  final String unit;
  @override
  void paint(Canvas canvas, Size size) {
    final minX = circles.map((c) => c.x - c.r).reduce(math.min), maxX = circles.map((c) => c.x + c.r).reduce(math.max);
    final minY = circles.map((c) => c.y - c.r).reduce(math.min), maxY = circles.map((c) => c.y + c.r).reduce(math.max);
    final scale = math.min(size.width / (maxX - minX), size.height / (maxY - minY)) * 0.96;
    final ox = size.width / 2 - (minX + maxX) / 2 * scale, oy = size.height / 2 - (minY + maxY) / 2 * scale;
    final big = circles.first.r * scale;
    final n = circles.length;
    for (var i = 0; i < n; i++) {
      final c = circles[i];
      final center = Offset(ox + c.x * scale, oy + c.y * scale), r = c.r * scale;
      final fill = Color.lerp(const Color(0xFF0C4624), const Color(0xFF006E6E), n > 1 ? i / (n - 1) : 0)!;
      canvas.drawCircle(center, r, Paint()..color = fill);
      canvas.drawCircle(center, r, Paint()..color = Fig.neon..style = PaintingStyle.stroke..strokeWidth = math.max(1, big * 0.025));
      if (r > big * 0.28) {
        final fs = math.max(8.0, math.min(r * 0.34, big * 0.22));
        final tp = TextPainter(
          textAlign: TextAlign.center, textDirection: TextDirection.ltr, maxLines: 2, ellipsis: '…',
          text: TextSpan(children: [
            TextSpan(text: '${c.name}\n', style: TextStyle(color: Colors.white, fontSize: fs, fontWeight: FontWeight.w800, height: 1.15)),
            TextSpan(text: '${fmtCount(c.value)} $unit', style: TextStyle(color: Colors.white, fontSize: fs * 0.85, height: 1.15)),
          ]),
        )..layout(maxWidth: r * 1.8);
        tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
      }
    }
  }

  @override
  bool shouldRepaint(_BubblePainter old) => old.circles != circles;
}

/// Score per round, in order played — the notebook's "18-Hole Golf Scores" figure (green line, white dots).
class ScoreLine extends StatelessWidget {
  const ScoreLine(this.data, {super.key});
  final List<GolfScore> data;
  @override
  Widget build(BuildContext context) {
    if (data.length < 2) return SizedBox(height: 80, child: Center(child: Text(data.isEmpty ? 'No 18-hole rounds in range' : 'Only one 18-hole round so far', style: Fig.smallMuted)));
    final scores = data.map((d) => d.score).toList();
    final lo = ((scores.reduce(math.min) - 5) / 10).floor() * 10.0, hi = ((scores.reduce(math.max) + 5) / 10).ceil() * 10.0;
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
