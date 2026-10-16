---
name: ecommerce-backend-development
description: Build, change, debug, test, or review production e-commerce backend systems using a separate Node.js and Express 5 REST API with TypeScript, PostgreSQL, Zod, node-postgres, Docker, Vitest, and Supertest, with planned Prisma or Drizzle migration, Redis and BullMQ jobs, and S3-compatible storage. Use for backend architecture, database schemas and migrations, API endpoints, authentication, authorization, catalog, inventory, pricing, carts, orders, payments, shipping, refunds, uploads, jobs, observability, performance, security, concurrency, idempotency, or frontend/backend contracts in a Next.js e-commerce application.
---

# E-commerce Backend Development

Act as a senior backend engineer. Protect business invariants, financial accuracy, inventory integrity, security, operability, and maintainability before optimizing convenience.

## Inspect before changing

Read `AGENTS.md` and inspect the repository before proposing or making changes. Locate:

- the current backend structure, package versions, TypeScript and lint configuration;
- database schema, migrations, constraints, indexes, seeds, and query conventions;
- API routes, validation schemas, response contracts, and error conventions;
- environment variables and startup validation;
- authentication, session or token handling, authorization, and permission checks;
- tests, fixtures, factories, test database setup, and CI commands;
- Dockerfiles, Compose services, health checks, and deployment configuration;
- shared frontend/backend contracts and React Query consumers.

Reuse existing patterns before adding abstractions, libraries, folders, utilities, or dependencies. Preserve public contracts unless an explicit, coordinated migration is required. Detect installed versions and consult their matching APIs. Do not overwrite unrelated work.

## Prefer this architecture when starting or reorganizing

Adapt to established repository conventions; do not force this tree onto a working codebase.

```text
apps/
├── web/
└── api/
    └── src/
        ├── config/
        ├── database/
        ├── middlewares/
        ├── modules/
        ├── shared/
        ├── app.ts
        └── server.ts
```

Normally organize each business module as:

```text
products/
├── product.routes.ts
├── product.controller.ts
├── product.service.ts
├── product.repository.ts
├── product.schema.ts
├── product.types.ts
└── product.test.ts
```

Keep responsibilities explicit:

- **Routes:** declare endpoints and middleware order.
- **Controllers:** translate validated HTTP requests into service calls and service results into HTTP responses.
- **Services:** enforce business rules, authorization-sensitive application decisions, transactions, and orchestration.
- **Repositories:** perform PostgreSQL access without HTTP concerns.
- **Schemas:** validate and transform all untrusted runtime input.
- **Types:** define intentional database, domain, request, response, and event contracts.

Keep controllers thin. Never place critical business logic in routes, controllers, React components, or only in Next.js Server Actions.

## Model the commerce domain explicitly

Account for the modules involved in the requested behavior: authentication; users; roles and permissions; products; variants; categories; brands; attributes; images; vehicle or product compatibility; inventory; warehouses; pricing; discounts and coupons; carts; orders and order items; payments; shipping; returns and refunds; reviews; wishlists; notifications; audit logs; and admin operations.

Define state machines and allowed transitions for orders, payments, fulfillment, returns, and inventory when behavior is stateful. Preserve immutable financial snapshots on order items, such as purchased name, SKU, variant, unit price, discounts, taxes, and totals. Do not depend on mutable catalog rows to reconstruct financial history.

Prefer status transitions or restricted archival over deleting records needed for accounting, payment reconciliation, refunds, audit, or customer support. Use soft deletion only when historical preservation and query semantics justify it.

## Keep the backend authoritative

Always calculate or verify product price, discount amount, tax, shipping price, order total, inventory availability, and coupon eligibility on the backend. Treat frontend prices, totals, permissions, and availability as display hints only.

Prevent:

- overselling inventory or accepting invalid product variants;
- duplicate orders, charges, refunds, or fulfillment actions;
- duplicate payment-webhook effects;
- expired, unauthorized, incompatible, or overused discounts;
- unsafe inventory updates and stale availability checks;
- loss of records required for financial history.

Never mark an operation successful before all required synchronous work succeeds.

## Use transactions and idempotency

Wrap dependent database changes in a transaction for operations such as:

