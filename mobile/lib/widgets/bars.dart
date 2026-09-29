import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme.dart';

/// Bar widgets drawn like the Diary_Graphs figures (shared by the dashboard, closet and friends screens).

class EmptyChart extends StatelessWidget {
  const EmptyChart({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox(height: 120, child: Center(child: Text('No data in this range', style: Fig.smallMuted)));
}

String fmtCount(double v) => v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1);

/// Horizontal ranked bars, brightest at the top (the brands figure's ramp), each with a lime outline.
/// `colorByName` paints each bar with the named color it represents (shirt colors, shades of green).
class RankBars extends StatelessWidget {
  const RankBars(this.data, {super.key, this.colorByName = false, this.labelWidth = 96});
  final List<Count> data;
  final bool colorByName;
  final double labelWidth;
  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const EmptyChart();
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
                  child: Container(height: 15, decoration: BoxDecoration(color: colorByName ? (Fig.colorFor(data[i].name) ?? Fig.ramp(i, data.length)) : Fig.ramp(i, data.length), borderRadius: BorderRadius.circular(3), border: Border.all(color: Fig.neon.withValues(alpha: 0.7), width: 1))),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(width: 34, child: Text(fmtCount(data[i].value), style: Fig.barLabel)),
          ]),
        ),
    ]);
  }
}

/// Vertical ranked bars with angled labels and values on top — the "most-worn brands" / "shades of green" figures.
/// `asPercentOf` labels each bar as a share of that total (the figures' "— Percent" variant).
class VerticalBars extends StatelessWidget {
  const VerticalBars(this.data, {super.key, this.colorByName = false, this.asPercentOf});
  final List<Count> data;
  final bool colorByName;
  final double? asPercentOf;
  static const height = 150.0;
  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const EmptyChart();
    final max = data.map((d) => d.value).reduce((a, b) => a > b ? a : b);
    String label(double v) => asPercentOf != null && asPercentOf! > 0 ? '${(v / asPercentOf! * 100).toStringAsFixed(v / asPercentOf! * 100 >= 10 ? 0 : 1)}%' : fmtCount(v);
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
                        decoration: BoxDecoration(color: colorByName ? (Fig.colorFor(data[i].name) ?? Fig.ramp(i, data.length)) : Fig.ramp(i, data.length), borderRadius: const BorderRadius.vertical(top: Radius.circular(3)), border: Border.all(color: Fig.neon.withValues(alpha: 0.7), width: 1)),
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
