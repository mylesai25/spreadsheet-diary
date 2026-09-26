import 'package:flutter/material.dart';

/// The look of the Diary_Graphs figures: black paper, a lime frame around every panel,
/// green bars with lime outlines, white bold titles. Dark only — mirrors the web app's globals.css.
class Fig {
  static const paper = Color(0xFF000000);
  static const surface2 = Color(0xFF0B1A0B);
  static const neon = Color(0xFF00FF00);
  static const border = Color(0xFF1E7A1E);   // dim green: inputs, dividers
  static const ink = Color(0xFFFFFFFF);
  static const ink2 = Color(0xFFD6D6D6);
  static const muted = Color(0xFF9B9B9B);
  static const line = Color(0xFF333333);
  static const grid = Color(0xFF3D3D3D);
  static const axis = Color(0xFF8C8C8C);
  static const fill = Color(0xFF0F8F0F);     // bar fill under a lime outline
  static const dot = Color(0xFF90EE90);      // scatter dots
  static const accentSoft = Color(0xFF0B3D0B);
  static const red = Color(0xFFFF0000);
  static const gold = Color(0xFFFFD700);
  static const white = Color(0xFFFFFFFF);

  static const radius = 2.0;
  static const frameWidth = 1.5;

  /// Rank ramp from the "most-worn brands" figure: the top bars glow lime, the tail fades to forest green.
  static Color ramp(int i, int n) {
    final t = n <= 1 ? 0.0 : (i / (n - 1)).clamp(0.0, 1.0);
    return Color.lerp(neon, const Color(0xFF0A4A0A), t)!;
  }

  /// Sequential scale for heatmaps: near-black green → lime.
  static Color scale(double t) => Color.lerp(const Color(0xFF062006), neon, t.clamp(0.0, 1.0))!;

  /// Black or white text for a background (black on lime/red/white like the calendar figures).
  static Color inkOn(Color c) => c.computeLuminance() > 0.18 ? Colors.black : Colors.white;

  /// Named clothing colors → hex, carried over from the notebook (same table as the web app's colors.ts).
  static const named = <String, Color>{
    'Lime Green': Color(0xFF32CD32), 'Kelly Green': Color(0xFF4CBB17), 'Forest Green': Color(0xFF228B22), 'Dark Green': Color(0xFF023020),
    'Jungle Green': Color(0xFF2AAA8A), 'Electric Lime': Color(0xFFCCFF00), 'Olive Green': Color(0xFF808000), 'Cadmium Green': Color(0xFF097969),
    'Pastel Green': Color(0xFFC1E1C1), 'Seafoam Green': Color(0xFF9FE2BF), 'Mint Green': Color(0xFF98FF98), 'Eucalyptus': Color(0xFF5F8575),
    'Emerald Green': Color(0xFF50C878), 'Hunter Green': Color(0xFF355E3B), 'Moss Green': Color(0xFF8A9A5B), 'Gray Green': Color(0xFF5E716A),
    'Fern Green': Color(0xFF4F7942), 'Neon Green': Color(0xFF0FFF50), 'Pistachio': Color(0xFF93C572), 'Nyanza': Color(0xFFE9FFDB), 'Light Green': Color(0xFF90EE90),
    'Green': Color(0xFF008000), 'Sage': Color(0xFF9CAF88), 'Teal': Color(0xFF008080), 'Sea Green': Color(0xFF2E8B57), 'Army Green': Color(0xFF4B5320),
    'Blue': Color(0xFF0000FF), 'Light Blue': Color(0xFFADD8E6), 'Dark Blue': Color(0xFF00008B), 'Navy Blue': Color(0xFF1F3A93), 'Navy': Color(0xFF1F3A93),
    'Cornflour Blue': Color(0xFF6495ED), 'Cerulean': Color(0xFF007BA7), 'Cyan': Color(0xFF00FFFF), 'Blue Green': Color(0xFF0D98BA), 'Royal Blue': Color(0xFF4169E1),
    'White': Color(0xFFFFFFFF), 'Black': Color(0xFF000000), 'Gray': Color(0xFF808080), 'Grey': Color(0xFF808080), 'Brown': Color(0xFF8B4513), 'Tan': Color(0xFFD2B48C),
    'Khaki': Color(0xFFF0E68C), 'Beige': Color(0xFFF5F5DC), 'Cream': Color(0xFFFFFDD0), 'Red': Color(0xFFFF0000), 'Crimson': Color(0xFFDC143C), 'Maroon': Color(0xFF800000),
    'Orange': Color(0xFFFFA500), 'Yellow': Color(0xFFFFD700), 'Pink': Color(0xFFFFC0CB), 'Magenta': Color(0xFFFF00FF), 'Purple': Color(0xFF800080), 'Silver': Color(0xFFC0C0C0),
    'Gold': Color(0xFFFFD700), 'Burgundy': Color(0xFF800020), 'NA': Color(0xFFA0A0A0),
  };

