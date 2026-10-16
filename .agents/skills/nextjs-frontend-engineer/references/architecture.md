# Next.js frontend architecture

## Routing and rendering

- Follow the router already in use. Do not mix App Router and Pages Router patterns casually.
- In the App Router, keep layouts and pages server-rendered unless interactivity requires a client boundary.
- Use route groups for organization without changing URLs and dynamic segments only for real resource identity.
- Use `loading`, `error`, and `not-found` boundaries at scopes that allow useful recovery.
- Generate metadata from authoritative server data; avoid client-only metadata patches.

## Data-placement decision

Use server fetching when data is required for initial render, SEO, authorization, or secret-backed access and does not need rich browser cache behavior. Use React Query when browser-side refetching, mutations, polling, optimistic UI, or shared cache ownership is valuable. Hydrate server-fetched query data only when the benefit outweighs the added boundary complexity.

Do not fetch the same resource independently in a Server Component, client effect, React Query, and Zustand.

## Component boundaries

- Keep route components focused on composition and data ownership.
- Keep reusable primitives free of business requests and global-store knowledge.
- Keep feature components near their queries, schemas, tests, and domain helpers when the project uses feature folders.
- Pass serializable props across server-to-client boundaries.
- Prefer composition over boolean-heavy components and enormous configuration objects.

## Caching and mutations

- Decide whether freshness belongs to Next.js server caching or the React Query client cache.
- Use stable, serializable query keys ordered from broad resource to specific parameters.
- Update or invalidate the narrowest cache region proven stale by a mutation.
- Treat revalidation, router refresh, and query invalidation as different mechanisms; use only the owners involved in the changed data.

## Security boundaries

- Keep privileged API calls in server-only modules or route handlers.
- Treat environment variables as public only when deliberately exposed with the framework's public prefix.
- Do not rely on hidden buttons or client guards for authorization.
- Avoid blindly forwarding arbitrary request headers or backend error bodies to the browser.

## Performance

- Measure before adding memoization.
- Avoid large client providers at the root when a smaller scope works.
- Load heavy client-only features on demand where useful.
- Reserve media dimensions, keep font loading stable, and avoid unnecessary layout shifts.
- Use pagination or virtualization for genuinely large collections, not as default complexity.
