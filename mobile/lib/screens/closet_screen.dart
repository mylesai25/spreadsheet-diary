import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/client.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/fields.dart' show FieldLabel, SelectField;

const _kinds = [('shirt', 'Shirts'), ('pants', 'Pants'), ('shoes', 'Shoes'), ('socks', 'Socks'), ('hat', 'Hats'), ('jacket', 'Jackets')];

String kindLabel(String kind) => _kinds.firstWhere((k) => k.$1 == kind, orElse: () => (kind, kind)).$2;
String _singular(String kind) => kindLabel(kind).replaceAll(RegExp(r'(?<!Pant)s$'), '');

/// Browse the Virtual Closet: every piece per kind, with its photo (or a swatch of its color) and description.
/// Tap a piece to see its details and attach a photo from the camera or the library.
class ClosetScreen extends StatefulWidget {
  const ClosetScreen({super.key});
  @override
  State<ClosetScreen> createState() => _ClosetScreenState();
}

class _ClosetScreenState extends State<ClosetScreen> {
  Map<String, List<ClosetItem>>? _closet;
  String? _error;
  String _kind = 'shirt';
  final _search = TextEditingController();
  String get _q => _search.text;
  bool _photosOnly = false;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool force = false}) async {
    final api = ApiScope.api(context);
    setState(() => _error = null);
    try {
      final c = force ? await ClosetCache.refresh(api) : await ClosetCache.get(api);
      if (mounted) setState(() => _closet = c);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  List<ClosetItem> get _visible {
    final all = _closet?[_kind] ?? const <ClosetItem>[];
    final q = _q.trim().toLowerCase();
    return all.where((i) {
      if (_photosOnly && !i.hasImage) return false;
      if (q.isEmpty) return true;
      return i.id == q || i.id.startsWith(q) || i.label.toLowerCase().contains(q) || i.values.values.any((v) => v.toLowerCase().contains(q));
    }).toList();
  }

  List<ClosetKindForm>? _forms;
  bool _formsLoading = false;

  Future<void> _add() async {
    final api = ApiScope.api(context);
    if (_forms == null) {
      setState(() => _formsLoading = true);
      try {
        _forms = await api.closetForms();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not load the form: $e')));
        return;
      } finally {
        if (mounted) setState(() => _formsLoading = false);
      }
    }
    if (!mounted) return;
    final form = _forms!.firstWhere((f) => f.kind == _kind);
    final added = await showModalBottomSheet<ClosetItem>(
      context: context, isScrollControlled: true, useSafeArea: true,
      builder: (_) => AddPieceSheet(kind: _kind, form: form),
    );
    if (added == null || !mounted) return;
    _forms = null;   // suggestions and next id have moved on
    try {
      final c = await ClosetCache.refresh(api);
      if (mounted) setState(() => _closet = c);
    } catch (_) {
      setState(() => _closet?[_kind]?.add(added));
    }
    if (!mounted) return;
    _search.clear();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Added ${_singular(_kind).toLowerCase()} #${added.id} — add a photo?'), duration: const Duration(seconds: 2)));
    await _open(added);
  }

  Future<void> _open(ClosetItem item) async {
    final updated = await showModalBottomSheet<ClosetItem>(
      context: context, isScrollControlled: true, useSafeArea: true,
      builder: (_) => PieceSheet(kind: _kind, item: item),
    );
    if (updated != null && mounted) {
      setState(() {
        final list = _closet?[_kind];
        final i = list?.indexWhere((e) => e.id == updated.id) ?? -1;
        if (i >= 0) list![i] = updated;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ApiScope.api(context);
    final items = _visible;
    final all = _closet?[_kind]?.length ?? 0;
    final withPhoto = _closet?[_kind]?.where((i) => i.hasImage).length ?? 0;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Virtual Closet'),
        actions: [IconButton(icon: const Icon(Icons.refresh), tooltip: 'Reload from the sheet', onPressed: () => _load(force: true))],
      ),
      floatingActionButton: _closet == null ? null : FloatingActionButton.extended(
        onPressed: _formsLoading ? null : _add,
        backgroundColor: Fig.neon, foregroundColor: Fig.paper,
        icon: _formsLoading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Fig.paper)) : const Icon(Icons.add),
        label: Text('Add ${_singular(_kind).toLowerCase()}'),
      ),
      body: _closet == null && _error == null
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(12, 6, 12, 2),
                  children: [
                    for (final k in _kinds)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text('${k.$2}${_closet == null ? '' : ' ${_closet![k.$1]?.length ?? 0}'}'),
                          selected: _kind == k.$1, showCheckmark: false,
                          onSelected: (_) => setState(() => _kind = k.$1),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
                child: Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _search,
                      decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: 'Search ${kindLabel(_kind).toLowerCase()} by # or description', suffixIcon: _q.isEmpty ? null : IconButton(icon: const Icon(Icons.close, size: 18), onPressed: _search.clear)),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.outlined(
                    tooltip: 'Only pieces with a photo',
                    isSelected: _photosOnly,
                    style: IconButton.styleFrom(side: BorderSide(color: _photosOnly ? Fig.neon : Fig.border), foregroundColor: _photosOnly ? Fig.neon : Fig.ink2),
                    icon: const Icon(Icons.photo_outlined), selectedIcon: const Icon(Icons.photo),
                    onPressed: () => setState(() => _photosOnly = !_photosOnly),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Row(children: [
                  Text('$withPhoto of $all ${kindLabel(_kind).toLowerCase()} have a photo', style: Fig.smallMuted),
                ]),
              ),
              Expanded(
                child: _error != null
                    ? ListView(padding: const EdgeInsets.all(24), children: [
                        Text('Could not load the closet: $_error', style: const TextStyle(color: Fig.red)),
                        const SizedBox(height: 12),
                        FilledButton.icon(onPressed: () => _load(force: true), icon: const Icon(Icons.refresh), label: const Text('Try again')),
                      ])
                    : RefreshIndicator(
                        onRefresh: () => _load(force: true),
                        child: items.isEmpty
                            ? ListView(padding: const EdgeInsets.all(24), children: [Text(_photosOnly ? 'No ${kindLabel(_kind).toLowerCase()} with a photo yet — tap a piece to add one.' : 'Nothing matches.', style: Fig.small)])
                            : GridView.builder(
                                padding: const EdgeInsets.fromLTRB(12, 4, 12, 88),
                                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 200, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.72),
                                itemCount: items.length,
                                itemBuilder: (context, i) => PieceCard(item: items[i], api: api, onTap: () => _open(items[i])),
                              ),
                      ),
              ),
            ]),
    );
  }
}