  static Color? colorFor(String name) => named[name] ?? named[name.replaceAll(RegExp(r'\s*\(.*\)$'), '')];

  static const frame = RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(radius)), side: BorderSide(color: neon, width: frameWidth));
  static const frameDim = RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(radius)), side: BorderSide(color: border, width: frameWidth));

  static const tileLabel = TextStyle(color: neon, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.9);
  static const tileValue = TextStyle(color: ink, fontSize: 26, fontWeight: FontWeight.w800, height: 1.05, fontFeatures: [FontFeature.tabularFigures()]);
  static const cardTitle = TextStyle(color: ink, fontSize: 15, fontWeight: FontWeight.w800);
  static const cardSub = TextStyle(color: ink2, fontSize: 12);
  static const axisText = TextStyle(color: ink2, fontSize: 10);
  static const barLabel = TextStyle(color: ink, fontSize: 11, fontWeight: FontWeight.w800);
  static const small = TextStyle(color: ink2, fontSize: 12);
  static const smallMuted = TextStyle(color: muted, fontSize: 12);
}

ThemeData buildFigTheme() {
  const cs = ColorScheme(
    brightness: Brightness.dark,
    primary: Fig.neon, onPrimary: Colors.black,
    primaryContainer: Fig.surface2, onPrimaryContainer: Fig.ink,
    secondary: Fig.neon, onSecondary: Colors.black,
    secondaryContainer: Fig.accentSoft, onSecondaryContainer: Fig.ink,
    tertiary: Fig.gold, onTertiary: Colors.black,
    tertiaryContainer: Color(0xFF3A3000), onTertiaryContainer: Fig.gold,
    error: Fig.red, onError: Colors.black,
    errorContainer: Color(0xFF3A0000), onErrorContainer: Fig.ink,
    surface: Fig.paper, onSurface: Fig.ink,
    surfaceContainerLowest: Fig.paper, surfaceContainerLow: Fig.paper, surfaceContainer: Fig.surface2,
    surfaceContainerHigh: Fig.surface2, surfaceContainerHighest: Color(0xFF122412),
    onSurfaceVariant: Fig.ink2,
    outline: Fig.border, outlineVariant: Fig.border,
    inverseSurface: Fig.ink, onInverseSurface: Colors.black, inversePrimary: Color(0xFF0A4A0A),
    shadow: Colors.black, scrim: Colors.black,
  );
  const shape = RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(Fig.radius)));
  final base = ThemeData(useMaterial3: true, colorScheme: cs, brightness: Brightness.dark);
  return base.copyWith(
    scaffoldBackgroundColor: Fig.paper,
    canvasColor: Fig.paper,
    dividerColor: Fig.line,
    textTheme: base.textTheme.apply(bodyColor: Fig.ink, displayColor: Fig.ink),
    appBarTheme: const AppBarTheme(
      backgroundColor: Fig.paper, foregroundColor: Fig.ink, elevation: 0, scrolledUnderElevation: 0, centerTitle: false,
      titleTextStyle: TextStyle(color: Fig.ink, fontSize: 20, fontWeight: FontWeight.w800),
      shape: Border(bottom: BorderSide(color: Fig.neon, width: Fig.frameWidth)),
    ),
    cardTheme: const CardThemeData(color: Fig.paper, elevation: 0, margin: EdgeInsets.zero, shape: Fig.frame),
    inputDecorationTheme: const InputDecorationTheme(
      isDense: true, filled: true, fillColor: Fig.paper,
      hintStyle: TextStyle(color: Fig.muted), helperStyle: TextStyle(color: Fig.muted), labelStyle: TextStyle(color: Fig.ink2), suffixStyle: TextStyle(color: Fig.muted),
      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(Fig.radius)), borderSide: BorderSide(color: Fig.border, width: Fig.frameWidth)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(Fig.radius)), borderSide: BorderSide(color: Fig.border, width: Fig.frameWidth)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(Fig.radius)), borderSide: BorderSide(color: Fig.neon, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(Fig.radius)), borderSide: BorderSide(color: Fig.red, width: Fig.frameWidth)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Fig.paper, selectedColor: Fig.neon, disabledColor: Fig.paper, checkmarkColor: Colors.black,
      side: const BorderSide(color: Fig.border, width: Fig.frameWidth), shape: shape,
      labelStyle: const TextStyle(color: Fig.ink2, fontSize: 13),
      secondaryLabelStyle: const TextStyle(color: Colors.black, fontSize: 13, fontWeight: FontWeight.w800),
      deleteIconColor: Fig.muted, iconTheme: const IconThemeData(color: Fig.ink2, size: 16),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        shape: const WidgetStatePropertyAll(shape),
        side: const WidgetStatePropertyAll(BorderSide(color: Fig.border, width: Fig.frameWidth)),
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Fig.neon : Fig.paper),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.black : Fig.ink2),
        textStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w500)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: ButtonStyle(
        shape: const WidgetStatePropertyAll(shape),
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.disabled) ? Fig.neon.withValues(alpha: 0.35) : Fig.neon),
        foregroundColor: const WidgetStatePropertyAll(Colors.black),
        textStyle: const WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w800)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: ButtonStyle(
        shape: const WidgetStatePropertyAll(shape),
        side: WidgetStateProperty.resolveWith((s) => BorderSide(color: s.contains(WidgetState.focused) ? Fig.neon : Fig.border, width: Fig.frameWidth)),
        foregroundColor: const WidgetStatePropertyAll(Fig.ink),
        backgroundColor: const WidgetStatePropertyAll(Fig.paper),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: ButtonStyle(shape: const WidgetStatePropertyAll(shape), foregroundColor: const WidgetStatePropertyAll(Fig.neon), textStyle: const WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w700))),
    ),
    iconButtonTheme: const IconButtonThemeData(style: ButtonStyle(foregroundColor: WidgetStatePropertyAll(Fig.ink))),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Fig.paper, indicatorColor: Fig.neon, indicatorShape: shape, elevation: 0, height: 64,
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? Colors.black : Fig.ink2)),
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(color: s.contains(WidgetState.selected) ? Fig.neon : Fig.ink2, fontSize: 12, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w500)),
    ),
    listTileTheme: const ListTileThemeData(textColor: Fig.ink, iconColor: Fig.ink2, subtitleTextStyle: TextStyle(color: Fig.ink2, fontSize: 12)),
    snackBarTheme: const SnackBarThemeData(backgroundColor: Fig.surface2, contentTextStyle: TextStyle(color: Fig.ink), shape: Fig.frame, behavior: SnackBarBehavior.floating),
    dialogTheme: const DialogThemeData(backgroundColor: Fig.paper, shape: Fig.frame, titleTextStyle: TextStyle(color: Fig.ink, fontSize: 18, fontWeight: FontWeight.w800), contentTextStyle: TextStyle(color: Fig.ink2, fontSize: 14)),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Fig.paper, shape: RoundedRectangleBorder(side: BorderSide(color: Fig.neon, width: Fig.frameWidth))),
    timePickerTheme: const TimePickerThemeData(backgroundColor: Fig.paper, shape: Fig.frame),
    datePickerTheme: const DatePickerThemeData(backgroundColor: Fig.paper, shape: Fig.frame, headerForegroundColor: Fig.ink),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.black : Fig.ink2),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Fig.neon : Fig.paper),
      trackOutlineColor: const WidgetStatePropertyAll(Fig.border),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: Fig.neon),
    tooltipTheme: const TooltipThemeData(decoration: BoxDecoration(color: Fig.paper, border: Border.fromBorderSide(BorderSide(color: Fig.neon, width: Fig.frameWidth))), textStyle: TextStyle(color: Fig.ink, fontSize: 12)),
    splashFactory: InkSparkle.splashFactory,
  );
}

