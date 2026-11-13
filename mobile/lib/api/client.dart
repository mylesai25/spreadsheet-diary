import 'dart:convert';

import 'package:flutter/foundation.dart' show ChangeNotifier, Uint8List;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

/// Persisted connection settings (server URL + optional password).
class AppSettings extends ChangeNotifier {
  AppSettings._(this._prefs, this.baseUrl, this.password) : client = ApiClient(baseUrl, password);

  static const _kUrl = 'baseUrl', _kPass = 'password';
  /// Override at build time: flutter run --dart-define=DIARY_URL=http://my-mac.local:3000
  static const defaultUrl = String.fromEnvironment('DIARY_URL', defaultValue: 'http://localhost:3000');

  final SharedPreferences _prefs;
  String baseUrl;
  String password;
  ApiClient client;

  static Future<AppSettings> load() async {
    final p = await SharedPreferences.getInstance();
    return AppSettings._(p, p.getString(_kUrl) ?? defaultUrl, p.getString(_kPass) ?? '');
  }

  Future<void> update({String? url, String? pass}) async {
    baseUrl = (url ?? baseUrl).trim().replaceAll(RegExp(r'/+$'), '');
    password = pass ?? password;
    await _prefs.setString(_kUrl, baseUrl);
    await _prefs.setString(_kPass, password);
    client = ApiClient(baseUrl, password);
    notifyListeners();
  }
}

/// The Virtual Closet pickers, kept in memory and on disk so opening the app or changing the date
/// doesn't re-download ~100 KB. Refreshed from the server when older than 10 minutes.
class ClosetCache {
  static const _ttl = Duration(minutes: 10);
  static const _kJson = 'closet_json', _kAt = 'closet_at', _kUrl = 'closet_url';
  static Map<String, List<ClosetItem>>? _mem;
  static DateTime? _at;
  static String? _url;

  static Map<String, List<ClosetItem>> _parse(Map<String, dynamic> j) =>
      j.map((k, v) => MapEntry(k, (v as List).map((e) => ClosetItem.fromJson(e as Map<String, dynamic>)).toList()));

  static Future<Map<String, List<ClosetItem>>> get(ApiClient api) async {
    final now = DateTime.now();
    if (_mem != null && _url == api.baseUrl && now.difference(_at!) < _ttl) return _mem!;
    final prefs = await SharedPreferences.getInstance();
    if (_mem == null && prefs.getString(_kUrl) == api.baseUrl) {
      final raw = prefs.getString(_kJson), at = prefs.getInt(_kAt);
      if (raw != null && at != null) {
        try { _mem = _parse(jsonDecode(raw) as Map<String, dynamic>); _at = DateTime.fromMillisecondsSinceEpoch(at); _url = api.baseUrl; } catch (_) {}
        if (_mem != null && now.difference(_at!) < _ttl) return _mem!;
      }
    }
    try {
      final fresh = await api.closet();
      _mem = fresh; _at = now; _url = api.baseUrl;
      await _persist(fresh, now, api.baseUrl);
      return fresh;
    } catch (e) {
      if (_mem != null && _url == api.baseUrl) return _mem!;   // offline: stale beats empty
      rethrow;
    }
  }

  /// Re-download now, ignoring the TTL (after a photo change, or a pull-to-refresh on the closet screen).
  static Future<Map<String, List<ClosetItem>>> refresh(ApiClient api) async {
    final fresh = await api.closet();
    await _persist(fresh, DateTime.now(), api.baseUrl);
    return fresh;
  }

  /// Swap one piece in the cached closet (e.g. its photo URL changed) without a round trip.
  static Future<void> update(String kind, ClosetItem item) async {
    final mem = _mem;
    if (mem == null) return;
    final list = mem[kind];
    if (list == null) return;
    final i = list.indexWhere((e) => e.id == item.id);
    if (i >= 0) list[i] = item;
    await _persist(mem, _at ?? DateTime.now(), _url ?? '');
  }

  static Future<void> _persist(Map<String, List<ClosetItem>> closet, DateTime at, String url) async {
    _mem = closet; _at = at; _url = url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kJson, jsonEncode(closet.map((k, v) => MapEntry(k, v.map((e) => e.toJson()).toList()))));
    await prefs.setInt(_kAt, at.millisecondsSinceEpoch);
    await prefs.setString(_kUrl, url);
  }
}

