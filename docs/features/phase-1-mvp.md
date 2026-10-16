# Sheri Gold Phase-One MVP

## Status

- Product: Sheri Gold mobile web application
- Market: Iran
- Language and direction: Persian, RTL
- Currency: تومان
- Stage: Interview-complete draft for UI review
- Last updated: 2026-08-04

## Business outcome

Create a private demo/MVP where visitors discover gold products, registered customers save favorites and submit multi-product purchase requests, and one administrator manages the catalog and follows requests through WhatsApp or Telegram. The MVP validates the customer journey and operating workflow without online payment, shipping, live metal-price integration, or production SMS.

## Experience constraints

- Render the customer and admin applications as a fixed mobile-width interface, including on desktop.
- Center the mobile application on a subtle surrounding background at larger browser widths; do not expand into a desktop dashboard.
- Use Persian UI copy, RTL layout, Persian digits, تومان formatting, and Jalali dates.
- Accept Persian and English digits in phone inputs and normalize them internally.
- Use a light, easy-to-shop, premium visual direction: warm ivory surfaces, deep teal structure, restrained gold accents, charcoal text, generous spacing, and strong product imagery.
- Use the approved Sheri Gold phase-one brand image from `assets/brand/sheri-gold-brand-concept.png`.
- Deliver a normal web application, not a PWA; exclude service workers, installation prompts, and offline mode.

## Actors

### Guest

- Browse published products and categories.
- Search, filter, sort, and view product details.
- Start a favorite, cart, purchase-request, or supply-request action, then authenticate and return to that intended action.

### Customer

- Maintain a favorites list.
- Maintain a multi-product cart with each product present at most once.
- Submit purchase requests for available products.
- Submit supply requests for unavailable products.
- View and cancel eligible requests.
- Continue communication through configured WhatsApp or Telegram accounts.
- Edit full name and password; the phone number remains fixed in phase one.

### Administrator

- Use the shared login page and be redirected by role to the admin application.
- Manage products, product galleries, categories, availability, fixed prices, and publication state.
- Manage purchase and supply request statuses.
- View customer identity required for request follow-up.
- Configure WhatsApp and Telegram destinations.
- View a compact mobile dashboard.
- The MVP supports one administrator only.

## Authentication

### Customer registration

1. Enter full name, Iranian phone number, and password.
2. Verify the phone using the shared demo OTP `123456`.
3. Create the customer account and authenticated session.

### Login

- Use phone number and password for customers and the administrator.
- Redirect customers to the customer application and the administrator to the admin panel based on the backend-authoritative role.
- Keep the administrator account out of public registration and create it through safe configuration or a database seed.
- Hash passwords using an appropriate adaptive algorithm.
- Validate unique phone numbers.
- Apply rate limiting to registration, OTP verification, and login even in the demo.

### MVP safeguards

- Permit the shared OTP only in explicit demo/development configuration.
- Refuse to start a production environment while the shared OTP mode is enabled.
- Do not include forgot-password behavior in phase one.

## Customer information architecture

Use a four-item bottom navigation:

```text
خانه | دسته‌بندی‌ها | درخواست‌های من | حساب کاربری
```

Make favorites accessible from the account area and from heart controls on product cards and product pages. Make the cart accessible from the header with a current item count.

### Homepage hierarchy

1. Compact Sheri Gold header with cart access.
2. Hardcoded demo market-price strip for `طلای ۱۸ عیار — قیمت هر گرم` and `نقره ۹۹۹ — قیمت هر گرم` in تومان, visibly labeled `نمونه آزمایشی`.
3. Search input at the top of discovery content.
4. Category shortcuts.
5. Filter and sort controls.
6. Products sorted from lowest to highest price by default.
7. Additional products as the user scrolls.

### Search, filters, and sorting

- Search by Persian product name and product code.
- Filter by dynamic category and availability.
- Sort by price low-to-high or high-to-low.
- Use low-to-high as the default.
- Provide a clear applied-filter state, reset behavior, loading state, error recovery, and helpful zero-results state.

## Catalog

### Categories