/// A framed figure: black panel, lime border, white bold title.
class FigCard extends StatelessWidget {
  const FigCard({super.key, required this.title, this.sub, required this.child, this.trailing});
  final String title;
  final String? sub;
  final Widget child;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: Fig.cardTitle), if (sub != null) Text(sub!, style: Fig.cardSub)])),
                  if (trailing != null) trailing!,
                ]),
                const SizedBox(height: 10),
                child,
              ],
            ),
          ),
        ),
      );
}

/// Headline number in a framed panel.
class FigTile extends StatelessWidget {
  const FigTile({super.key, required this.label, required this.value, this.sub});
  final String label, value;
  final String? sub;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label.toUpperCase(), style: Fig.tileLabel, maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 3),
              Text(value, style: Fig.tileValue, maxLines: 1, overflow: TextOverflow.ellipsis),
              if (sub != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: Fig.small)),
            ],
          ),
        ),
      );
}

/// Section heading with the legend-style swatch.
class FigHeading extends StatelessWidget {
  const FigHeading(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 8, 2, 10),
        child: Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: Fig.neon, border: Border.all(color: Colors.black), boxShadow: const [BoxShadow(color: Fig.neon, spreadRadius: 1.5)])),
          const SizedBox(width: 10),
          Text(text, style: const TextStyle(color: Fig.ink, fontSize: 17, fontWeight: FontWeight.w800)),
        ]),
      );
}

/// Legend box like the figures': black, lime border, square swatches.
class FigLegend extends StatelessWidget {
  const FigLegend(this.items, {super.key, this.title});
  final List<(String, Color)> items;
  final String? title;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: Fig.paper, border: Border.all(color: Fig.neon, width: Fig.frameWidth)),
        child: Wrap(spacing: 12, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
          if (title != null) Text(title!, style: const TextStyle(color: Fig.ink, fontSize: 12, fontWeight: FontWeight.w800)),
          for (final i in items)
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 12, height: 12, decoration: BoxDecoration(color: i.$2, border: Border.all(color: Fig.neon, width: 1.5))),
              const SizedBox(width: 5),
              Text(i.$1, style: Fig.small),
            ]),
        ]),
      );
}