class ApiException implements Exception {
  ApiException(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// Thin JSON client for the Next.js `/api/*` routes.
class ApiClient {
  ApiClient(this.baseUrl, this.password);
  final String baseUrl;
  final String password;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (password.isNotEmpty) 'Authorization': 'Bearer $password',
      };

  /// Headers for Image.network() and other raw fetches (auth only).
  Map<String, String> get authHeaders => {if (password.isNotEmpty) 'Authorization': 'Bearer $password'};

  /// Absolute URL for a server-relative path such as a closet photo's `image`.
  String absolute(String path) => path.startsWith('http') ? path : '$baseUrl$path';

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? query]) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    return _decode(await http.get(uri, headers: _headers).timeout(const Duration(seconds: 30)));
  }

  Future<Map<String, dynamic>> _post(String path, Object body) async {
    final uri = Uri.parse('$baseUrl$path');
    return _decode(await http.post(uri, headers: _headers, body: jsonEncode(body)).timeout(const Duration(seconds: 30)));
  }

  Map<String, dynamic> _decode(http.Response r) {
    Map<String, dynamic>? data;
    try {
      data = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {}
    if (r.statusCode >= 400 || data == null || data['ok'] == false) {
      throw ApiException(data?['error']?.toString() ?? 'HTTP ${r.statusCode}', r.statusCode);
    }
    return data;
  }

  Future<Health> health() async => Health.fromJson(await _get('/api/health'));
  Future<List<Section>> schema() async => ((await _get('/api/schema'))['sections'] as List).map((e) => Section.fromJson(e as Map<String, dynamic>)).toList();
  /// Daily data without the closet (see [ClosetCache], which fetches /api/closet once and keeps it).
  Future<DailyData> daily(String date) async => DailyData.fromJson(await _get('/api/daily', {'date': date, 'closet': '0'}));
  Future<Map<String, List<ClosetItem>>> closet() async =>
      ((await _get('/api/closet'))['closet'] as Map).map((k, v) => MapEntry(k.toString(), (v as List).map((e) => ClosetItem.fromJson(e as Map<String, dynamic>)).toList()));
  Future<int> saveDaily(String date, Map<String, String> changes) async => (await _post('/api/daily', {'date': date, 'changes': changes}))['saved'] as int;
  Future<WeatherResult> weather({required String date, required String city, String state = '', String country = '', String wakeTime = ''}) async =>
      WeatherResult.fromJson(await _post('/api/weather', {'date': date, 'city': city, 'state': state, 'country': country, 'wakeTime': wakeTime}));
  Future<OutfitSuggestions> outfits({required String date, String feels = '', String high = '', String sky = '', List<String> seen = const [], int seed = 0}) async =>
      OutfitSuggestions.fromJson(await _get('/api/outfits', {'date': date, 'feels': feels, 'high': high, 'sky': sky, 'seen': seen.join(','), 'seed': '$seed'}));
  Future<Dashboard> dashboard(String range, {String? month}) async => Dashboard.fromJson(await _get('/api/dashboard', {'range': range, if (month != null) 'month': month}));
  Future<CalendarPage> calendar({String? month}) async => CalendarPage.fromJson(await _get('/api/calendar', {if (month != null) 'month': month}));
  Future<ClosetStats> closetStats() async => ClosetStats.fromJson(await _get('/api/closet/stats'));

  /// Form specs for adding a piece to each closet tab (columns, suggestions, next id).
  Future<List<ClosetKindForm>> closetForms() async =>
      ((await _get('/api/closet/options'))['forms'] as List).map((e) => ClosetKindForm.fromJson(e as Map<String, dynamic>)).toList();

  /// Append a piece to a closet tab; values keyed by the tab's columns. The server assigns the id.
  Future<ClosetItem> addClosetItem(String kind, Map<String, String> values) async =>
      ClosetItem.fromJson((await _post('/api/closet/$kind', {'values': values}))['item'] as Map<String, dynamic>);

  /// Attach a photo to a closet piece: raw image bytes, returns the new server-relative image URL.
  Future<String> uploadClosetPhoto(String kind, String id, Uint8List bytes, String mime) async {
    final uri = Uri.parse('$baseUrl/api/closet/photo/$kind/${Uri.encodeComponent(id)}');
    final r = await http.post(uri, headers: {...authHeaders, 'Content-Type': mime}, body: bytes).timeout(const Duration(seconds: 90));
    return _decode(r)['image'] as String;
  }

  Future<void> deleteClosetPhoto(String kind, String id) async {
    final uri = Uri.parse('$baseUrl/api/closet/photo/$kind/${Uri.encodeComponent(id)}');
    _decode(await http.delete(uri, headers: authHeaders).timeout(const Duration(seconds: 30)));
  }
  Future<ActivityStats> activityStats(String range) async => ActivityStats.fromJson(await _get('/api/activity', {'range': range}));
  Future<FriendsData> friends(String range) async => FriendsData.fromJson(await _get('/api/friends', {'range': range}));
  Future<List<ActivityInfo>> activities() async => ((await _get('/api/activities'))['activities'] as List).map((e) => ActivityInfo.fromJson(e as Map<String, dynamic>)).toList();
  Future<ActivityData> activity(String slug) async => ActivityData.fromJson(await _get('/api/activities/$slug'));
  Future<void> saveActivity(String slug, Map<String, String> values, int groupIndex) async => _post('/api/activities/$slug', {'values': values, 'groupIndex': groupIndex});
}
