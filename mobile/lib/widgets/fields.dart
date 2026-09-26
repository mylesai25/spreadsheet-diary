import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/models.dart';
import '../theme.dart';

/// Field renderers shared by the daily log and activity forms.
/// Values are always strings (what the sheet stores): "TRUE"/"FALSE", "HH:MM", "A, B, C".

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.changed = false});
  final String text;
  final bool changed;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(changed ? '$text •' : text, style: const TextStyle(color: Fig.ink2, fontSize: 13, fontWeight: FontWeight.w600)),
      );
}

class BoolField extends StatelessWidget {
  const BoolField({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerLeft,
        child: SegmentedButton<String>(
          segments: const [ButtonSegment(value: 'FALSE', label: Text('No')), ButtonSegment(value: 'TRUE', label: Text('Yes'))],
          selected: {value == 'TRUE' ? 'TRUE' : 'FALSE'},
          showSelectedIcon: false,
          onSelectionChanged: (s) => onChanged(s.first),
          style: const ButtonStyle(visualDensity: VisualDensity.compact),
        ),
      );
}

class RatingField extends StatelessWidget {
  const RatingField({super.key, required this.value, required this.onChanged, this.min = 1, this.max = 10});
  final String value;
  final int min, max;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final n = int.tryParse(value);
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (var k = min; k <= max; k++)
          ChoiceChip(
            label: Text('$k'),
            selected: n == k,
            showCheckmark: false,
            selectedColor: Fig.neon,
            labelStyle: TextStyle(color: n == k ? Colors.black : cs.onSurface, fontWeight: n == k ? FontWeight.w800 : FontWeight.w500),
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            onSelected: (_) => onChanged(n == k ? '' : '$k'),
          ),
      ],
    );
  }
}

/// TextField that keeps its controller in sync with an externally-managed value.
class _SyncedText extends StatefulWidget {
  const _SyncedText({required this.value, required this.onChanged, this.keyboardType, this.formatters, this.decoration, this.maxLines = 1});
  final String value;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? formatters;
  final InputDecoration? decoration;
  final int maxLines;
  @override
  State<_SyncedText> createState() => _SyncedTextState();
}

class _SyncedTextState extends State<_SyncedText> {
  late final TextEditingController _c = TextEditingController(text: widget.value);
  @override
  void didUpdateWidget(covariant _SyncedText old) {
    super.didUpdateWidget(old);
    if (widget.value != _c.text) _c.value = TextEditingValue(text: widget.value, selection: TextSelection.collapsed(offset: widget.value.length));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _c, keyboardType: widget.keyboardType, inputFormatters: widget.formatters, decoration: widget.decoration, maxLines: widget.maxLines, onChanged: widget.onChanged);
}

class NumberField extends StatelessWidget {
  const NumberField({super.key, required this.value, required this.onChanged, this.unit, this.hint});
  final String value;
  final String? unit, hint;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => _SyncedText(
        value: value, onChanged: onChanged,
        keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: false),
        formatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]'))],
        decoration: InputDecoration(suffixText: unit, helperText: hint, helperMaxLines: 2),
      );
}

class TextInputField extends StatelessWidget {
  const TextInputField({super.key, required this.value, required this.onChanged, this.multiline = false});
  final String value;
  final bool multiline;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => _SyncedText(value: value, onChanged: onChanged, maxLines: multiline ? 3 : 1, keyboardType: multiline ? TextInputType.multiline : TextInputType.text);
}