- Let the administrator create, edit, order, publish, hide, and nest categories.
- Support all gold-product categories rather than a hardcoded category list.
- Seed categories appropriate to melted gold, rings, necklaces, bracelets, earrings, gold bars, coins, sets, pendants, chains, and other general gold products.
- Archive categories referenced by historical requests instead of destroying required history.

### Product fields

- Persian name
- Unique product code
- Category
- Short description
- Full description
- Fixed price in تومان
- Weight when applicable
- Gold purity when applicable
- Availability: `موجود` or `ناموجود`
- Publication state
- Primary image and multiple ordered gallery images
- Created and updated timestamps

### Product cards

- Primary image
- Product name
- Category
- Weight and purity when present
- Fixed price in تومان
- Availability
- Favorite control
- Product-details action

### Product details

- Provide a swipeable gallery, full-screen viewing, and zoom.
- Show all decision-critical product information and fixed price.
- For available products, provide an add-to-cart action.
- For unavailable products, provide `درخواست تأمین محصول` instead of add to cart.
- Treat each physical variation as a separate product in phase one; product variants are deferred.

### Product lifecycle

- Let the administrator create, edit, publish, hide, and archive products.
- Do not permanently delete products referenced by a request.
- Preserve product name, code, image reference, and price snapshots in submitted requests.
- Seed ۳۰ Persian demo products across the supported categories, using multiple images and a mix of available and unavailable states.

## Favorites

- Require authentication to persist favorites.
- Allow add/remove from product cards and details.
- Show a dedicated list from the account area.
- If a guest starts the action, return to it after authentication.

## Cart

- Allow multiple distinct products.
- Allow each product at most once; exclude quantity controls.
- Allow removal and navigation back to product details.
- Show item prices and total in تومان with Persian digits.
- Refresh prices from the backend when the cart opens and before request submission.
- If an administrator changes a price, present the latest price and total before confirmation.
- Block normal request submission while an unavailable product remains in the cart; explain the issue and offer removal or a separate supply request.
- Do not trust browser totals; recalculate authoritative values on the backend.

## Purchase requests

### Creation

1. Customer reviews a cart containing only available products.
2. Backend rechecks publication, availability, and current fixed prices.
3. Backend creates one request and immutable item snapshots.
4. Customer sees the request confirmation and external contact actions.

Prevent duplicate requests from repeated submission with an idempotency mechanism.

### Statuses

```text
جدید
در حال پیگیری
توافق‌شده
تکمیل‌شده
لغوشده
```

- Let customers cancel requests only while `جدید` or `در حال پیگیری`.
- Record status history, timestamp, and actor.
- Let customers access only their own requests.
- Do not provide internal chat, payment receipt upload, notifications, online payment, or shipping in phase one.

## Supply requests

- Keep unavailable products visible.
- Replace normal purchase behavior with `درخواست تأمین محصول`.
- Save supply requests separately from purchase requests.
- Include product snapshot and customer identity.
- Allow the customer to continue through WhatsApp or Telegram.
- Let customers cancel while `جدید` or `در حال بررسی`.

Use statuses:

```text
جدید
در حال بررسی
قابل تأمین
غیرقابل تأمین
لغوشده
```

## WhatsApp and Telegram handoff

- Show both contact actions after successful purchase-request or supply-request creation.
- Open a prepared Persian message containing request number, request type, product names and codes, displayed prices when applicable, and customer phone number.
- Keep contact destinations in backend-managed application configuration rather than UI code.
- Do not build internal messaging in phase one.

## Admin application

Keep the admin UI fixed to the same mobile-width principle.

### Dashboard

- New purchase-request count
- Requests under follow-up
- Completed requests
- Published products
- Unavailable products
- Quick actions for adding a product and reviewing requests

### Management areas

- Products and ordered image galleries
- Dynamic categories
- Purchase requests and status history
- Supply requests and status history
- Customer lookup needed for support
- WhatsApp and Telegram contact settings

Static informational pages are not editable by the administrator.

## Static Persian pages

- درباره ما
- تماس با ما
- قوانین و شرایط استفاده
- حریم خصوصی

Write real approved business copy before any public release. Do not invent legal or privacy claims.

