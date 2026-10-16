---
name: ecommerce-feature-workflow
description: Coordinate discovery, specification, design, backend, frontend, integration, and verification for end-to-end e-commerce features. Use when a request crosses two or more of customer experience, Next.js frontend, Express backend, PostgreSQL, APIs, inventory, pricing, cart, checkout, orders, payments, shipping, refunds, admin workflows, or shared contracts; also use when planning a complete commerce feature before implementation.
---

# E-commerce Feature Workflow

Coordinate the specialized project skills through one contract-first delivery process. Keep each concern with one owner and prevent frontend, backend, and experience decisions from drifting.

## Load the required skills

Read this skill first, then read each applicable sibling skill completely:

- `../ecommerce-ui-ux/SKILL.md` for journeys, information hierarchy, responsive behavior, accessibility, trust, and conversion.
- `../nextjs-frontend-engineer/SKILL.md` for Next.js, React, TypeScript, shadcn/ui, forms, Axios, React Query, Zustand, and frontend verification.
- `../ecommerce-backend-development/SKILL.md` for authoritative business rules, Express, PostgreSQL, security, transactions, idempotency, jobs, and backend verification.

Use only the skills relevant to the request. For a genuinely end-to-end commerce feature, use all three.

## Inspect before planning

Read `AGENTS.md` and inspect the repository structure, packages, applications, routes, schemas, migrations, API clients, UI components, tests, Docker setup, and documentation. Locate existing feature specifications and contracts. Reuse project conventions and preserve unrelated work.

Do not assume the preferred stack is already installed. Do not add packages, reorganize applications, or invent infrastructure unless the feature requires it and the user authorized implementation.

## Establish one feature contract

For substantial work, create or update `docs/features/<feature-name>.md`. Start from [assets/feature-spec-template.md](assets/feature-spec-template.md) when useful. Treat this document as a coordination artifact, not a substitute for executable schemas and tests.

Record only what is known. Mark assumptions and unresolved decisions. Keep these sections aligned as implementation evolves:

- business outcome and scope;
- actors, permissions, and ownership;
- user journey and UI states;
- domain rules, invariants, and state transitions;
- database and migration changes;
- API request, response, pagination, and error contracts;
- validation and security boundaries;
- transaction, concurrency, and idempotency rules;
- frontend data ownership and React Query invalidation;
- observability and audit events;
- acceptance tests, rollout, and remaining risks.

Do not create speculative documents for a one-line local fix. Scale the artifact to the work.

## Assign ownership

Use this ownership model:

| Concern                                                                   | Authority                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Customer journey, hierarchy, interaction and content states               | E-commerce UI/UX                                                  |
| Browser rendering, forms, local state and query consumption               | Next.js frontend                                                  |
| Identity enforcement, permission, money, inventory and domain transitions | Express backend                                                   |
| Durable relational truth and invariants                                   | PostgreSQL schema and constraints                                 |
| Request and response meaning                                              | Shared API contract, enforced by backend and consumed by frontend |
| Cross-layer acceptance                                                    | Workflow-level integration tests and review                       |

Never duplicate authoritative pricing, discount, tax, shipping, inventory, permission, payment, or order-transition logic in the frontend. The UI may estimate for presentation only when clearly non-authoritative and reconciled with the API.

## Follow the delivery sequence

### 1. Frame the business behavior

Define the actor, trigger, desired outcome, preconditions, rules, permissions, state changes, exclusions, and measurable acceptance criteria. Identify failure, retry, cancellation, and recovery behavior.

### 2. Design the experience

Use the UI/UX skill to define the journey, page hierarchy, responsive behavior, accessibility, trust information, and loading, empty, error, success, unavailable, and interrupted states. Resolve experience decisions that affect contracts before coding.

### 3. Agree on contracts

Define endpoints, methods, parameters, request DTOs, response DTOs, error codes, authentication, authorization, pagination, filtering, sorting, idempotency, and versioning implications. Define who owns every field and whether it is mutable, derived, or historical.

