import 'package:flutter/material.dart';

import '../../app_config.dart';

class GroupExpensesScreen extends StatelessWidget {
  const GroupExpensesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Group Expenses'),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Shared backend ready',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'This module will reuse the same Cognito + API stack as the web shell. '
                    'Wire Amplify Auth or AWS Cognito Federated Sign-In here and call the REST endpoints when tokens are available.',
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Next steps:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  SizedBox(height: 6),
                  Text('• Add an Amplify/Cognito auth flow for mobile.'),
                  Text('• Mirror the Trip + Expense data hooks using the shared API.'),
                  Text('• Implement offline caching for receipts later.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Environment snapshot',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  _ConfigRow(label: 'API base URL', value: AppConfig.apiBaseUrl),
                  _ConfigRow(label: 'AWS region', value: AppConfig.region),
                  _ConfigRow(label: 'User pool ID', value: AppConfig.userPoolId.isEmpty ? 'Not set' : AppConfig.userPoolId),
                  _ConfigRow(
                    label: 'User pool client ID',
                    value: AppConfig.userPoolClientId.isEmpty ? 'Not set' : AppConfig.userPoolClientId,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Pass these values via `--dart-define` when running `flutter run` or when wiring CI builds.',
                    style: TextStyle(fontSize: 13, color: Colors.white70),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}

class _ConfigRow extends StatelessWidget {
  final String label;
  final String value;

  const _ConfigRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: Colors.white70),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600),
          )
        ],
      ),
    );
  }
}