## Market-price placeholders

- Store hardcoded gold and silver demo values behind a replaceable server-side configuration boundary.
- Mark them as demo values in the UI and show a last-updated label.
- Do not connect an external provider or calculate dynamic product prices in phase one.
- Do not embed placeholder values throughout components or product records.

## Data ownership and consistency

- Backend owns identity, role, catalog publication, availability, fixed prices, request state, and request snapshots.
- PostgreSQL owns durable accounts, sessions as applicable, categories, products, images, favorites, carts, requests, request items, status history, and configuration.
- React Query owns remote browser state and refreshes catalog, cart, favorites, and requests after relevant mutations.
- Local component state owns transient UI only.
- Do not place server state in Zustand. Use Zustand only if a real cross-component client-only need appears.

## Error and empty states

Cover invalid login, invalid demo OTP, duplicate phone, expired session, missing product, archived product, changed price, unavailable cart item, duplicate submission, failed request creation, empty favorites, empty cart, empty request list, zero search results, image failure, and external-app handoff failure.

Return safe Persian messages backed by stable machine-readable API error codes. Never expose database errors or stack traces.

## Accessibility

- Use semantic RTL markup, logical headings, visible focus, keyboard support, and correctly labeled controls.
- Keep touch targets comfortable for mobile use.
- Provide meaningful alternative text for product images and ignore decorative brand detail appropriately.
- Announce form errors, cart changes, request confirmation, and status information when required.
- Maintain readable contrast between teal, gold, ivory, and text colors.
- Support text resizing without clipping within the fixed mobile shell.

## Admin and API security

- Enforce roles and resource ownership in the backend.
- Never rely on redirects or hidden buttons for authorization.
- Limit image size and allowed content; use server-controlled object names.
- Avoid logging passwords, OTPs, sessions, or unnecessary personal information.
- Centralize safe error handling and request IDs.
- Preserve request history and audit administrator status changes.

## Out of scope

The tracked phase-two roadmap contains live metal-price APIs, dynamic pricing formulas, variants, tax, online payment, shipping, internal messaging, notifications, ratings and reviews, production SMS OTP, and secure password recovery. See `docs/features/phase-2-roadmap.md`.

## Acceptance tests

- [ ] Guest can search, filter, sort, and inspect products without an account.
- [ ] Guest returns to favorite/cart/request intent after successful authentication.
- [ ] Customer registers with full name, phone, password, and demo OTP `123456`.
- [ ] Shared login redirects customer and admin by backend role.
- [ ] Thirty Persian demo products cover multiple categories and states.
- [ ] Multiple product images retain admin-defined order.
- [ ] Favorites persist per customer.
- [ ] Cart contains several distinct products but never duplicate quantities.
- [ ] Cart displays current backend prices before submission.
- [ ] Unavailable cart items block normal purchase requests.
- [ ] Submitted requests preserve immutable item and price snapshots.
- [ ] Duplicate submission does not create duplicate requests.
- [ ] Customer can view only their requests and cancel only eligible states.
- [ ] Unavailable product creates a separate supply request.
- [ ] WhatsApp and Telegram open with prepared request details.
- [ ] Admin manages catalog, categories, requests, availability, prices, galleries, and contact settings on mobile width.
- [ ] Persian digits, تومان, RTL, and Jalali dates render consistently.
- [ ] Fixed mobile shell remains usable on narrow phones and centered on desktop.
- [ ] Critical keyboard, focus, validation, empty, loading, error, and recovery states work.

## Unresolved configuration

- Exact hardcoded demo values and last-updated timestamp for 18-karat gold and silver 999
- WhatsApp phone number
- Telegram account or bot destination
- Seeded administrator phone and initial password delivery mechanism
- Approved Persian copy for static informational pages
- Final production font licensing and hosting choice

## Remaining risks

- The shared OTP is intentionally insecure and limits this release to private demonstration.
- Hardcoded metal prices may be mistaken for live values unless the demo label is prominent.
- External WhatsApp and Telegram URL behavior must be verified on supported mobile browsers.
- Fixed-price changes between browsing and submission require clear customer confirmation.
