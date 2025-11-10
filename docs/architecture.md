# Utility Platform – Architecture Overview

## Goals
- Provide a single backend + auth surface area that powers multiple personal tools.
- Allow vocal groups to track shared trip expenses end-to-end.
- Capture and store receipt images/PDFs, extract details with Amazon Textract.
- Support per-line item or even split allocations, tax/tip handling, and settle-up tracking.
- Keep hosting and operations costs low; target AWS Amplify for the web client and fully managed serverless for the backend.

## High-Level Design
```
Web Super App (Vite/React) ── Amplify Hosting / Vite Dev Server
              │
              ├── Flutter Super App (iOS / Android / PWA)
              │
              ▼
Amazon API Gateway (HTTP API + Cognito authorizer)
              │
              ▼
AWS Lambda (services/api – TypeScript handlers bundled w/ esbuild)
              │
              ├── DynamoDB Tables
              │     • Trips
              │     • TripMembers
              │     • Expenses
              │     • Settlements
              │
              ├── Amazon S3 (ReceiptBucket)
              │     • Stores original receipts and normalized assets.
              │
              └── Amazon Textract (AnalyzeExpense API)
                    • Extracts structured data (vendor, totals, line items).
```

### Authentication
- Amazon Cognito User Pool provides hosted UI + JWTs for both shells.
- API Gateway uses the Cognito JWT authorizer; the web client already uses Amplify Authenticator and the Flutter shell will reuse the same pool/clients via Amplify or aws_cognito_auth.
- Fine-grained access enforced in Lambda (a caller can only touch trips they belong to).

### Backend Overview
- REST-style API exposed via API Gateway. All modules share the same surface area; new tools simply add routes/handlers.
- Lambda handlers implemented in TypeScript under `services/api/src/handlers`.
- Shared utilities for validation, DTO mapping, and Textract parsing live in `services/api/src/lib`.
- Data access performed via the AWS SDK v3 DocumentClient.
- Textract processing flow:
  1. Client uploads receipt via signed URL from `POST /trips/{tripId}/receipts`.
  2. Upload triggers asynchronous Lambda (via S3 EventBridge notification).
  3. Lambda invokes Textract `AnalyzeExpense`.
  4. Parsed results stored in DynamoDB `ReceiptExtraction` item and pushed to trip notification queue (SNS/WebSocket placeholder).

### Data Model (DynamoDB)
- **Trips** (PK: `TRIP#{tripId}`, SK: `METADATA`) – core trip details.
- **TripMembers** (PK: `TRIP#{tripId}`, SK: `MEMBER#{memberId}`) – member profiles stored with Cognito-linked user IDs.
- **Expenses** (PK: `TRIP#{tripId}`, SK: `EXPENSE#{expenseId}`) – expense metadata, totals, payer, cost allocations.
- **Settlements** (PK: `TRIP#{tripId}`, SK: `SETTLEMENT#{settlementId}`) – records of payments made to settle balances.
- **Receipts** (PK: `TRIP#{tripId}`, SK: `RECEIPT#{receiptId}`) – upload status and Textract results.
- **UserProfiles** (PK: `USER#{userId}`, SK: `PROFILE`) – cached display name/email for Cognito users, indexed via `GSI2 (PK: EMAIL, SK: EMAIL#{emailLower}#USER#{userId})` for prefix search.

All items live in a single DynamoDB table using composite keys, `GSI1` for member trip lookups, and `GSI2` for user email search.

### API Surface (initial)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/trips` | Create a new trip; caller becomes owner. |
| GET | `/trips` | List trips the caller can access. |
| GET | `/trips/{tripId}` | Fetch trip summary, members, running balances. |
| POST | `/trips/{tripId}/members` | Add members to a trip. |
| POST | `/trips/{tripId}/expenses` | Create expense (one-touch or itemized). |
| PATCH | `/trips/{tripId}/expenses/{expenseId}` | Update allocations, mark receipts parsed. |
| POST | `/trips/{tripId}/receipts` | Request signed upload URL + create receipt record. |
| POST | `/trips/{tripId}/settlements` | Record a payment between members. |
| PATCH | `/trips/{tripId}/settlements/{settlementId}` | Mark settlement confirmed. |
| GET | `/users?query=` | Search existing people by name or email prefix. |

### Web Super App
- Lives in `apps/web` (Vite + React + TypeScript).
- Uses the Amplify Authenticator for sign-in/out and React Query for data fetching.
- Module navigation + registry (`src/modules/registry.ts`) control the top-level routing shell; each module renders under its own `/module-id/*` prefix.
- The Group Expenses module reuses the existing Trip list/detail workflow, Add Expense wizard, and settlement tracker.
- File uploads still flow through signed URLs + S3 with optimistic UI updates.
- Additional modules can register their own components and React Query keys without touching the rest of the shell.

### Mobile Super App
- Flutter project under `apps/mobile`.
- Mirrors the registry pattern from the web shell via `lib/modules/module_registry.dart`.
- The current `GroupExpensesScreen` surfaces configuration + TODOs while we wire Cognito + API clients; it reads env values from `AppConfig` (backed by `--dart-define`).
- Future modules push screens onto the shared navigator, enabling a single login session across tools on iOS/Android.

### Infrastructure as Code
- AWS CDK (TypeScript) project lives in `infra/`.
- Stacks:
  - `CoreStack`: DynamoDB table, S3 bucket, Cognito User Pool/Client, KMS keys if needed.
  - `ApiStack`: API Gateway, Lambda functions (uses Lambda Powertools for TypeScript), IAM roles/policies, S3 event notifications for Textract processor.
  - `PipelineStack` (optional future): Amplify deployment integration placeholder.
- CDK context configured for environment selection (dev/prod).
- CDK outputs include API endpoint, User Pool IDs, bucket names, used by the web `.env` and Flutter `--dart-define`s.

### Operations & Cost Considerations
- All backend components are serverless/on-demand to keep idle costs near zero.
- DynamoDB on-demand billing initially; can switch to provisioned with autoscaling.
- S3 lifecycle rules expire raw receipts after 2 years (configurable).
- Textract used on-demand; caution users about per-page pricing.
- Monitoring via CloudWatch dashboards + alarms (not yet implemented).

### Future Enhancements
- Replace REST with GraphQL/AppSync for real-time updates.
- Add WebSocket/SNS notifications for Textract completion.
- Integrate currency handling and multi-trip settlements.
- Introduce analytics dashboard (spend per member, category).
- Add offline-friendly PWA capabilities.
