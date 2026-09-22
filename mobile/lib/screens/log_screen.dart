import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../main.dart';
import '../models/models.dart';
import '../widgets/fields.dart';

/// Daily Overview entry: the same sectioned form as the web app, driven by /api/schema.
class LogScreen extends StatefulWidget {
  const LogScreen({super.key});
  @override
  State<LogScreen> createState() => _LogScreenState();
}

class _LogScreenState extends State<LogScreen> {
  String _date = DateTime.now().toIso8601String().substring(0, 10);
  List<Section>? _sections;
  DailyData? _data;
  Map<String, String> _values = {};
  Map<String, String> _saved = {};
  String? _error;
  bool _loading = true, _saving = false, _weatherBusy = false;
  String? _weatherNote;
  final _scroll = ScrollController();
  final _sectionKeys = <String, GlobalKey>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ApiScope.api(context);
      _sections ??= await api.schema();
      final d = await api.daily(_date);
      final v = Map<String, String>.from(d.values);
      if (!d.isLogged) d.defaults.forEach((k, def) { if ((v[k] ?? '').isEmpty) v[k] = def; });
      setState(() {
        _data = d; _values = v; _saved = Map.of(d.values); _weatherNote = d.weatherNote; _loading = false;
        if (_date != d.date) _date = d.date;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Map<String, String> get _changes => {for (final e in _values.entries) if ((_saved[e.key] ?? '') != e.value) e.key: e.value};

  void _set(String key, String val) => setState(() {
        _values[key] = val;
        if (key == 'Bedtime' || key == 'Wake Up Time') {
          final h = _hoursBetween(_values['Bedtime'] ?? '', _values['Wake Up Time'] ?? '');
          if (h != null) _values['Hours slept'] = h;
        }
        if (key == 'Jacket?') _values['Clothes Layers'] = val == 'TRUE' ? '2' : '1';
        if (key == 'Cardio?' && val == 'FALSE') _values['Cardio Duration (minutes)'] = '0';
        if (key == 'Lifting?' && val == 'FALSE') _values['Lifting Duration (minutes)'] = '0';
        if (key == 'Alcohol?' && val == 'FALSE') _values['# of Drinks'] = '0';
        if (key == 'Naps taken' && val == '0') _values['Nap Duration (hours)'] = '0';
      });

  void _patch(Map<String, String> p) => setState(() => _values.addAll(p));

  static String? _hoursBetween(String bed, String wake) {
    final b = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(bed), w = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(wake);
    if (b == null || w == null) return null;
    var mins = int.parse(w[1]!) * 60 + int.parse(w[2]!) - (int.parse(b[1]!) * 60 + int.parse(b[2]!));
    if (mins <= 0) mins += 1440;
    final h = (mins / 30).round() / 2;
    return h == h.roundToDouble() ? h.toInt().toString() : h.toString();
  }

  Future<void> _save() async {
    final changes = _changes;
    if (changes.isEmpty) return;
    setState(() => _saving = true);
    try {
      final n = await ApiScope.api(context).saveDaily(_date, changes);
      setState(() { _saved.addAll(changes); _saving = false; });
      _toast('Saved $n field${n == 1 ? '' : 's'}');
    } catch (e) {
      setState(() => _saving = false);
      _toast('Save failed: $e', error: true);
    }
  }

  Future<void> _getWeather() async {
    setState(() => _weatherBusy = true);
    try {
      final w = await ApiScope.api(context).weather(
          date: _date, city: _values['Wake Up City'] ?? '', state: _values['Wake Up State'] ?? '', country: _values['Wake Up Country'] ?? '', wakeTime: _values['Wake Up Time'] ?? '');
      setState(() { _values.addAll(w.values); _weatherNote = 'Weather for ${w.place} from Open-Meteo'; });
    } catch (e) {
      setState(() => _weatherNote = e.toString());
    } finally {
      setState(() => _weatherBusy = false);
    }
  }

  void _toast(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? Theme.of(context).colorScheme.error : null));
  }

