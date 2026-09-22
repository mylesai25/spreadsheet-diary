import 'package:flutter/material.dart';

import '../main.dart';
import '../models/models.dart';
import '../widgets/fields.dart';

/// Activity sheets (Golf, Restaurant, …): list → add-entry form + recent entries.
class ActivitiesScreen extends StatefulWidget {
  const ActivitiesScreen({super.key});
  @override
  State<ActivitiesScreen> createState() => _ActivitiesScreenState();
}

class _ActivitiesScreenState extends State<ActivitiesScreen> {
  late Future<List<ActivityInfo>> _future;
  @override
  void initState() {
    super.initState();
    _future = ApiScope.api(context).activities();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Activities')),
        body: FutureBuilder<List<ActivityInfo>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
            if (snap.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Could not load: ${snap.error}')));
            return ListView(
              padding: const EdgeInsets.all(12),
              children: [
                for (final a in snap.data!)
                  Card(
                    color: Theme.of(context).colorScheme.surfaceContainerLow,
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: Text(a.icon, style: const TextStyle(fontSize: 24)),
                      title: Text(a.title),
                      subtitle: Text('Sheet: ${a.sheet}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ActivityDetail(info: a))),
                    ),
                  ),
              ],
            );
          },
        ),
      );
}

class ActivityDetail extends StatefulWidget {
  const ActivityDetail({super.key, required this.info});
  final ActivityInfo info;
  @override
  State<ActivityDetail> createState() => _ActivityDetailState();
}

class _ActivityDetailState extends State<ActivityDetail> {
  ActivityData? _data;
  String? _error;
  int _group = 0;
  Map<String, String> _values = {};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await ApiScope.api(context).activity(widget.info.slug);
      setState(() { _data = d; _values = _blank(d, _group); _error = null; });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Map<String, String> _blank(ActivityData d, int g) {
    final v = <String, String>{for (final f in d.groups[g].fields) f.key: f.type == FieldType.bool ? 'FALSE' : ''};
    if (d.info.dateKey != null && v.containsKey(d.info.dateKey)) v[d.info.dateKey!] = d.today;
    return v;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiScope.api(context).saveActivity(widget.info.slug, _values, _group);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Save failed: $e'), backgroundColor: Theme.of(context).colorScheme.error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final d = _data;
    return Scaffold(
      appBar: AppBar(title: Text('${widget.info.icon} ${widget.info.title}')),
      body: d == null
          ? Center(child: _error == null ? const CircularProgressIndicator() : Text(_error!))
          : ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              children: [
                Card(
                  color: cs.surfaceContainerLow,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(children: [
                          Expanded(child: Text('Add entry', style: Theme.of(context).textTheme.titleMedium)),
                          if (d.groups.length > 1)
                            SegmentedButton<int>(
                              segments: [for (var i = 0; i < d.groups.length; i++) ButtonSegment(value: i, label: Text(d.groups[i].title))],
                              selected: {_group}, showSelectedIcon: false,
                              onSelectionChanged: (s) => setState(() { _group = s.first; _values = _blank(d, _group); }),
                              style: const ButtonStyle(visualDensity: VisualDensity.compact),
                            ),
                        ]),
                        for (final f in d.groups[_group].fields)
                          Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: FieldWidget(field: f, value: _values[f.key] ?? '', options: f.options, closet: const [], onChanged: (v) => setState(() => _values[f.key] = v), onPatch: (p) => setState(() => _values.addAll(p))),
                          ),
                        const SizedBox(height: 14),
                        Row(children: [
                          TextButton(onPressed: () => setState(() => _values = _blank(d, _group)), child: const Text('Clear')),
                          const Spacer(),
                          FilledButton.icon(onPressed: _saving ? null : _save, icon: const Icon(Icons.check), label: Text(_saving ? 'Saving…' : 'Save entry')),
                        ]),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text('Recent entries · ${d.total} total', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 6),
                for (final r in d.recent.take(15))
                  Card(
                    color: cs.surfaceContainerLow,
                    margin: const EdgeInsets.only(bottom: 6),
                    child: ListTile(
                      dense: true,
                      title: Text(d.listCols.skip(1).map((c) => r[c] ?? '').where((v) => v.isNotEmpty).take(2).join(' · ')),
                      subtitle: Text(d.listCols.skip(3).map((c) => '$c: ${r[c] ?? ''}').where((v) => !v.endsWith(': ')).join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis),
                      leading: Text(r[d.listCols.first] ?? '', style: Theme.of(context).textTheme.labelSmall),
                    ),
                  ),
              ],
            ),
    );
  }
}
