# Phase Two Roadmap

## Status

- Stage: Deferred requirements captured during phase-one discovery
- Last updated: 2026-08-04

## Purpose

Preserve features intentionally postponed from the first release of the Persian gold-products mobile web application. These items require a separate discovery and specification pass before implementation.

## Deferred features

### Live gold and silver prices

- Select and integrate a reliable market-price provider suitable for Iran.
- Replace phase-one hardcoded header values with automatically refreshed prices.
- Define update frequency, caching, stale-price behavior, provider failure fallback, timestamps, and administrative visibility.
- Display prices in Persian and تومان.
- Keep the backend authoritative; do not calculate authoritative prices only in the browser.

### Dynamic product pricing

- Define formulas based on metal type, purity, weight, current market price, workmanship, seller margin, discount, tax, and other applicable charges.
- Define rounding and تومان conversion rules.
- Preserve product-level manual price overrides with an explicit reason, author, start time, and optional expiration.
- Store the pricing inputs and result used when a customer submits an order so later market changes do not silently alter the request.
- Test stale prices, concurrent updates, invalid inputs, and provider outages.

### Product variants

- Support selectable variations such as ring size, weight, color, purity, material, or other category-specific attributes.
- Give each sellable variant its own identifier, availability, images, price adjustment, and inventory when required.
- Prevent customers from requesting invalid or unavailable combinations.
- Define how variants appear in search, product cards, product details, requests, and the admin panel.

### In-app customer and admin messaging

- Add a conversation thread to each purchase request.
- Preserve complete message history with sender, timestamp, and read state.
- Define text limits, moderation, attachments, notification behavior, retention, and administrative access.
- Authorize customers to access only conversations belonging to their own requests.
- Decide whether updates use real-time delivery, polling, or push notifications.
- Keep request status changes and official payment instructions distinct from informal chat messages.

### Notifications

- Add an in-app notification center and unread badges for new purchase requests and request-status changes.
- Define whether later releases also require SMS, push, email, WhatsApp, or Telegram notifications.
- Define delivery, retry, deduplication, read state, retention, notification preferences, and deep links.
- Avoid exposing sensitive order or customer information in notification previews.

### Product ratings and reviews

- Allow verified customers to rate and review eligible purchased products.
- Define purchase-verification, rating scale, text and media limits, editing, deletion, moderation, reporting, and merchant replies.
- Show rating count and distribution without misleading customers.
- Prevent duplicate, abusive, fabricated, or unauthorized reviews.
- Define review publication status, audit history, and admin moderation workflow.

### Production OTP and account recovery

- Select and integrate an Iranian SMS provider for unique, short-lived OTP delivery.
- Replace the shared MVP code with securely generated, hashed, expiring, single-use codes.
- Add resend cooldowns, attempt limits, rate limiting, delivery observability, and abuse protection.
- Add a secure forgot-password flow using verified phone ownership.
- Invalidate relevant sessions after password recovery and record safe security audit events.
- Keep the phase-one demo OTP impossible to enable accidentally in production.

### Tax configuration

- Define applicable Iranian tax rules with qualified business and legal input.
- Add configurable tax rates, effective dates, exemptions, calculation order, rounding, and historical snapshots.
- Show tax clearly before customer commitment.

### Online payment

- Select the payment provider and define its secure redirect or tokenized flow.
- Add payment initiation, confirmation, failure, expiration, cancellation, reconciliation, and refund states.
- Verify provider callbacks or webhooks and process them idempotently.
- Never treat a frontend redirect as proof of payment and never store raw card data.

### Shipping and fulfillment

- Define supported regions, address format, delivery methods, pricing, estimated delivery, insurance, tracking, pickup, and restricted items.
- Add shipment states and customer/admin visibility.
- Define cancellation, failed delivery, return, and damage handling.

## Decisions still required

- Gold and silver price provider
- Exact pricing formula by product category
- Supported purities and units
- Variant model by category
- Messaging delivery and notification approach
- Notification channels and customer preferences
- Review eligibility and moderation policy
- SMS provider and production OTP policy
- Tax requirements
- Payment provider
- Shipping providers, regions, and rules
- Whether manual card-to-card payment remains available after online payment launches

## Phase-one compatibility requirements

- Keep hardcoded metal prices behind a replaceable configuration boundary.
- Store fixed product prices in تومان.
- Model products so variants can be added later without breaking existing product identifiers or requests.
- Preserve price snapshots on customer requests.
- Avoid embedding tax, payment, shipping, or pricing rules directly in UI components.
