import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../theme.dart';

const _dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

String _shiftMonth(String ym, int n) {
  final y = int.parse(ym.substring(0, 4)), m = int.parse(ym.substring(5, 7));
  final d = DateTime(y, m + n, 1);
  return '${d.year}-${d.month.toString().padLeft(2, '0')}';
}

/// The home calendar (Dailybean-style): one circle per day, filled with the shirt color worn that day
/// and showing the fun meter inside. Not-logged days are dashed, today has a "+"; tapping a day shows
/// its summary in a sheet with a button into the entry.
class HomeCalendar extends StatelessWidget {
  const HomeCalendar({super.key, required this.cal, required this.streak, required this.onMonth, required this.onOpen});
  final CalendarMonth cal;
  final int streak;
  final ValueChanged<String> onMonth;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final lead = DateTime.parse('${cal.month}-01').weekday % 7;
    final thisMonth = cal.today.substring(0, 7);
    return FigCard(
      title: cal.label,
      sub: streak > 1 ? '$streak-day streak' : null,
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.chevron_left), onPressed: () => onMonth(_shiftMonth(cal.month, -1))),
        IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.chevron_right), onPressed: cal.month.compareTo(thisMonth) < 0 ? () => onMonth(_shiftMonth(cal.month, 1)) : null),
      ]),
      child: Column(children: [
        Row(children: [for (final d in _dow) Expanded(child: Text(d, textAlign: TextAlign.center, style: const TextStyle(color: Fig.ink2, fontSize: 11, fontWeight: FontWeight.w700)))]),
        const SizedBox(height: 6),
        GridView.count(
          crossAxisCount: 7, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 4, crossAxisSpacing: 2, childAspectRatio: 0.78,
          children: [
            for (var i = 0; i < lead; i++) const SizedBox(),
            for (final d in cal.days) _DayCell(d: d, today: cal.today, onTap: () => _tapped(context, d)),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 10, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
          _legend(CustomPaint(size: const Size(12, 12), painter: const DashedCircle(color: Fig.muted)), 'Not logged'),
          _legend(Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Fig.neon, width: 2))), 'Today'),
        ]),
      ]),
    );
  }

  Widget _legend(Widget swatch, String text) => Row(mainAxisSize: MainAxisSize.min, children: [swatch, const SizedBox(width: 4), Text(text, style: Fig.smallMuted)]);

  void _tapped(BuildContext context, CalendarDay d) {
    if (d.future) return;
    if (!d.logged) { onOpen(d.date); return; }
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('SELECTED DAY', style: Fig.tileLabel),
          const SizedBox(height: 4),
          Text(DateFormat('EEEE, MMMM d').format(DateTime.parse(d.date)), style: const TextStyle(color: Fig.ink, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _row('Shirt', Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: hexColor(d.shirtHex))), const SizedBox(width: 6), Text(d.shirtName ?? '—', style: _v)])),
          _row('Sleep', Text(d.hoursSlept == null ? '—' : '${_n(d.hoursSlept!)} h${d.sleepQuality == null ? '' : ' · ${_n(d.sleepQuality!)}/10'}', style: _v)),
          _row('Fun meter', Text(d.fun == null ? '—' : '${_n(d.fun!)} / 10', style: _v)),
          _row('Productivity', Text(d.productivity == null ? '—' : '${_n(d.productivity!)} / 10', style: _v)),
          _row('Steps', Text(d.steps == null ? '—' : NumberFormat.decimalPattern().format(d.steps!.round()), style: _v)),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: () { Navigator.pop(ctx); onOpen(d.date); }, icon: const Icon(Icons.edit_outlined, size: 18), label: const Text('Open entry')),
        ]),
      ),
    );
  }

  static const _v = TextStyle(color: Fig.ink, fontWeight: FontWeight.w700, fontSize: 14);
  static String _n(double v) => v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1);
  Widget _row(String k, Widget v) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(children: [Expanded(child: Text(k, style: Fig.small)), v]));
}

class _DayCell extends StatelessWidget {
  const _DayCell({required this.d, required this.today, required this.onTap});
  final CalendarDay d;
  final String today;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final isToday = d.date == today;
    final label = d.day == 1 ? DateFormat('MMM d').format(DateTime.parse(d.date)) : '${d.day}';
    final Widget dot;
    if (d.logged) {
      final c = hexColor(d.shirtHex);
      dot = Container(width: 34, height: 34, decoration: BoxDecoration(shape: BoxShape.circle, color: c), child: Center(child: Text(d.fun == null ? '·' : '${d.fun!.toInt()}', style: TextStyle(color: Fig.inkOn(c), fontWeight: FontWeight.w800, fontSize: 14))));
    } else if (d.future) {
      dot = const SizedBox(width: 34, height: 34);
    } else if (isToday) {
      dot = Container(width: 34, height: 34, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Fig.neon, width: 2)), child: const Icon(Icons.add, size: 18, color: Fig.neon));
    } else {
      dot = const CustomPaint(size: Size(34, 34), painter: DashedCircle(color: Fig.muted));
    }
    return Opacity(
      opacity: d.future ? 0.4 : 1,
      child: InkWell(
        onTap: d.future ? null : onTap,
        borderRadius: BorderRadius.circular(8),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          dot,
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: isToday ? FontWeight.w700 : FontWeight.w400, color: isToday ? Fig.neon : Fig.ink2), maxLines: 1, overflow: TextOverflow.visible, softWrap: false),
        ]),
      ),
    );
  }
}

/// A dashed ring (not-logged day).
class DashedCircle extends CustomPainter {
  const DashedCircle({required this.color});
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 1.2;
    final r = size.width / 2 - 1, c = Offset(size.width / 2, size.height / 2);
    const n = 14, tau = 6.283185307179586;
    for (var i = 0; i < n; i++) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), i * tau / n, tau / n / 2, false, paint);
    }
  }
  @override
  bool shouldRepaint(covariant DashedCircle old) => old.color != color;
}
