import 'package:flutter/material.dart';

import '../main.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _url;
  late final TextEditingController _pass;
  String? _status;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final s = ApiScope.read(context);
    _url = TextEditingController(text: s.baseUrl);
    _pass = TextEditingController(text: s.password);
  }

  @override
  void dispose() {
    _url.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _saveAndTest() async {
    setState(() { _busy = true; _status = null; });
    final s = ApiScope.read(context);
    await s.update(url: _url.text, pass: _pass.text);
    try {
      final h = await s.client.health();
      setState(() => _status = 'Connected · data source: ${h.store == 'sheets' ? 'Google Sheets' : 'local CSV'}${h.authRequired ? ' · password required' : ''}');
    } catch (e) {
      setState(() => _status = 'Could not connect: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Diary server', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text('The Next.js app that owns the Google Sheet. On the same Wi‑Fi use http://<your-mac>.local:3000; once deployed, the Vercel URL.', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
          const SizedBox(height: 12),
          TextField(controller: _url, decoration: const InputDecoration(labelText: 'Server URL'), keyboardType: TextInputType.url, autocorrect: false),
          const SizedBox(height: 12),
          TextField(controller: _pass, decoration: const InputDecoration(labelText: 'App password (if set)'), obscureText: true),
          const SizedBox(height: 12),
          FilledButton.icon(onPressed: _busy ? null : _saveAndTest, icon: const Icon(Icons.wifi_tethering), label: Text(_busy ? 'Testing…' : 'Save & test connection')),
          if (_status != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_status!, style: TextStyle(color: _status!.startsWith('Connected') ? cs.primary : cs.error))),
          const SizedBox(height: 32),
          Text('About', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text('Spreadsheet Diary · Flutter client 0.1. Entries are written straight to your Google Sheet through the server; weather and smart defaults come from there too.', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
        ],
      ),
    );
  }
}