Define frontend query keys, freshness needs, invalidation after mutations, optimistic behavior, and rollback. Do not let React Query cache behavior emerge accidentally after the API is built.

### 4. Design persistence and consistency

Define affected entities, constraints, indexes, migration behavior, financial snapshots, status transitions, transaction boundaries, concurrency strategy, and audit requirements. Plan compatibility and backfill for existing data.

### 5. Implement backend authority

Use the backend skill to implement migrations, repositories, services, thin controllers, validation, routes, authorization, transactions, idempotency, logging, and tests. Prove critical rules at the database and service boundaries before relying on the UI.

### 6. Implement frontend behavior

Use the frontend and UI/UX skills to implement typed Axios endpoints, React Query options and mutations, React Hook Form and Yup validation, minimal Zustand or local state, shadcn/ui composition, responsive states, accessibility, and frontend tests.

Generate client-facing messages from safe API codes and field errors. Do not expose internal backend messages or recreate domain validation as the only protection.

### 7. Integrate and verify

Test the real contract across layers. Cover the happy path and relevant validation, authentication, authorization, conflict, empty, unavailable, network, timeout, duplicate, concurrency, and recovery cases. Verify cache invalidation, navigation, focus, retry, database rollback, structured errors, and observability.

### 8. Review and report

Review security, accessibility, performance, concurrency, data migration, backward compatibility, failure recovery, and operational readiness. Run only available project commands and report their actual results.

## Use delivery gates

Do not advance blindly. Apply these gates proportionately:

1. **Behavior gate:** scope, actors, rules, and acceptance criteria are coherent.
2. **Contract gate:** request, response, error, permission, and idempotency behavior agree across layers.
3. **Data gate:** migrations, invariants, transaction boundaries, and rollback are safe.
4. **Backend gate:** authoritative rules and failure paths pass relevant tests.
5. **Frontend gate:** all specified UI states are usable, responsive, and accessible.
6. **Integration gate:** the actual end-to-end flow and recovery behavior work.
7. **Release gate:** configuration, migrations, observability, rollout, and rollback are understood.

When a gate is blocked by a product decision, stop only the affected irreversible work. Continue safe independent work when useful and state the blocker precisely.

## Keep changes coherent

- Deliver vertical slices instead of disconnected layers when scope permits.
- Keep one source of truth for each rule and contract.
- Update specifications when implemented behavior changes; do not leave knowingly stale documentation.
- Add compatibility handling when frontend and backend cannot deploy atomically.
- Prefer additive API and schema changes before removals.
- Use feature flags only with an owner, default, rollout plan, cleanup condition, and observability.
- Avoid premature shared abstractions, microservices, event systems, caches, and global state.

## Verify critical commerce scenarios

Select scenarios relevant to the feature:

- stale price or inventory between display and submission;
- invalid or unavailable variants;
- duplicate clicks, retries, webhook delivery, and job execution;
- concurrent inventory or coupon consumption;
- expired sessions, reservations, coupons, and payment intents;
- partial dependency failure and safe retry;
- unauthorized access to another customer's resource;
- order cancellation, inventory restoration, refund, and reconciliation;
- mobile layout, keyboard use, screen-reader feedback, and slow networks;
- stale React Query caches after successful or failed mutations.

## Final response

Report:

1. Business behavior delivered.
2. Skills and workflow stages applied.
3. Architectural and ownership decisions.
4. Feature contract created or changed.
5. Database and migration changes.
6. API and validation changes.
7. Backend transaction, authorization, idempotency, and error behavior.
8. Frontend UI, form, state, and cache behavior.
9. Accessibility, security, observability, and performance considerations.
10. Tests added and commands executed with actual results.
11. Files changed.
12. Assumptions, unresolved decisions, rollout needs, and remaining risks.

Omit non-applicable sections, but never conceal an applicable unverified check or risk.
