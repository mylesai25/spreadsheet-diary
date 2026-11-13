import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/client.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';

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
                                padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
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
