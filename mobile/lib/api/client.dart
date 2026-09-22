import 'dart:convert';

import 'package:flutter/foundation.dart' show ChangeNotifier;
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
  Future<DailyData> daily(String date) async => DailyData.fromJson(await _get('/api/daily', {'date': date}));
  Future<int> saveDaily(String date, Map<String, String> changes) async => (await _post('/api/daily', {'date': date, 'changes': changes}))['saved'] as int;
  Future<WeatherResult> weather({required String date, required String city, String state = '', String country = '', String wakeTime = ''}) async =>
      WeatherResult.fromJson(await _post('/api/weather', {'date': date, 'city': city, 'state': state, 'country': country, 'wakeTime': wakeTime}));
  Future<Dashboard> dashboard(String range) async => Dashboard.fromJson(await _get('/api/dashboard', {'range': range}));
  Future<List<ActivityInfo>> activities() async => ((await _get('/api/activities'))['activities'] as List).map((e) => ActivityInfo.fromJson(e as Map<String, dynamic>)).toList();
  Future<ActivityData> activity(String slug) async => ActivityData.fromJson(await _get('/api/activities/$slug'));
  Future<void> saveActivity(String slug, Map<String, String> values, int groupIndex) async => _post('/api/activities/$slug', {'values': values, 'groupIndex': groupIndex});
}