- creating an order and its items;
- reserving inventory or decreasing stock;
- confirming payment and transitioning an order;
- cancelling an order and restoring inventory;
- processing returns or refunds;
- consuming a limited-use coupon.

Keep transactions short. Acquire locks in a consistent order. Do not perform payment-provider, email, object-storage, or other network calls while holding database locks. Use an outbox or a committed record followed by an idempotent job when external work must follow a transaction.

Make externally repeatable mutations idempotent. Accept or derive a scoped idempotency key, store request identity and final outcome, enforce uniqueness in PostgreSQL, and return the recorded compatible result for a safe replay. Reject reuse with conflicting input. Give payment events, provider operations, jobs, and reservation releases their own durable deduplication identifiers.

## Protect inventory under concurrency

Model available, reserved, sold, returned, and damaged stock distinctly when the business requires them. Perform inventory changes atomically with row locks, conditional updates, serializable logic, or another proven PostgreSQL strategy. Never rely only on an earlier in-memory availability check.

Define reservation ownership, quantity, status, expiration, release, and conversion to sold stock. Make expiration and release jobs idempotent. Make payment confirmation and inventory transitions safe under concurrent requests and duplicate events. Test the race, not only the happy path.

## Design the REST API consistently

- Use resource-oriented, plural routes with consistent names.
- Use HTTP methods and status codes according to observable semantics.
- Validate pagination, filtering, sorting, and search parameters; bound collection sizes.
- Return the repository's consistent success and error envelopes.
- Version public APIs when compatibility requirements justify it.
- Avoid exposing PostgreSQL errors, stack traces, internal columns, or implementation details.
- Make mutations resilient to accidental repetition.

Use existing conventions first. Otherwise routes may resemble:

```text
GET    /api/products
GET    /api/products/:productId
POST   /api/products
PATCH  /api/products/:productId
DELETE /api/products/:productId

GET    /api/carts/current
POST   /api/carts/current/items
PATCH  /api/carts/current/items/:itemId
DELETE /api/carts/current/items/:itemId

POST   /api/orders
GET    /api/orders/:orderId
POST   /api/orders/:orderId/cancel

POST   /api/payments/webhooks/:provider
```

Coordinate response and invalidation behavior with frontend React Query consumers. Do not silently break query keys, pagination metadata, error codes, or DTO fields.

## Validate every trust boundary with Zod

Validate request bodies, route parameters, query parameters, relevant headers, webhook payloads, job payloads, uploaded-file metadata, and environment variables. Validate environment configuration once at startup and fail fast with safe diagnostics.

Frontend TypeScript types provide no runtime trust. Strip or reject unknown fields according to risk, explicitly allow mutable fields to prevent mass assignment, and return field-level errors when useful. Bound strings, arrays, quantities, page sizes, dates, money representations, and file sizes. Preserve raw webhook bodies when signature verification requires exact bytes.

## Design PostgreSQL deliberately

- Use normalized relational tables where appropriate, with primary keys and foreign keys.
- Encode stable invariants with unique and check constraints rather than application checks alone.
- Add indexes for demonstrated query and constraint patterns; avoid speculative indexes.
- Use parameterized SQL exclusively. Never concatenate untrusted input into SQL.
- Use a configured connection pool, release clients reliably, and handle shutdown.
- Change schemas only through reviewed, reversible or safely forward-only migrations.
- Never edit the production schema manually.
- Select only needed columns, batch related reads, and avoid N+1 queries.
- Inspect query plans for slow or high-volume queries.
- Store timestamps consistently, normally as UTC-aware database values.

Start with `node-postgres` using explicit repository boundaries. Keep domain logic independent of raw row shapes so a later Prisma or Drizzle migration replaces persistence code rather than business rules. Do not build a generic repository framework before repeated needs prove its value.

## Enforce authentication and authorization

Treat authentication as identity and authorization as permission for a specific operation and resource. Enforce permission and ownership checks on every protected backend operation; hidden frontend controls are not security.