class TimeField extends StatelessWidget {
  const TimeField({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  TimeOfDay? get _tod {
    final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(value);
    return m == null ? null : TimeOfDay(hour: int.parse(m[1]!), minute: int.parse(m[2]!));
  }

  @override
  Widget build(BuildContext context) {
    final t = _tod;
    return OutlinedButton.icon(
      icon: const Icon(Icons.schedule, size: 18),
      label: Text(t == null ? 'Set time' : t.format(context)),
      style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, minimumSize: const Size.fromHeight(44)),
      onPressed: () async {
        final picked = await showTimePicker(context: context, initialTime: t ?? const TimeOfDay(hour: 8, minute: 0));
        if (picked != null) onChanged('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
      },
      onLongPress: () => onChanged(''),
    );
  }
}

class DateField extends StatelessWidget {
  const DateField({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        icon: const Icon(Icons.calendar_today, size: 18),
        label: Text(value.isEmpty ? 'Pick date' : value),
        style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, minimumSize: const Size.fromHeight(44)),
        onPressed: () async {
          final now = DateTime.now();
          final picked = await showDatePicker(context: context, initialDate: DateTime.tryParse(value) ?? now, firstDate: DateTime(2020), lastDate: DateTime(now.year + 1));
          if (picked != null) onChanged(picked.toIso8601String().substring(0, 10));
        },
      );
}

/// Free text with suggestions from history.
class SelectField extends StatelessWidget {
  const SelectField({super.key, required this.value, required this.options, required this.onChanged});
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) => Autocomplete<String>(
          initialValue: TextEditingValue(text: value),
          optionsBuilder: (t) {
            final q = t.text.trim().toLowerCase();
            final list = q.isEmpty ? options : options.where((o) => o.toLowerCase().contains(q)).toList();
            return list.take(12);
          },
          onSelected: onChanged,
          fieldViewBuilder: (context, controller, focus, onSubmit) {
            if (controller.text != value && !focus.hasFocus) controller.text = value;
            return TextField(controller: controller, focusNode: focus, decoration: const InputDecoration(hintText: 'Type or pick…'), onChanged: onChanged, onSubmitted: (_) => onSubmit());
          },
          optionsViewBuilder: (context, onSelected, opts) => Align(
            alignment: Alignment.topLeft,
            child: Material(
              elevation: 0,
              color: Fig.paper,
              shape: Fig.frame,
              child: SizedBox(
                width: constraints.maxWidth,
                child: ListView(
                  shrinkWrap: true, padding: EdgeInsets.zero,
                  children: [for (final o in opts) ListTile(dense: true, title: Text(o), onTap: () => onSelected(o))],
                ),
              ),
            ),
          ),
        ),
      );
}

/// Comma-separated list edited as chips.
class MultiField extends StatefulWidget {
  const MultiField({super.key, required this.value, required this.options, required this.onChanged});
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;
  @override
  State<MultiField> createState() => _MultiFieldState();
}

class _MultiFieldState extends State<MultiField> {
  final _c = TextEditingController();
  final _focus = FocusNode();

  List<String> get _tokens => widget.value.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();

  void _add(String t) {
    final v = t.trim();
    if (v.isEmpty) return;
    final list = _tokens;
    if (!list.contains(v)) widget.onChanged([...list, v].join(', '));
    _c.clear();
  }

  void _remove(String t) => widget.onChanged(_tokens.where((x) => x != t).join(', '));

