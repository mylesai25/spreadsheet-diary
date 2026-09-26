import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/client.dart';
import '../main.dart';
import '../models/models.dart';
import '../reminders.dart';
import '../theme.dart';
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
  Map<String, List<ClosetItem>> _closet = {};
  Map<String, String> _values = {};
  Map<String, String> _saved = {};
  String? _error;
  bool _loading = true, _saving = false, _weatherBusy = false;
  String? _weatherNote;
  OutfitSuggestions? _outfits;
  bool _outfitsBusy = false;
  List<String> _outfitSeen = [];
  int _outfitRound = 0;
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
      // Schema, the day, and the (cached) closet in parallel — one round trip instead of three.
      final results = await Future.wait<Object>([
        _sections == null ? api.schema() : Future.value(_sections!),
        api.daily(_date),
        ClosetCache.get(api),
      ]);
      _sections = results[0] as List<Section>;
      final d = results[1] as DailyData;
      _closet = results[2] as Map<String, List<ClosetItem>>;
      final v = Map<String, String>.from(d.values);
      if (!d.isLogged) d.defaults.forEach((k, def) { if ((v[k] ?? '').isEmpty) v[k] = def; });
      setState(() {
        _data = d; _values = v; _saved = Map.of(d.values); _weatherNote = d.weatherNote; _outfits = d.outfits; _outfitSeen = List.of(d.outfits?.shownKeys ?? const []); _outfitRound = 0; _loading = false;
        if (_date != d.date) _date = d.date;
      });
      Reminders.sync(d.loggedDates);   // drop the reminder for days already logged
      // Instant picks are up; when Claude is configured, ask it for its ideas now.
      final o = d.outfits;
      if (o != null && o.claudeAvailable && o.engine != 'claude' && o.outfits.isNotEmpty) _refreshOutfits(fresh: false);
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
      Reminders.sync({...?_data?.loggedDates, _date});   // this day counts as logged now
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
      _refreshOutfits(fresh: false);
    } catch (e) {
      setState(() => _weatherNote = e.toString());
    } finally {
      setState(() => _weatherBusy = false);
    }
  }

  /// New ideas for the same weather: previously shown pieces are set aside and the ranking reshuffled.
  Future<void> _refreshOutfits({bool fresh = true}) async {
    setState(() => _outfitsBusy = true);
    if (!fresh) { _outfitSeen = []; _outfitRound = 0; } else { _outfitRound += 1; }
    try {
      final o = await ApiScope.api(context).outfits(date: _date, feels: _values['Feels Like (F)'] ?? '', high: _values['High Temperature (F)'] ?? '', sky: _values['Sky'] ?? '', seen: _outfitSeen, seed: _outfitRound);
      setState(() { _outfits = o; _outfitSeen = {..._outfitSeen, ...o.shownKeys}.toList(); if (_outfitSeen.length > 60) _outfitSeen = _outfitSeen.sublist(_outfitSeen.length - 60); });
    } catch (e) {
      _toast('Outfit ideas failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _outfitsBusy = false);
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
                    Text(_data == null ? _date : (_data!.isLogged ? '● Logged' : '○ Not logged — prefilled'), style: TextStyle(fontSize: 11, color: _data?.isLogged == true ? Fig.neon : Fig.ink2, fontWeight: _data?.isLogged == true ? FontWeight.w800 : FontWeight.w400)),
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
                                backgroundColor: Fig.paper,
                                side: const BorderSide(color: Fig.border, width: Fig.frameWidth),
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
          : Container(
              decoration: const BoxDecoration(color: Fig.paper, border: Border(top: BorderSide(color: Fig.neon, width: Fig.frameWidth))),
              child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    Expanded(child: Text(dirty > 0 ? '$dirty unsaved change${dirty == 1 ? '' : 's'}' : 'All saved${_data!.storeKind == 'csv' ? ' · local CSV mode' : ''}', style: Fig.small)),
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
            ),
    );
  }

  bool _visible(Field f) => f.showIf == null || (_values[f.showIf!.key] ?? '') == f.showIf!.equals;

  Widget _buildSection(Section s) {
    final key = _sectionKeys.putIfAbsent(s.id, GlobalKey.new);
    return Padding(
      key: key,
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text('${s.icon} ${s.title}', style: Fig.cardTitle.copyWith(fontSize: 16))),
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
              if (s.id == 'outfit' && _outfits != null) _OutfitIdeas(data: _outfits!, busy: _outfitsBusy, onRefresh: _refreshOutfits, onWear: (patch) { _patch(patch); _toast('Outfit applied — review and save'); }),
              if (s.id == 'day' && _weatherNote != null)
                Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(_weatherNote!, style: Fig.smallMuted)),
              for (final item in s.items)
                if (item.group != null)
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(border: Border.all(color: Fig.border, width: Fig.frameWidth), borderRadius: BorderRadius.circular(Fig.radius)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(item.group!.title, style: const TextStyle(color: Fig.neon, fontSize: 13, fontWeight: FontWeight.w800)),
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
          closet: f.closet == null ? const [] : (_closet[f.closet!] ?? const []),
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

const _slotIcon = {'shirt': '👕', 'pants': '👖', 'shoes': '👟', 'socks': '🧦', 'hat': '🧢', 'jacket': '🧥'};

class _OutfitIdeas extends StatelessWidget {
  const _OutfitIdeas({required this.data, required this.busy, required this.onRefresh, required this.onWear});
  final OutfitSuggestions data;
  final bool busy;
  final VoidCallback onRefresh;
  final ValueChanged<Map<String, String>> onWear;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final desc = data.feelsLike == null ? 'no weather yet' : 'feels like ${data.feelsLike!.round()}°${data.sky.isNotEmpty ? ' · ${data.sky}' : ''}';
    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Fig.surface2.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(Fig.radius), border: Border.all(color: Fig.border, width: Fig.frameWidth)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            const Text('✨ ', style: TextStyle(fontSize: 14)),
            const Text('Outfit ideas', style: TextStyle(color: Fig.ink, fontSize: 14, fontWeight: FontWeight.w800)),
            const SizedBox(width: 8),
            Expanded(child: Text('$desc${data.similarDays > 0 ? ' · ${data.similarDays} similar days' : ''}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant), overflow: TextOverflow.ellipsis)),
            TextButton.icon(icon: busy ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.refresh, size: 16), label: Text(busy && data.claudeAvailable ? 'Asking Claude…' : 'New ideas'), onPressed: busy ? null : onRefresh, style: TextButton.styleFrom(visualDensity: VisualDensity.compact)),
          ]),
          if (data.note != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(data.note!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.tertiary))),
          if (data.habits.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('📅 ${data.weekday} habit: ${data.habits.join(' · ')}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant))),
          if (data.round > 0) Padding(padding: const EdgeInsets.only(top: 2), child: Text('Round ${data.round + 1} — earlier picks set aside', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant))),
          if (data.engine == 'claude') Padding(padding: const EdgeInsets.only(top: 2), child: Text('Composed by Claude from your closet and this year’s diary', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant))),
          if (data.outfits.isEmpty)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text('No suggestions yet.', style: Theme.of(context).textTheme.bodySmall))
          else
            SizedBox(
              height: 232,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(top: 8),
                itemCount: data.outfits.length,
                separatorBuilder: (_, i) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final o = data.outfits[i];
                  return Container(
                    width: 260,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Fig.paper, borderRadius: BorderRadius.circular(Fig.radius), border: Border.all(color: Fig.neon, width: Fig.frameWidth)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(o.title, style: const TextStyle(color: Fig.ink, fontSize: 14, fontWeight: FontWeight.w800)),
                        Text(o.tagline, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                        const SizedBox(height: 6),
                        Expanded(
                          child: ListView(
                            padding: EdgeInsets.zero,
                            children: [
                              for (final p in o.pieces)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 3),
                                  child: Tooltip(
                                    message: p.why,
                                    child: RichText(text: TextSpan(style: Theme.of(context).textTheme.bodySmall, children: [
                                      TextSpan(text: '${_slotIcon[p.slot] ?? ''} '),
                                      TextSpan(text: '#${p.id} ', style: const TextStyle(color: Fig.neon, fontWeight: FontWeight.w800)),
                                      TextSpan(text: p.label),
                                      if (p.isNew) const TextSpan(text: '  NEW', style: TextStyle(color: Colors.black, backgroundColor: Fig.neon, fontWeight: FontWeight.w800, fontSize: 10)),
                                    ])),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: () => onWear(o.toPatch()), style: FilledButton.styleFrom(visualDensity: VisualDensity.compact), child: const Text('Wear this'))),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
