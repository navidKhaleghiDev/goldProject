# Installable web application

The existing Next.js app provides a Persian RTL web manifest, standalone display, branded 192/512 PNG icons, a maskable icon and an Apple touch icon. Installation is available from the account page, including before login. Chromium's install prompt is offered only when available; Safari and other browsers receive manual installation guidance. No push permission is requested.

## Offline and financial correctness

The production-only service worker caches an explicit list of public icons and the self-contained `/offline.html` page. Navigations try the network and fall back to that generic page on network failure. It never caches application HTML, API responses, balances, quotes, receipt images, RSC payloads or mutations. No background sync or persisted transaction queue exists. React Query mutations use `networkMode: always` and no retries; the API interceptor rejects requests while the browser reports offline, preventing queued transactions from running on reconnection. An already open app shows an offline notice; any previously displayed financial data is explicitly identified as potentially stale. Server-side quote expiry remains authoritative.

Updates wait for existing tabs to close, or for the user to choose Update in the account page. The update action is disabled during a mutation and warns that unsaved inputs will be lost. Other tabs are not forcibly reloaded. Bump the worker cache version when changing offline assets. Worker responses disable HTTP caching and allow scope `/`.

## Deployment and verification

- Use `npm run build` followed by `npm run start -w @sheri-gold/web`. The worker intentionally does not register during `next dev`.
- Installation/service workers require HTTPS, except localhost development. Set `NEXT_PUBLIC_API_URL` to the deployed HTTPS API (preferably the same site) before building; the existing localhost API default is only for local development. Preserve credentialed CORS and session-cookie settings for the configured web origin.
- `npm run test -w @sheri-gold/web` exercises offline navigation, network-only sensitive requests, update activation, cache isolation and icon dimensions. These VM tests exercise the actual worker script but do not replace browser installation testing.
- Device acceptance: install from Android Chrome, use Share > Add to Home Screen on iOS Safari, launch standalone, disconnect after a first online visit, reload a private route and verify the generic fallback, reconnect, and test a waiting update with an unfinished form. Confirm no API/receipt/account entries in Cache Storage.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [MDN installation events](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event).

## Verification results

All eight worker/icon tests passed, as did workspace lint, type checks, and the production build. A running production server returned the correct manifest, PNG assets, worker scope/cache headers, standalone metadata, account installation card, and Persian offline page. The browser runtime returned no connected browsers, so actual install prompts, device rendering, and service-worker lifecycle on a device remain unverified.