/// The piece's photo, or a swatch of its primary color with the type written on it.
class PiecePhoto extends StatelessWidget {
  const PiecePhoto({super.key, required this.item, required this.api, this.fit = BoxFit.cover, this.iconSize = 28});
  final ClosetItem item;
  final ApiClient api;
  final BoxFit fit;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final swatch = Fig.colorFor(item.col('Color Primary')) ?? Fig.surface2;
    final placeholder = Container(
      color: swatch.withValues(alpha: 0.35),
      alignment: Alignment.center,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.checkroom, size: iconSize, color: Fig.ink2),
        if (item.col('Type').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(item.col('Type'), style: Fig.smallMuted, textAlign: TextAlign.center)),
      ]),
    );
    if (!item.hasImage) return placeholder;
    return Image.network(
      api.absolute(item.image!), headers: api.authHeaders, fit: fit,
      loadingBuilder: (c, child, progress) => progress == null ? child : Stack(fit: StackFit.expand, children: [placeholder, const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))]),
      errorBuilder: (c, e, st) => placeholder,
    );
  }
}

class PieceCard extends StatelessWidget {
  const PieceCard({super.key, required this.item, required this.api, required this.onTap});
  final ClosetItem item;
  final ApiClient api;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(child: PiecePhoto(item: item, api: api)),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text('#${item.id}', style: const TextStyle(color: Fig.neon, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
                  const Spacer(),
                  if (item.col('Color Primary').isNotEmpty) Container(width: 10, height: 10, decoration: BoxDecoration(color: Fig.colorFor(item.col('Color Primary')) ?? Fig.muted, shape: BoxShape.circle, border: Border.all(color: Fig.border))),
                ]),
                const SizedBox(height: 2),
                Text(item.label, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Fig.ink, fontSize: 12.5, height: 1.25)),
              ]),
            ),
          ]),
        ),
      );
}

