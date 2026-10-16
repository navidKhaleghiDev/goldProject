# Account dashboard enhancement

## Scope and ownership

The authenticated customer dashboard shows the current catalog buy price, cash and gold wallet balances, holdings by purity, recent orders, and buy/sell navigation. The frontend presents existing API data. The API remains authoritative for identity, prices, balances, orders, and trade permissions.

## Data contract

- `GET /auth/me` supplies the existing session user. The shared `SessionUser` type now accepts an optional `avatarUrl`; the current API need not return it. Initials appear when it is absent or fails to load.
- `GET /platform/gold-assets` supplies asset names, purities, buy/sell prices, and `isDemo`. Header and dashboard share the React Query key `['platform', 'assets']` and refresh every 15 seconds.
- `GET /platform/wallets` supplies cash and gold balances. The dashboard groups positive available gold weight by purity. Estimated sale value uses each asset's current sell price and remains unavailable when a holding has no price.
- `GET /platform/orders` supplies recent activity. These existing endpoints and their authentication rules were not changed.
- Historical prices are not provided. The trend section states this explicitly and displays no invented market chart.

## Access and states

`MobileShell` uses the existing `/auth/me` query for private views. A 401 redirects to `/login?next=<path>`, and successful OTP verification returns to a safe local path. Other session failures show a retry action. The login, register, and public catalog routes retain their existing behavior. Client routing is a UX boundary; private API endpoints must continue to enforce session ownership and authorization.

The header and dashboard provide loading, error, and unavailable states. The bottom navigation stays fixed; existing page padding and safe-area padding keep scroll content clear. No database migration or new endpoint is required.
