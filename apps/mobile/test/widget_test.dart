import 'package:flutter_test/flutter_test.dart';
import 'package:platform_mobile/main.dart';

void main() {
  testWidgets('renders the module catalog', (tester) async {
    await tester.pumpWidget(const UtilityApp());

    expect(find.text('Utility Platform'), findsOneWidget);
    expect(find.text('Group Expenses'), findsOneWidget);
  });
}
