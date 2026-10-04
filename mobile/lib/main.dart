import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api/client.dart';
import 'reminders.dart';
import 'screens/activities_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/friends_screen.dart';
import 'screens/log_screen.dart';
import 'theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = await AppSettings.load();
  await Reminders.init();
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
    final theme = buildFigTheme();
    return ApiScope(
      settings: settings,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Fig.paper, systemNavigationBarColor: Fig.paper),
        child: MaterialApp(
          title: 'Diary',
          debugShowCheckedModeBanner: false,
          theme: theme,
          darkTheme: theme,
          themeMode: ThemeMode.dark,
          home: const Shell(),
        ),
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
  int _tab = 0;   // home is the calendar

  @override
  Widget build(BuildContext context) {
    final pages = const [CalendarScreen(), LogScreen(), DashboardScreen(), FriendsScreen(), ActivitiesScreen()];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: Fig.line, width: 1))),
        child: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.edit_note_outlined), selectedIcon: Icon(Icons.edit_note), label: 'Log'),
            NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: 'Dashboard'),
            NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Friends'),
            NavigationDestination(icon: Icon(Icons.sports_golf_outlined), selectedIcon: Icon(Icons.sports_golf), label: 'Activities'),
          ],
        ),
      ),
    );
  }
}
