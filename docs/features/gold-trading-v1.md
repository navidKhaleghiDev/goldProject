# Gold trading v1

Historical single-purity phase. The multi-purity implementation is documented in [gold-platform-v1.md](gold-platform-v1.md). After migration 003, this phase's write routes return HTTP 410, its history remains readable, and OTP is the default sign-in path.

Source: Gold_PRD_v1.pdf, 15 September 2026. This supersedes the storefront phase-one journey. Existing catalog routes remain available.

## Scope and ownership

Single jeweller; customers register, await trust approval, buy by weight, upload a receipt, view available/frozen gold, sell holdings, and follow transaction history. Administrators approve customers and review transactions. Express/PostgreSQL own identity, prices, locks, balances and transitions. Browser state is never financial authority. Physical delivery and notifications are P1 and excluded from this P0 implementation.

## Flow and states

- Buy: quantity -> quote (60-second default) -> accept -> awaiting_payment -> payment_submitted -> admin_review -> completed/rejected.
- Sell: quantity -> quote -> accept before expiry -> atomic freeze -> admin_review -> completed/rejected. Completion requires offline settlement acknowledgement; rejection requires a reason and releases the freeze.
- A buy's payment deadline is the original quote expiry. Late receipts are accepted with an explicit late-payment flag for manual reconciliation; they cannot credit holdings automatically. Rejected payments remain in history for offline refund handling.
- Revoked/pending customers cannot create quotes or transactions; they retain access to their own history and receipt submission for existing purchases.

## Configuration assumptions

Defaults are provisional: 60-second lock, 0.001–100 grams, milligram precision, no additional fee. Provider returns separate buy/sell rates in toman per gram (spread included), `updatedAt`, and `purity`. No invented live price. Demo prices only with explicit TRADING_DEMO_ENABLED outside production. Production requires a provider URL and actual payment instructions. Customer approval is the MVP trust check, not identity verification. One purity/unit applies to all holdings and must be configured consistently before use.

## Contracts and persistence

Cookie session; origin-checked mutations; rate-limited authentication/trading. `/api/auth/{register,login,logout,me}`. `/api/trading/{rates,wallet,quotes,transactions}`, receipt and review subresources, `/api/trading/customers` and customer trust update. Lists use bounded pagination. UUID idempotency keys on quotes; a quote creates at most one transaction. A mismatching replay conflicts. Receipt retry uses a content digest; decisions are terminal and safe to replay only with the same payload.

Migration 002 adds trust state, wallets, immutable quotes, trades, status events and balance ledger. Quantities are integer milligrams, currency integer toman, totals rounded upward using BigInt. Atomic wallet updates and row locks prevent double selling; all balance/status/ledger updates commit together. Immutable ledger records preserve available/frozen deltas. Receipts live in a private filesystem directory (not the database or public web root), using server-generated keys and PNG/JPEG signature checks, max 5 MB. Production needs a durable mounted volume and backup/retention policy or an object-storage adapter before deployment.

React Query owns session, rates (10-second poll), wallet, history and admin queues. Successful mutations invalidate affected queries; no optimistic financial updates. Persian RTL UI includes loading, errors/retry, empty balances, pending approval, expiry and rejection states. Countdown is informational; server time enforces expiry.

## Acceptance and rollout

Verify trusted-only trading, cross-customer denial, required receipt/reason/settlement, expiry, insufficient funds, concurrent sells, duplicate acceptance/decisions, freeze release, immutable history and safe receipt access. Apply migrations with `db:migrate`, provision the first administrator with `db:admin`, configure prices/payment details, then run API and web. Credentials are never embedded in the UI.

Unresolved product decisions: final provider/spread/purity, limits, expiry and paid-after-expiry policy, refund operations, KYC, physical custody reconciliation. The implemented late-payment policy is conservative manual review and must be approved for launch.

## Running and configuring

1. Copy `.env.example` to `.env`, set a random `SESSION_SECRET`, choose unique administrator credentials, and point `DATABASE_URL` at a UTF-8 PostgreSQL database.
2. Run `npm run db:migrate -w @sheri-gold/api`. Migrations are tracked and safe to rerun; the original untracked completed migration is adopted.
3. Run `npm run db:admin -w @sheri-gold/api`. This creates the first administrator without promoting or overwriting an existing account.
4. Run `npm run dev:api` and `npm run dev:web`. Register a customer, sign in as administrator, approve trust, then complete a demo purchase and sale.
5. `RECEIPT_DIRECTORY` resolves relative to the API process working directory. Keep it private and persist/backup it with the database.

For a real price adapter, set `TRADING_DEMO_ENABLED=false` and `GOLD_PRICE_API_URL`. The endpoint must return JSON:

```json
{
  "buyTomanPerGram": 7240000,
  "sellTomanPerGram": 7200000,
  "purity": "18k",
  "updatedAt": "2026-09-18T10:00:00.000Z"
}
```

Values above illustrate the contract only. Timestamps older than 30 seconds, future timestamps beyond 5 seconds, a mismatched purity, or invalid spread block quotes. Provider authentication and vendor-specific response mapping belong in that adapter. No selected live provider is bundled. Additional fees are zero in this implementation; buy/sell spread is already represented by provider rates. Configure actual `PAYMENT_INSTRUCTIONS` before live use.

The database records its demo/live mode and purity on first use. Switching settings against existing holdings fails closed; use a separate database for live balances. Never migrate fictitious demo balances into a live ledger.

## Verification

- `npm run typecheck`, `npm run lint`, and `npm run build`.
- Unit tests run with `npm test`. Integration tests require `TEST_DATABASE_URL` pointing to an isolated UTF-8 PostgreSQL database whose name ends in `_test`. They create a unique schema and remove only that schema afterward; uploaded fixtures stay in ignored `tmp/`.
- Verified 22 tests, including real PostgreSQL concurrency, rollback, duplicate decisions, late receipt handling, private receipt access, trust approval and failed/stale price providers.
- Browser runtime reported no available browsers. Responsive, visual, and keyboard validation still require a browser session. The production build renders all application routes successfully.
- Local ESLint configuration was updated to Next 16 native flat configs because the previous compatibility config crashed and referenced an uninstalled Prettier plugin. Formatting remains handled by the existing Prettier CLI.
- Migration runner was exercised on an empty UTF-8 test database and rerun successfully. No existing application database was modified. Configure `DEMO_OTP_ENABLED=false` as well as `TRADING_DEMO_ENABLED=false` for production.