/// One piece: big photo, the sheet's description columns, and the photo controls.
/// Pops with the updated item when the photo changed.
class PieceSheet extends StatefulWidget {
  const PieceSheet({super.key, required this.kind, required this.item});
  final String kind;
  final ClosetItem item;
  @override
  State<PieceSheet> createState() => _PieceSheetState();
}

class _PieceSheetState extends State<PieceSheet> {
  late ClosetItem _item = widget.item;
  bool _busy = false;
  String? _note;
  bool _changed = false;

  static String _mimeOf(Uint8List b, String? hint) {
    if (b.length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return 'image/png';
    if (b.length > 12 && b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 && b[8] == 0x57 && b[9] == 0x45) return 'image/webp';
    if (b.length > 3 && b[0] == 0xFF && b[1] == 0xD8) return 'image/jpeg';
    return hint ?? 'image/jpeg';
  }

  Future<void> _pick(ImageSource source) async {
    final api = ApiScope.api(context);
    XFile? x;
    try {
      // Downscale on the phone: the server (and Vercel's 4.5 MB body limit) want a small JPEG, not a 12 MP original.
      x = await ImagePicker().pickImage(source: source, maxWidth: 1400, maxHeight: 1400, imageQuality: 82, requestFullMetadata: false);
    } catch (e) {
      setState(() => _note = source == ImageSource.camera ? 'Camera unavailable here ($e)' : 'Could not open the photo library ($e)');
      return;
    }
    if (x == null) return;
    setState(() { _busy = true; _note = null; });
    try {
      final bytes = await x.readAsBytes();
      final image = await api.uploadClosetPhoto(widget.kind, _item.id, bytes, _mimeOf(bytes, x.mimeType));
      final updated = _item.withImage(image);
      await ClosetCache.update(widget.kind, updated);
      if (mounted) setState(() { _item = updated; _changed = true; _note = 'Photo saved to the ${_singular(widget.kind)} sheet.'; });
    } catch (e) {
      if (mounted) setState(() => _note = 'Upload failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    final api = ApiScope.api(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Remove photo?'),
        content: Text('#${_item.id} keeps its description; only the picture goes.'),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Remove'))],
      ),
    );
    if (ok != true) return;
    setState(() { _busy = true; _note = null; });
    try {
      await api.deleteClosetPhoto(widget.kind, _item.id);
      final updated = _item.withImage(null);
      await ClosetCache.update(widget.kind, updated);
      if (mounted) setState(() { _item = updated; _changed = true; });
    } catch (e) {
      if (mounted) setState(() => _note = 'Could not remove: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ApiScope.api(context);
    final rows = _item.values.entries.where((e) => e.value.trim().isNotEmpty).map((e) => (e.key.replaceFirst(RegExp(r'^\S+\s+'), ''), e.value.trim())).toList();
    return PopScope(
      canPop: !_busy,
      onPopInvokedWithResult: (didPop, _) {},
      child: DraggableScrollableSheet(
        expand: false, initialChildSize: 0.9, maxChildSize: 0.95, minChildSize: 0.5,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            Row(children: [
              Text('#${_item.id}', style: const TextStyle(color: Fig.neon, fontSize: 20, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
              const SizedBox(width: 10),
              Expanded(child: Text(_item.col('Type').isNotEmpty ? '${_item.col('Type')} · ${_singular(widget.kind)}' : _singular(widget.kind), style: Fig.cardTitle)),
              IconButton(icon: const Icon(Icons.close), onPressed: _busy ? null : () => Navigator.pop(context, _changed ? _item : null)),
            ]),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(Fig.radius),
              child: Container(
                decoration: BoxDecoration(border: Border.all(color: Fig.frame), borderRadius: BorderRadius.circular(Fig.radius)),
                child: AspectRatio(aspectRatio: 1, child: Stack(fit: StackFit.expand, children: [
                  PiecePhoto(item: _item, api: api, fit: BoxFit.contain, iconSize: 56),
                  if (_busy) Container(color: Colors.black54, child: const Center(child: CircularProgressIndicator())),
                ])),
              ),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: FilledButton.icon(onPressed: _busy ? null : () => _pick(ImageSource.camera), icon: const Icon(Icons.photo_camera_outlined), label: const Text('Take photo'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _pick(ImageSource.gallery), icon: const Icon(Icons.photo_library_outlined), label: Text(_item.hasImage ? 'Replace' : 'Choose photo'))),
            ]),
            if (_item.hasImage)
              Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: _busy ? null : _remove, style: TextButton.styleFrom(foregroundColor: Fig.red), icon: const Icon(Icons.delete_outline, size: 18), label: const Text('Remove photo'))),
            if (_note != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_note!, style: TextStyle(color: _note!.startsWith('Photo saved') ? Fig.neon : Fig.red, fontSize: 13))),
            const SizedBox(height: 16),
            const FigHeading('Description'),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: Column(children: [
                  for (final r in rows)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        SizedBox(width: 130, child: Text(r.$1, style: Fig.smallMuted)),
                        if (r.$1.startsWith('Color') && Fig.colorFor(r.$2) != null) Padding(padding: const EdgeInsets.only(right: 8, top: 2), child: Container(width: 12, height: 12, decoration: BoxDecoration(color: Fig.colorFor(r.$2), shape: BoxShape.circle, border: Border.all(color: Fig.border)))),
                        Expanded(child: Text(r.$2, style: const TextStyle(color: Fig.ink, fontSize: 14))),
                      ]),
                    ),
                  if (rows.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('No description columns filled in for this piece.', style: Fig.smallMuted)),
                ]),
              ),
            ),
            const SizedBox(height: 8),
            Text('Edit the description in the Virtual Closet sheet; the photo is linked from its “${_singular(widget.kind)} Image” column.', style: Fig.smallMuted),
          ],
        ),
      ),
    );
  }
}