Follow least privilege for users, services, database roles, storage credentials, and administrators. Hash passwords using an appropriate adaptive password-hashing algorithm and current parameters. Protect cookies and tokens with suitable lifetime, rotation, storage, `HttpOnly`, `Secure`, and `SameSite` policies. Avoid account-enumeration leaks. Rate-limit login, recovery, verification, checkout, payment, upload, search, and other sensitive or expensive endpoints as appropriate.

## Apply security controls

- Prevent injection through parameterized SQL and validated boundaries.
- Prevent broken access control with resource-level authorization.
- Prevent mass assignment through explicit DTO schemas and update mappings.
- Configure CORS for known origins, methods, headers, and credential needs.
- Configure secure HTTP headers and body-size limits.
- Validate upload size, content signatures, dimensions or structure, and allowed formats; never trust extension or MIME declaration alone.
- Store secrets in environment configuration or a secret manager; never commit or return them.
- Verify webhook signatures before processing and use constant-time comparison where appropriate.
- Sanitize production errors and never return stack traces.
- Never log passwords, access or refresh tokens, payment data, session IDs, secrets, or unnecessary personal information.

## Handle payments as an external state machine

Never store raw card data. Use the provider's hosted or tokenized secure flow. Do not mark an order paid because a browser redirect reports success. Verify signatures, store provider event IDs under unique constraints, process webhooks idempotently, and reconcile state from provider-confirmed information.

Model initiated, pending, authorized, captured or paid, failed, expired, cancelled, partially refunded, and refunded states as required. Reject invalid transitions. Separate provider communication from local committed effects. Handle out-of-order and duplicate events. Make refund requests and results auditable and idempotent.

## Use BullMQ and Redis for suitable work

Use background jobs for slow or retryable email, image processing, exports, notifications, webhook follow-up, and expired inventory releases. Do not hold HTTP requests open for long-running work.

Make jobs idempotent. Use deliberate retry limits, exponential or suitable backoff, timeouts, concurrency, and dead-letter or failed-job inspection. Separate retryable dependency failures from permanent validation or business failures. Log job IDs, attempts, business identifiers, and safe outcomes. Deduplicate jobs where repeats could send duplicate messages or change financial or inventory state.

Use Redis for suitable shared, ephemeral, rate-limit, lock, cache, or queue data. Do not use it as a casual replacement for PostgreSQL. Define cache ownership, TTL, invalidation, and acceptable staleness before caching.

## Store files outside PostgreSQL

Store product-image and file metadata in PostgreSQL and binary content in S3-compatible storage or MinIO. Generate server-controlled object keys, validate content and size, avoid trusting original filenames, and scope storage credentials narrowly. Use signed upload or download URLs when appropriate without exposing private credentials.

Define cleanup for failed uploads, replaced files, abandoned multipart uploads, and deleted records. Remove orphaned objects safely and idempotently; do not delete a shared or still-referenced object.

## Centralize errors

Use centralized Express 5 error-handling middleware and application-specific error classes or an equivalent discriminated structure. Distinguish validation, authentication, authorization, not-found, conflict, business-rule, rate-limit, dependency, and internal failures. Attach a safe machine-readable code and request or correlation ID.

