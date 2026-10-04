import 'package:flutter/material.dart';

import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/home_calendar.dart';
import 'log_screen.dart';
import 'settings_screen.dart';

/// Home: the month calendar, one shirt-colored circle per day. Charts live on the Dashboard tab.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  String? _month;   // null = this month
  late Future<CalendarPage> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<CalendarPage> _load() => ApiScope.api(context).calendar(month: _month);
  void _refresh() => setState(() => _future = _load());
  void _setMonth(String m) => setState(() { _month = m; _future = _load(); });

  Future<void> _openDay(String date) async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => LogScreen(initialDate: date)));
    if (mounted) _refresh();   // the day may have been logged
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Diary'),
          actions: [
            IconButton(icon: const Icon(Icons.refresh), onPressed: _refresh),
            IconButton(icon: const Icon(Icons.settings_outlined), tooltip: 'Settings', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()))),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () async { _refresh(); await _future; },
          child: FutureBuilder<CalendarPage>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
              if (snap.hasError) return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}\nCheck the server URL in Settings.'))]);
              final d = snap.data!;
              return ListView(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                children: [
                  HomeCalendar(cal: d.calendar, streak: d.streak, onMonth: _setMonth, onOpen: _openDay),
                  Row(children: [
                    Expanded(child: Text('${d.daysLogged} days logged${d.missingDays > 0 ? ' · ${d.missingDays} missing in the last 30' : ''}', style: Fig.small)),
                    FilledButton.icon(onPressed: () => _openDay(d.calendar.today), icon: const Icon(Icons.edit_outlined, size: 18), label: const Text('Log today')),
                  ]),
                ],
              );
            },
          ),
        ),
      );
}
