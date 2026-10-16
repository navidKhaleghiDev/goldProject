# Multi-purity gold platform MVP

Source: `gold_platform_implementation_spec_v1.docx` supplied by the user. This file records the implemented application contract and launch conditions. The source document describes the desired product; its coding-agent handoff instructions are not repository policy.

## Business behavior

Approved customers can request a 60-second server price lock for a selected gold purity and unit, then create a buy or sell order. Gold is stored as integer milligrams, money as integer toman. Buy totals round up, sell totals round down. Assets have independent gold accounts; a sale credits the cash account, which can fund a later purchase of another purity. There is no direct purity conversion. The administrator manages mock prices, reviews bank receipts and orders, approves withdrawals after recording a payout reference, and approves customer trust through the existing admin screen. Seller inventory remains outside this MVP; order approval means the seller confirms supply.

For buys, customers choose wallet cash, bank transfer, or both. The wallet portion is held, then consumed only after bank receipt approval (if needed) and order approval. A rejected receipt enters a 120-second correction window. New uploads create new receipt rows and preserve rejected records. The correction window and pending-payment deadline expire server-side and release holds. For sells, gold is held under a row lock, then consumed on approval and cash is credited in the same transaction. Rejection releases the gold. Cash withdrawals hold funds until an administrator approves with a payout reference or rejects with a reason.

## Ownership and API

Express owns validation, price snapshots, state transitions, balances, holds, settlement, authorization, and idempotency. PostgreSQL stores durable truth and enforces nonnegative accounts and unique command identities. React Query owns browser server-state caching and invalidation; the browser does not calculate authoritative totals or settle accounts.

New endpoints under `/api/platform`:

- `GET /gold-assets`, `POST /price-locks`, `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/payments`.
- `POST /payments/:id/receipts`, `GET /receipts/:id`; file access requires the owning customer or administrator.
- `GET /wallets`, `GET /wallets/:id/transactions`, `GET/POST /bank-accounts`, `GET/POST /withdrawals`.
- Administrator: `POST /admin/gold-assets`, `GET /admin/orders`, order and payment `approve`/`reject` commands, `GET /admin/withdrawals`, withdrawal `approve`/`reject` commands.

The existing `{success,data}` and `{success:false,error:{code,message,requestId}}` envelopes remain. Commands reject client-supplied prices, totals, balances, identity, and generic status changes. UUID price-lock keys, unique order-per-lock, immutable receipt digests, payment-plan replay checks, withdrawal keys, and terminal decision checks prevent duplicate effects. An idempotency key with different input conflicts. Account rows are locked before balance movements. The ledger records both available and held deltas and can reconcile cached balances with active reservations. The UI invalidates affected platform queries after a successful command and makes no optimistic balance changes.

## Authentication and security

`POST /api/auth/otp/request` and `/otp/verify` use the existing eight-hour signed cookie. The configured fixed code works only with `DEMO_OTP_ENABLED=true` outside production. No OTP appears in an API response or log. Production OTP requests fail closed until a real `SmsProvider` is configured. Password registration and login return HTTP 410 by default; `LEGACY_PASSWORD_AUTH_ENABLED` exists only for explicit nonproduction compatibility checks.

Receipts are validated by PNG/JPEG signature and image dimensions, limited to 5 MB, stored under generated private keys, and never served from a public directory. Customer IBANs are AES-256 encrypted via `pgcrypto` in PostgreSQL; a keyed digest supports duplicate detection. Full IBANs are returned only to the owning customer and administrator payout queue. `BANK_ACCOUNT_ENCRYPTION_KEY` is required in production and must remain stable. Business audit rows record price changes, bank account changes, payment/order/withdrawal decisions and failed approval attempts without storing receipt contents or OTPs.

## Migration and operation

Run `npm run db:migrate -w @sheri-gold/api` before starting the new application. Migration `003_gold_platform.sql` creates assets, units, accounts, immutable ledger, locks, orders, payments, receipts, reservations, withdrawals, bank accounts, OTP challenges, and audit records. It imports settled legacy gold balances as opening ledger entries under the old configured purity. It **refuses to run** while old trades remain unfinished, gold is frozen, or a funded legacy wallet lacks its accounting mode. Resolve those conditions through the old application first. After migration, old `/api/trading` writes return HTTP 410; old history remains readable. The migration has only been applied to an isolated test database in this work.

The API server runs an idempotent expiry scan every 30 seconds; commands also check expiry before changing an order. Configure `PRICE_LOCK_SECONDS` (default 60), `PAYMENT_WINDOW_SECONDS` (default 3600), `RECEIPT_CORRECTION_SECONDS` (default 120), private `RECEIPT_DIRECTORY`, and actual `PAYMENT_INSTRUCTIONS` before live use. Provision an administrator with the existing `db:admin` script, then use OTP for sign-in. Administrators must create or update at least one purity and mock price in the admin UI. If migration imported a legacy purity, use its displayed `legacy_*` code to add the mock price.

## Acceptance and release limits

The isolated PostgreSQL suite verifies OTP, legacy import/cutover, price locks, duplicate commands, bank and mixed buys, receipt correction and expiry, concurrent sells, immutable settlement, withdrawal decisions, authorization, and private receipt access. Frontend type checking and lint pass; browser visual and keyboard checks could not run because no browser connection is available in this environment.

Mock prices and the fixed OTP are development tools only. The live gold pricing adapter and SMS provider are not supplied; production mode fails closed. External bank-transfer verification and payout execution remain manual administrator responsibilities. Receipts need a durable backed-up private volume and a retention policy before deployment. Seller physical inventory and custody reconciliation are excluded by the source specification. New orders do not appear in the legacy `/requests` history; the new dashboard lists them, while `/requests` remains for prior trades.

If an administrator rejects a buy after approving its bank transfer, the approved payment record remains in history and an offline refund or reconciliation is required. A refund API is outside this MVP. Do not launch real-money transfers until that manual procedure, bank destination details, and operational owners are agreed.
