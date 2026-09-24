import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Daily "did you log today?" reminder.
///
/// iOS can't run our code at reminder time, so the app schedules one local notification per day for the
/// next [_days] days and, whenever it sees the diary (every load or save carries the full list of logged
/// dates), cancels the ones for days that are already logged. Net effect: the reminder only fires on a day
/// you haven't filled in — as long as the phone app has seen the diary since you logged it.
class Reminders {
  static const _days = 30;
  static const _kOn = 'reminder_on', _kHour = 'reminder_hour', _kMin = 'reminder_min';
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;
  static Set<String> _logged = {};

  static bool enabled = false;
  static int hour = 21, minute = 0;

  static Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    enabled = p.getBool(_kOn) ?? false;
    hour = p.getInt(_kHour) ?? 21;
    minute = p.getInt(_kMin) ?? 0;
    tzdata.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation((await FlutterTimezone.getLocalTimezone()).identifier));
    } catch (_) {
      // Unknown zone name: tz.local stays UTC; times are still computed from the device clock offset below.
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        iOS: DarwinInitializationSettings(requestAlertPermission: false, requestSoundPermission: false, requestBadgePermission: false),
      ),
    );
    _ready = true;
  }

  /// Turn reminders on (asks for notification permission) or off. Returns false if permission was denied.
  static Future<bool> setEnabled(bool on) async {
    if (on) {
      final ok = await _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, sound: true, badge: true);
      if (ok == false) return false;
    }
    enabled = on;
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kOn, on);
    await reschedule();
    return true;
  }

  static Future<void> setTime(int h, int m) async {
    hour = h;
    minute = m;
    final p = await SharedPreferences.getInstance();
    await p.setInt(_kHour, h);
    await p.setInt(_kMin, m);
    await reschedule();
  }

  /// Call whenever the app learns which dates are logged (any /api/daily response has the full list).
  static Future<void> sync(Iterable<String> loggedDates) async {
    _logged = loggedDates.toSet();
    await reschedule();
  }

  static String _iso(tz.TZDateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static Future<void> reschedule() async {
    if (!_ready) return;
    await _plugin.cancelAll();
    if (!enabled) return;
    final now = tz.TZDateTime.now(tz.local);
    for (var i = 0; i < _days; i++) {
      final day = tz.TZDateTime(tz.local, now.year, now.month, now.day + i);
      final iso = _iso(day);
      if (_logged.contains(iso)) continue;
      final at = tz.TZDateTime(tz.local, day.year, day.month, day.day, hour, minute);
      if (!at.isAfter(now)) continue;
      var body = "Today isn't logged yet — tap to fill it in.";
      if (i == 0) {
        // How many of the previous 7 days are still empty (only meaningful for today's reminder).
        var missing = 0;
        for (var k = 1; k <= 7; k++) {
          if (!_logged.contains(_iso(tz.TZDateTime(tz.local, now.year, now.month, now.day - k)))) missing++;
        }
        if (missing > 0) body += ' $missing other day${missing == 1 ? '' : 's'} this week ${missing == 1 ? 'is' : 'are'} empty too.';
      }
      await _plugin.zonedSchedule(
        id: day.year * 10000 + day.month * 100 + day.day,
        scheduledDate: at,
        title: 'Diary',
        body: body,
        payload: iso,
        notificationDetails: const NotificationDetails(iOS: DarwinNotificationDetails()),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    }
  }
}