/// Test seam for the short-color guess used by [AddPieceSheet].
class AddPieceSheetGuess {
  static String guess(String primary) => _AddPieceSheetState.guessShort(primary);
}

/// Add a piece to a closet tab: one input per sheet column, with suggestions from what's already there.
/// Pops with the new item (the server assigns the id).
class AddPieceSheet extends StatefulWidget {
  const AddPieceSheet({super.key, required this.kind, required this.form});
  final String kind;
  final ClosetKindForm form;
  @override
  State<AddPieceSheet> createState() => _AddPieceSheetState();
}

class _AddPieceSheetState extends State<AddPieceSheet> {
  final Map<String, String> _values = {};
  bool _busy = false;
  String? _error;

  ClosetColumn? _col(String label) => widget.form.columns.where((c) => c.label == label).firstOrNull;
  String _v(ClosetColumn c) => _values[c.key] ?? '';

  /// Mirror of the server's family guess, so the chips show what will be stored if nothing is picked.
  static String guessShort(String primary) {
    final p = primary.toLowerCase();
    const fams = <String, List<String>>{
      'Green': ['green', 'lime', 'olive', 'eucalyptus', 'pistachio', 'mint', 'emerald', 'seafoam', 'nyanza', 'sage', 'fern', 'moss', 'teal', 'jungle', 'hunter', 'forest', 'kelly', 'army', 'cadmium'],
      'Blue': ['blue', 'navy', 'cyan', 'cerulean', 'cornflour', 'royal'],
      'Black': ['black'], 'White': ['white', 'cream', 'ivory'], 'Gray': ['gray', 'grey', 'silver', 'charcoal'],
      'Brown': ['brown', 'tan', 'khaki', 'beige', 'camel'], 'Red': ['red', 'crimson', 'maroon', 'burgundy'],
      'Purple': ['purple', 'violet', 'lavender', 'magenta'], 'Yellow': ['yellow', 'gold'], 'Orange': ['orange'], 'Pink': ['pink'],
    };
    for (final e in fams.entries) {
      if (e.value.any(p.contains)) return e.key;
    }
    return '';
  }