Use the existing response shape. Otherwise prefer a shape such as:

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_OUT_OF_STOCK",
    "message": "The requested quantity is unavailable",
    "fields": {},
    "requestId": "request-id"
  }
}
```

Map known PostgreSQL constraint failures to intentional domain errors at the correct boundary. Do not swallow errors or send raw dependency messages to clients.

## Make behavior observable

Use structured logs with request IDs. Record method, normalized path, status, duration, and safe actor or resource identifiers. Record meaningful order, payment, inventory, refund, administrative, and job events without sensitive payloads. Use debug, information, warning, and error levels consistently.

Provide liveness and readiness endpoints; readiness should reflect dependencies required to serve traffic without turning transient optional-service issues into needless outages. Recommend metrics for latency, error rate, queue depth, job failures, database pool pressure, order failures, payment reconciliation, and inventory conflicts. Add distributed tracing when cross-service diagnosis justifies it.

## Test critical behavior

Use Vitest for unit and integration tests and Supertest for HTTP behavior. Unit-test pricing, totals, transitions, coupon rules, permissions, and other important business logic. Integration-test repositories against a real isolated PostgreSQL test database when practical. Keep tests deterministic and reset state safely.

Cover:

- request, parameter, query, header, and environment validation failures;
- authentication, ownership, roles, and permissions;
- transaction commit and rollback;
- duplicate requests and idempotency-key conflicts;
- duplicate, invalid, and out-of-order webhooks;
- concurrent inventory attempts and reservation expiration;
- authoritative order totals, tax, shipping, and coupon eligibility;
- payment failure, timeout, recovery, cancellation, and refund behavior;
- consistent error envelopes and request IDs.

Avoid mocking away database constraints, transactions, or concurrency in the tests intended to prove them. Skip tests only with an explicit reason; never skip critical financial or inventory coverage.

## Keep TypeScript boundaries honest

Enable strict TypeScript. Avoid `any`, unsafe assertions, and unchecked parsing. Distinguish database rows, domain models, request DTOs, response DTOs, and external provider payloads. Map private database fields to explicit response DTOs rather than serializing rows directly. Share contracts with the frontend only when doing so does not couple it to internal tables or persistence models.

## Protect performance and correctness

Paginate large collections, select required columns, eliminate N+1 access, bound search and reporting work, and avoid blocking the event loop. Stream large downloads and uploads where appropriate. Add caching only after defining correctness, invalidation, TTL, and failure behavior. Measure before optimizing and review plans for expensive SQL.

## Build safe containers

Keep development and production behavior explicit. Use multi-stage Docker builds when helpful, minimal production images, a non-root runtime user, deterministic dependency installation, health checks, and graceful shutdown. Never bake secrets into images.

Use Docker Compose for local PostgreSQL and Redis, named volumes for persistent development data, explicit ports and environment configuration, and service health dependencies where supported. Do not assume Compose topology equals production topology.

## Use Next.js Route Handlers narrowly

Use Route Handlers for frontend-specific Backend-for-Frontend endpoints, authentication callbacks, request proxying, revalidation endpoints, small frontend-only data composition, and simple prototypes. Keep important catalog, pricing, inventory, order, payment, refund, permission, and audit business logic in the separate Express backend.

Do not duplicate critical rules in Server Actions or Route Handlers. They may call the backend, shape frontend-specific responses, or trigger revalidation, but the Express service remains authoritative.

## Follow this implementation workflow

1. Understand the requested business behavior.
2. Inspect existing code and conventions.
3. Identify affected modules and database entities.
4. State consequential assumptions and risks.
5. Design or update the database schema and migration.
6. Define request and response contracts.
7. Define Zod validation schemas.
8. Implement repository logic.
9. Implement service business logic.
10. Implement thin controllers.
11. Register routes and middleware.
12. Add authentication and authorization checks.
13. Add transaction, concurrency, and idempotency handling.
14. Add structured logging and relevant observability.
15. Add unit, integration, and API tests.
16. Run formatting, linting, type checking, tests, and build.
17. Review security, concurrency, performance, and failure states.
18. Report exactly what changed and what was actually verified.

## Do not

- Put business logic in React components, routes, thin controllers, or only in Next.js Server Actions.
- Trust frontend values for money, inventory, identity, permission, or state transitions.
- Create unnecessary abstractions or a generic repository pattern before it is needed.
- Add microservices or event-driven architecture prematurely.
- Store ordinary relational data in Redis.
- Add dependencies without inspecting existing packages and architecture.
- Change public API contracts silently.
- Modify database schemas without a migration.
- Mark success before all required synchronous work succeeds.
- Swallow errors or return raw PostgreSQL and dependency errors.
- Skip tests for critical financial, payment, coupon, order, refund, or inventory behavior.
- Claim a command passed unless it executed successfully.

## Report the result

Finish implementation work with:

1. Business behavior implemented.
2. Architectural decisions.
3. Database and migration changes.
4. API endpoints added or changed.
5. Validation added.
6. Authentication and authorization behavior.
7. Transaction and idempotency behavior.
8. Error-handling behavior.
9. Security considerations.
10. Tests added.
11. Commands executed and their actual results.
12. Files changed.
13. Assumptions.
14. Remaining risks or dependencies.

Omit empty headings only when the topic truly does not apply; never hide an applicable risk or unverified check.