  @override
  void dispose() {
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = _tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (tokens.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Wrap(spacing: 6, runSpacing: 6, children: [for (final t in tokens) InputChip(label: Text(t), onDeleted: () => _remove(t), visualDensity: VisualDensity.compact)]),
          ),
        LayoutBuilder(
          builder: (context, constraints) => RawAutocomplete<String>(
            textEditingController: _c,
            focusNode: _focus,
            optionsBuilder: (t) {
              final q = t.text.trim().toLowerCase();
              final avail = widget.options.where((o) => !tokens.contains(o));
              return (q.isEmpty ? avail : avail.where((o) => o.toLowerCase().contains(q))).take(10);
            },
            onSelected: _add,
            fieldViewBuilder: (context, controller, focus, onSubmit) => TextField(
              controller: controller, focusNode: focus,
              decoration: InputDecoration(hintText: 'Add…', suffixIcon: IconButton(icon: const Icon(Icons.add), onPressed: () => _add(controller.text))),
              onSubmitted: (v) { _add(v); focus.requestFocus(); },
            ),
            optionsViewBuilder: (context, onSelected, opts) => Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 0,
                color: Fig.paper,
                shape: Fig.frame,
                child: SizedBox(width: constraints.maxWidth, child: ListView(shrinkWrap: true, padding: EdgeInsets.zero, children: [for (final o in opts) ListTile(dense: true, title: Text(o), onTap: () => onSelected(o))])),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Closet item picker: search by #id or description in a bottom sheet.
class ClosetField extends StatelessWidget {
  const ClosetField({super.key, required this.value, required this.items, required this.onPick, required this.onClear});
  final String value;
  final List<ClosetItem> items;
  final ValueChanged<ClosetItem> onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    ClosetItem? current;
    for (final i in items) {
      if (i.id == value) current = i;
    }
    return OutlinedButton(
      style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, minimumSize: const Size.fromHeight(44), padding: const EdgeInsets.symmetric(horizontal: 12)),
      onPressed: () async {
        final picked = await showModalBottomSheet<ClosetItem>(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => _ClosetSheet(items: items));
        if (picked != null) onPick(picked);
      },
      child: Row(
        children: [
          if (current != null) ...[
            Text('#${current.id}', style: const TextStyle(color: Fig.neon, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
            const SizedBox(width: 8),
            Expanded(child: Text(current.label, overflow: TextOverflow.ellipsis, style: TextStyle(color: cs.onSurface))),
            IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onClear, visualDensity: VisualDensity.compact),
          ] else if (value.isNotEmpty) ...[
            Expanded(child: Text('#$value (not in closet)', style: TextStyle(color: cs.error))),
            IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onClear, visualDensity: VisualDensity.compact),
          ] else
            Expanded(child: Text('Search by # or description…', style: TextStyle(color: cs.onSurfaceVariant))),
        ],
      ),
    );
  }
}

class _ClosetSheet extends StatefulWidget {
  const _ClosetSheet({required this.items});
  final List<ClosetItem> items;
  @override
  State<_ClosetSheet> createState() => _ClosetSheetState();
}

class _ClosetSheetState extends State<_ClosetSheet> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = q.isEmpty ? widget.items : widget.items.where((i) => i.id == q || i.id.startsWith(q) || i.label.toLowerCase().contains(q)).toList();
    return DraggableScrollableSheet(
      expand: false, initialChildSize: 0.8, maxChildSize: 0.95,
      builder: (context, scroll) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(autofocus: true, decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by # or description'), onChanged: (v) => setState(() => _q = v)),
          ),
          Expanded(
            child: ListView.builder(
              controller: scroll,
              itemCount: list.length,
              itemBuilder: (context, i) => ListTile(
                dense: true,
                leading: Text('#${list[i].id}', style: const TextStyle(color: Fig.neon, fontWeight: FontWeight.w800)),
                title: Text(list[i].label),
                onTap: () => Navigator.pop(context, list[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Renders any [Field] given the current values map.
class FieldWidget extends StatelessWidget {
  const FieldWidget({super.key, required this.field, required this.value, required this.options, required this.closet, required this.onChanged, required this.onPatch, this.changed = false});
  final Field field;
  final String value;
  final List<String> options;
  final List<ClosetItem> closet;
  final ValueChanged<String> onChanged;
  final ValueChanged<Map<String, String>> onPatch;
  final bool changed;

  @override
  Widget build(BuildContext context) {
    Widget input;
    switch (field.type) {
      case FieldType.bool:
        input = BoolField(value: value, onChanged: onChanged);
      case FieldType.rating:
        input = RatingField(value: value, min: field.min?.toInt() ?? 1, max: field.max?.toInt() ?? 10, onChanged: onChanged);
      case FieldType.number:
        input = NumberField(value: value, unit: field.unit, hint: field.hint, onChanged: onChanged);
      case FieldType.time:
        input = TimeField(value: value, onChanged: onChanged);
      case FieldType.date:
        input = DateField(value: value, onChanged: onChanged);
      case FieldType.textarea:
        input = TextInputField(value: value, multiline: true, onChanged: onChanged);
      case FieldType.text:
        input = TextInputField(value: value, onChanged: onChanged);
      case FieldType.select:
        input = SelectField(value: value, options: options, onChanged: onChanged);
      case FieldType.multi:
        input = MultiField(value: value, options: options, onChanged: onChanged);
      case FieldType.closet:
        input = ClosetField(
          value: value, items: closet,
          onPick: (it) => onPatch({field.key: it.id, ...it.values}),
          onClear: () {
            final blank = <String, String>{field.key: ''};
            for (final i in closet) {
              if (i.id == value) {
                for (final k in i.values.keys) {
                  blank[k] = '';
                }
              }
            }
            onPatch(blank);
          },
        );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [FieldLabel(field.title, changed: changed), input]);
  }
}