  Future<void> _save() async {
    final primary = _col('Color Primary');
    if (primary != null && _v(primary).trim().isEmpty) {
      setState(() => _error = 'Color Primary is required.');
      return;
    }
    final short = _col('Color Short');
    if (short != null && _v(short).isEmpty && guessShort(_v(primary!)).isEmpty) {
      setState(() => _error = 'Pick a color family — none matches "${_v(primary)}".');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final item = await ApiScope.api(context).addClosetItem(widget.kind, {for (final e in _values.entries) if (e.value.trim().isNotEmpty) e.key: e.value.trim()});
      if (mounted) Navigator.pop(context, item);
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not add: $e'; _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = _col('Color Primary');
    final guess = primary == null ? '' : guessShort(_v(primary));
    final swatch = primary == null ? null : Fig.colorFor(_v(primary).trim());
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false, initialChildSize: 0.9, maxChildSize: 0.95, minChildSize: 0.5,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            Row(children: [
              Text('#${widget.form.nextId}', style: const TextStyle(color: Fig.neon, fontSize: 20, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
              const SizedBox(width: 10),
              Expanded(child: Text('New ${_singular(widget.kind).toLowerCase()}', style: Fig.cardTitle)),
              if (swatch != null) Container(width: 18, height: 18, decoration: BoxDecoration(color: swatch, shape: BoxShape.circle, border: Border.all(color: Fig.border))),
              IconButton(icon: const Icon(Icons.close), onPressed: _busy ? null : () => Navigator.pop(context)),
            ]),
            const SizedBox(height: 4),
            Text('Goes straight into the ${_singular(widget.kind)} tab of the Virtual Closet sheet. Type freely or pick a suggestion.', style: Fig.smallMuted),
            const SizedBox(height: 12),
            for (final c in widget.form.columns) ...[
              FieldLabel(c.required ? '${c.label} *' : c.label),
              if (c.isSelect)
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final o in {...c.options, if (guess.isNotEmpty) guess})
                    ChoiceChip(
                      label: Text(o), showCheckmark: false,
                      avatar: Fig.colorFor(o) == null ? null : CircleAvatar(backgroundColor: Fig.colorFor(o), radius: 6),
                      selected: _v(c) == o || (_v(c).isEmpty && o == guess),
                      onSelected: (_) => setState(() => _values[c.key] = o),
                    ),
                ])
              else
                SelectField(value: _v(c), options: c.options, onChanged: (v) => setState(() => _values[c.key] = v)),
              if (c.isSelect && _v(c).isEmpty && guess.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Guessed from the primary color; tap another to override.', style: Fig.smallMuted)),
              const SizedBox(height: 14),
            ],
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error!, style: const TextStyle(color: Fig.red, fontSize: 13))),
            FilledButton.icon(onPressed: _busy ? null : _save, icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Fig.paper)) : const Icon(Icons.check), label: Text(_busy ? 'Adding…' : 'Add to closet')),
          ],
        ),
      ),
    );
  }
}
