---
name: nextjs-frontend-engineer
description: Build, refactor, debug, test, or review production Next.js and React frontends using TypeScript, the App Router or an existing Pages Router, React Hook Form, Yup, Axios, Zustand, shadcn/ui, Tailwind CSS, and TanStack React Query. Use for frontend architecture, routes, Server and Client Components, forms, API clients, authentication-aware requests, server-state caching, local state, reusable UI components, responsive implementation, accessibility, performance, and frontend tests.
---

# Next.js Frontend Engineer

Build typed, accessible, maintainable React applications while respecting the repository's installed versions and architecture.

## Inspect before changing

1. Read project instructions, `package.json`, lockfile, TypeScript config, Next config, routing structure, lint rules, styling setup, environment conventions, and existing tests.
2. Detect installed library versions and use their supported APIs. Do not upgrade packages or introduce the requested stack when the repository already uses an intentional alternative unless the user asks.
3. Find established patterns for components, API calls, query keys, forms, state stores, errors, authentication, and tests. Extend them consistently.
4. Preserve unrelated user changes and public behavior.

## Plan ownership before code

Assign each concern to one owner:

- **Server Component or route handler:** server-only data access, secrets, metadata, secure mutations, or content that benefits from server rendering.
- **TanStack React Query:** asynchronous server state shared or refreshed in the browser.
- **React Hook Form:** transient form input, touched state, and submission lifecycle.
- **Zustand:** cross-component client state that is not server state or URL state.
- **URL/search params:** shareable navigation, filters, sort, pagination, and other history-worthy state.
- **Local React state:** small UI state owned by one component subtree.

Do not mirror the same state across these systems. Derive values when possible.

## Apply Next.js and React boundaries

- Prefer Server Components in the App Router. Add `"use client"` only at the smallest interactive boundary.
- Keep secrets, privileged tokens, and server-only modules out of client bundles.
- Use framework navigation, metadata, image, font, caching, loading, error, and not-found facilities where appropriate.
- Avoid request waterfalls. Fetch independent resources concurrently and stream meaningful boundaries when the existing architecture supports it.
- Keep render logic pure. Use effects only to synchronize with external systems, not to derive state.
- Preserve hydration stability; do not read browser-only globals during server rendering.

For detailed architecture decisions, read [references/architecture.md](references/architecture.md).

## Build typed features vertically

Implement one coherent slice at a time:

1. Define domain and transport types at the correct boundary.
2. Add or reuse the Axios client and typed endpoint function.
3. Define stable query keys and query/mutation options.
4. Add validation schema and form input types when needed.
5. Compose accessible shadcn/ui primitives into domain components.
6. Add only the minimum client or global state required.
7. Cover loading, empty, error, success, disabled, and retry behavior.
8. Test the user-observable behavior.

Avoid premature generic wrappers. Extract abstractions after a real repeated pattern appears.

## Use the requested stack deliberately

### TypeScript

Keep strict typing. Prefer inferred local types and explicit boundary types. Avoid `any`, unsafe assertions, broad index signatures, non-null assertions, and duplicate API/domain types without justification. Narrow `unknown` errors before reading them.

### Axios and TanStack React Query

Keep transport concerns in the Axios layer and caching concerns in React Query. Normalize errors once. Use stable query-key factories, targeted invalidation, and mutation callbacks that reflect actual server results. Do not put fetched server data into Zustand.

### React Hook Form and Yup

Use uncontrolled registration where possible and `Controller` only for controlled widgets. Let the schema own validation rules and derive form types from the schema when versions support it safely. Show field errors near inputs, focus the first invalid field, prevent duplicate submissions, and preserve meaningful server errors.

### Zustand

Create small domain stores with selectors. Keep actions next to state, avoid a single application-wide store, and persist only data that is safe and genuinely useful across sessions. Guard persisted browser state against hydration mismatch.

### shadcn/ui and design systems

Treat shadcn components as owned source code, not opaque dependencies. Reuse project components and tokens, preserve accessibility primitives, compose variants consistently, and keep domain behavior outside low-level UI primitives. Do not replace a good existing design system merely to satisfy the stack list.

For concrete conventions for data, forms, state, and UI composition, read [references/stack-patterns.md](references/stack-patterns.md).

## Handle API and failure states

- Define request cancellation or signal propagation when navigation or rapid input can obsolete work.
- Distinguish authentication, authorization, validation, conflict, rate-limit, network, and unexpected failures where the UI response differs.
- Never expose secrets or log tokens and personal data.
- Retry only safe failures with bounded behavior. Do not automatically retry non-idempotent mutations without an idempotency strategy.
- Make optimistic updates reversible and use them only when failure recovery is understandable.

## Verify quality

Run the repository's formatter, lint, TypeScript check, unit tests, and production build when available. Test affected workflows at narrow and wide viewports. Verify keyboard navigation, focus, labels, validation announcements, loading transitions, error recovery, long content, and empty data.

Prefer behavior-focused tests. Mock at network boundaries rather than implementation internals. Do not claim commands passed unless they ran successfully.

## Coordinate with the commerce skill

For storefront journeys, product discovery, product pages, cart, checkout, merchandising, conversion, or commerce UX, also read `../ecommerce-ui-ux/SKILL.md`. Let that skill determine experience requirements and use this skill to implement them safely.

## Finish clearly

Summarize the implemented behavior, important architectural decisions, changed files, verification commands, and any remaining risk or required configuration. Mention new environment variables without printing secret values.
