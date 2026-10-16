# Stack patterns

Adapt names and locations to the repository. Confirm installed versions before using exact APIs.

## Axios boundary

- Create one client per meaningful base URL or authentication policy.
- Centralize base URL, safe headers, timeout, credential policy, and error normalization.
- Keep endpoint functions small and typed: accept domain-relevant arguments and return the unwrapped response type.
- Add interceptors only for cross-cutting transport behavior. Prevent refresh-token loops and concurrent refresh races.
- Propagate `AbortSignal` when supported by the installed Axios version.

## React Query

- Create query-key factories such as `products.all`, `products.list(filters)`, and `products.detail(id)`.
- Put reusable `queryOptions` or hook factories near the endpoint boundary.
- Configure `staleTime`, garbage collection, retry, and refetch behavior from actual freshness needs.
- Use `enabled` only for real prerequisites, not to conceal invalid component state.
- Prefer mutation results or targeted invalidation over clearing the entire cache.
- Roll back optimistic updates from a captured snapshot and reconcile with the server afterward.

## React Hook Form and Yup

- Define defaults for every controlled field and keep form data serializable.
- Use the Yup resolver compatible with installed package versions.
- Normalize empty strings, nullable values, dates, and numbers explicitly at the schema boundary.
- Map backend field errors with `setError`; show non-field failures in a form-level alert.
- Use `reset` deliberately when remote initial data changes; do not overwrite dirty user input silently.
- Disable or guard submission while pending and make success behavior explicit.

## Zustand

- Store minimal state plus domain actions.
- Select only required slices to limit rerenders; use shallow comparison only when selecting composite values.
- Keep query results and form values out of stores.
- Version persisted state and provide migration when its shape may evolve.
- Never persist access tokens or sensitive personal data without a reviewed security requirement.
- Create request-scoped stores for server-rendered usage when global module state could leak between requests.

## shadcn/ui

- Check the existing component registry, aliases, utility function, Tailwind setup, and theme tokens before adding components.
- Add the smallest needed primitive and review generated source before adapting it.
- Preserve Radix accessibility behavior, ref forwarding, keyboard behavior, focus management, and accessible names.
- Extend variants using the project's variant utility rather than scattered conditional class strings.
- Keep primitives generic; place product, checkout, or account logic in feature components.
- Use semantic tokens such as background, foreground, primary, muted, destructive, border, and ring instead of hardcoded page colors.

## Testing

- Test queries, forms, and mutations through visible behavior and accessible roles.
- Use a request-mocking layer for endpoint success, validation, authorization, delay, and server failure cases.
- Create a fresh QueryClient and store instance per test when state isolation matters.
- Assert pending controls, field messages, retries, recovery, cache-visible outcomes, and navigation.
- Reserve end-to-end tests for critical cross-page paths and integration risks.
