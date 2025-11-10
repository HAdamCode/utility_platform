# Utility Platform Monorepo

This repo now hosts the entire toolkit I want to build: a single backend, a single web experience, and a single mobile experience that each surface multiple tools. The first live module is the **Group Expenses** workflow, and every future tool will plug into the same AWS stack.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `services/api/` | Node.js (TypeScript) Lambda handlers that power every module. |
| `infra/` | AWS CDK app (TypeScript) that provisions Cognito, API Gateway, DynamoDB, S3, and Textract. |
| `apps/web/` | Vite + React “super app” shell that lists tools and routes into module-specific pages. |
| `apps/mobile/` | Flutter shell that mirrors the module directory for native + PWA targets. |
| `docs/` | Architecture notes, design decisions, and module roadmap. |

## Prerequisites

- Node.js 18+ and npm (for the API, CDK, and React app)
- Flutter 3.22+ (already installed at `~/development/flutter`)
- AWS CLI with credentials that can deploy the stack

## Shared Backend (`services/api` + `infra`)

1. Install dependencies and run basic checks:
   ```bash
   cd services/api
   npm install
   npm run build   # type-checks
   npm test        # unit tests / vitest
   ```
2. Deploy infrastructure (one-time per environment):
   ```bash
   cd infra
   npm install
   npm run build
   npm run synth
   npm run deploy
   ```
3. CDK outputs provide everything both clients need:
   - `ApiEndpoint`
   - `UserPoolId`
   - `UserPoolClientId`
   - `ReceiptBucketName`

`infra/src/stacks/group-expenses-stack.ts` now points to `services/api`, so both Lambda bundles stay in sync with the shared code.

## Web Super App (`apps/web`)

1. Configure environment variables:
   ```bash
   cd apps/web
   cp .env.example .env.local
   # fill in VITE_API_URL, VITE_REGION, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID
   ```
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
3. Modules live in `src/modules/registry.ts`. Each entry controls:
   - the marketing copy that shows up on the module hub
   - the base route (e.g., `/group-expenses`)
   - the maturity badge + tags rendered in the UI

The existing `TripListPage`/`TripDetailPage` screens are mounted under `/group-expenses/*`, so additional tools can plug in without conflicting routes.

## Flutter Mobile Super App (`apps/mobile`)

The Flutter project mirrors the module orchestration pattern from the web shell.

1. Install dependencies and run tests:
   ```bash
   cd apps/mobile
   flutter pub get
   flutter test
   ```
2. Run on a simulator or device, pointing at the shared backend:
   ```bash
   flutter run \
     --dart-define=API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com \
     --dart-define=AWS_REGION=us-east-1 \
     --dart-define=USER_POOL_ID=us-east-1_XXXXXXXXX \
     --dart-define=USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXX
   ```
3. Module metadata lives in `lib/modules/module_registry.dart`. Each entry defines:
   - icon + descriptive copy
   - maturity badge + tags
   - the screen builder to push onto the stack

The `GroupExpensesScreen` currently surfaces configuration and next steps for wiring Cognito + API calls. It reads from `lib/app_config.dart`, so CI/CD can inject real values with `--dart-define`.

## Adding New Tools

1. **Backend**
   - Add routes/handlers inside `services/api`.
   - Reuse shared lib utilities or create a module folder under `services/api/src`.
   - Deploy via CDK; no new infrastructure stacks required unless the module needs extra AWS services.
2. **Web**
   - Create module-specific routes/components under `apps/web/src/modules/<module-name>/`.
   - Register the module in `src/modules/registry.ts`.
   - Hook into shared hooks/services (React Query, Amplify Auth already set up).
3. **Mobile**
   - Drop a new screen under `apps/mobile/lib/modules/<module-name>/`.
   - Register it in `lib/modules/module_registry.dart`.
   - Pull auth/session details from `AppConfig` just like the Group Expenses module.

Because both shells now have a module directory and navigation hub, adding new tools is mostly a matter of wiring UI + API code—no more repo shuffling.

## Next Steps

- Wire Cognito/AWS Amplify auth flows into the Flutter shell.
- Move shared domain logic (currency helpers, balance calculations) into a future `packages/` workspace for cross-platform reuse.
- Add module-specific CI jobs (lint + tests) for both shells.
- Extend the CDK stack with notifications/webhooks when Textract jobs finish.

See `docs/architecture.md` for a deeper dive into data modeling and the AWS topology powering every module.