  Future<bool> _confirmDiscard() async {
    if (_changes.isEmpty) return true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Unsaved changes'),
        content: Text('${_changes.length} field(s) not saved yet.'),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Stay')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Discard'))],
      ),
    );
    return ok ?? false;
  }

  Future<void> _goTo(String date) async {
    if (!await _confirmDiscard()) return;
    setState(() => _date = date);
    _load();
  }

  String _shift(String iso, int days) => DateTime.parse(iso).add(Duration(days: days)).toIso8601String().substring(0, 10);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final today = _data?.today ?? DateTime.now().toIso8601String().substring(0, 10);
    final dirty = _changes.length;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 8,
        title: Row(
          children: [
            IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => _goTo(_shift(_date, -1))),
            Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () async {
                  final picked = await showDatePicker(context: context, initialDate: DateTime.parse(_date), firstDate: DateTime(2024), lastDate: DateTime.parse(today));
                  if (picked != null) _goTo(picked.toIso8601String().substring(0, 10));
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_date == today ? 'Today' : DateFormat('EEEE, MMM d').format(DateTime.parse(_date)), style: Theme.of(context).textTheme.titleMedium),
                    Text(_data == null ? _date : (_data!.isLogged ? '● Logged' : '○ Not logged — prefilled'), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: _data?.isLogged == true ? cs.primary : cs.onSurfaceVariant)),
                  ],
                ),
              ),
            ),
            IconButton(icon: const Icon(Icons.chevron_right), onPressed: _date.compareTo(today) < 0 ? () => _goTo(_shift(_date, 1)) : null),
            if (_date != today) TextButton(onPressed: () => _goTo(today), child: const Text('Today')),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(error: _error!, onRetry: _load)
              : Column(
                  children: [
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        children: [
                          for (final s in _sections!)
                            Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ActionChip(
                                label: Text('${s.icon} ${s.title}'),
                                visualDensity: VisualDensity.compact,
                                onPressed: () {
                                  final ctx = _sectionKeys[s.id]?.currentContext;
                                  if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), alignment: 0.02);
                                },
                              ),
                            ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                        children: [for (final s in _sections!) _buildSection(s)],
                      ),
                    ),
                  ],
                ),
      bottomNavigationBar: _data == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    Expanded(child: Text(dirty > 0 ? '$dirty unsaved change${dirty == 1 ? '' : 's'}' : 'All saved${_data!.storeKind == 'csv' ? ' · local CSV mode' : ''}', style: TextStyle(color: cs.onSurfaceVariant))),
                    if (dirty > 0) TextButton(onPressed: () => setState(() => _values = Map.of(_saved)), child: const Text('Discard')),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: dirty > 0 && !_saving ? _save : null,
                      icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check),
                      label: Text(_saving ? 'Saving…' : 'Save'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  bool _visible(Field f) => f.showIf == null || (_values[f.showIf!.key] ?? '') == f.showIf!.equals;

  Widget _buildSection(Section s) {
    final key = _sectionKeys.putIfAbsent(s.id, GlobalKey.new);
    final cs = Theme.of(context).colorScheme;
    return Padding(
      key: key,
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        color: cs.surfaceContainerLow,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text('${s.icon} ${s.title}', style: Theme.of(context).textTheme.titleMedium)),
                  if (s.id == 'day')
                    TextButton.icon(
                      onPressed: _weatherBusy ? null : _getWeather,
                      icon: const Icon(Icons.cloud_download_outlined, size: 18),
                      label: Text(_weatherBusy ? 'Fetching…' : 'Weather'),
                      style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                    ),
                  if (_data?.prevDate != null)
                    TextButton(
                      onPressed: () => _patch({for (final f in s.fields) f.key: _data!.prev[f.key] ?? ''}),
                      style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                      child: Text('Copy ${_data!.prevDate!.substring(5).replaceAll('-', '/')}'),
                    ),
                ],
              ),
              if (s.id == 'day' && _weatherNote != null)
                Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(_weatherNote!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant))),
              for (final item in s.items)
                if (item.group != null)
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(border: Border.all(color: cs.outlineVariant), borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(item.group!.title, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
                        for (final f in item.group!.fields) if (_visible(f)) _field(f),
                      ],
                    ),
                  )
                else if (_visible(item.field!))
                  _field(item.field!),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(Field f) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: FieldWidget(
          field: f,
          value: _values[f.key] ?? '',
          options: _data!.options[f.key] ?? const [],
          closet: f.closet == null ? const [] : (_data!.closet[f.closet!] ?? const []),
          changed: (_saved[f.key] ?? '') != (_values[f.key] ?? ''),
          onChanged: (v) => _set(f.key, v),
          onPatch: _patch,
        ),
      );
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off, size: 40, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 12),
              Text("Couldn't reach the diary server", style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(error, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 12),
              FilledButton.tonal(onPressed: onRetry, child: const Text('Retry')),
              const SizedBox(height: 4),
              const Text('Check the server URL in Settings.', style: TextStyle(fontSize: 12)),
            ],
          ),
        ),
      );
}
