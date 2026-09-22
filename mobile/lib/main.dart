import 'package:flutter/material.dart';

import 'api/client.dart';
import 'screens/activities_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/log_screen.dart';
import 'screens/settings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = await AppSettings.load();
  runApp(DiaryApp(settings: settings));
}

/// App-wide access to the API client; rebuilt when settings change.
class ApiScope extends InheritedNotifier<AppSettings> {
  const ApiScope({super.key, required AppSettings settings, required super.child}) : super(notifier: settings);

  /// Subscribes to settings changes (use in build()).
  static AppSettings of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ApiScope>()!.notifier!;

  /// One-off read without subscribing — safe from initState() and callbacks.
  static AppSettings read(BuildContext context) => context.getInheritedWidgetOfExactType<ApiScope>()!.notifier!;
  static ApiClient api(BuildContext context) => read(context).client;
}

class DiaryApp extends StatelessWidget {
  const DiaryApp({super.key, required this.settings});
  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF1A7F37);
    ThemeData theme(Brightness b) => ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: b),
          inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder(), isDense: true),
          cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
        );
    return ApiScope(
      settings: settings,
      child: MaterialApp(
        title: 'Diary',
        debugShowCheckedModeBanner: false,
        theme: theme(Brightness.light),
        darkTheme: theme(Brightness.dark),
        home: const Shell(),
      ),
    );
  }
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final pages = const [LogScreen(), DashboardScreen(), ActivitiesScreen(), SettingsScreen()];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.edit_note_outlined), selectedIcon: Icon(Icons.edit_note), label: 'Log'),
          NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.sports_golf_outlined), selectedIcon: Icon(Icons.sports_golf), label: 'Activities'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}
