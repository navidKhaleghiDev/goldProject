---
name: ecommerce-ui-ux
description: Design, implement, or audit conversion-focused e-commerce user experiences. Use for storefront homepages, navigation, search, collection and product pages, carts, checkout, account areas, responsive UI, design systems, merchandising, CRO experiments, accessibility reviews, and UX improvements to online shops in design files or frontend code.
---

# E-commerce UI/UX

Create clear, trustworthy shopping experiences that balance customer needs, brand expression, conversion, accessibility, and implementation quality.

## Start with project evidence

1. Inspect the repository, existing UI, routes, components, tokens, assets, analytics, and tests before proposing changes.
2. Preserve the current framework and established patterns unless the user asks for a redesign or migration.
3. Identify the store model: catalog size, product complexity, target customer, region, currency, fulfillment, and primary conversion goal.
4. State only consequential assumptions. Do not invent research findings, customer data, inventory, reviews, policies, or business metrics.
5. When requirements are incomplete, build the smallest coherent experience and mark business-specific copy or data clearly.

## Choose the mode

- **Design:** Define journeys, information architecture, page hierarchy, interaction states, responsive behavior, and visual direction.
- **Implement:** Translate the chosen direction into the project's existing components and conventions.
- **Audit:** Evaluate evidence, rank issues by customer and business impact, then recommend specific fixes.
- **Optimize:** Form a measurable hypothesis, change one meaningful variable, and define success and guardrail metrics.

Combine modes only when the request requires it. Do not turn an audit-only request into an unsolicited rewrite.

## Follow the workflow

### 1. Frame the outcome

Clarify the customer, shopping mission, product type, business goal, device priority, and constraints. Prefer observable outcomes such as product discovery, add-to-cart completion, checkout completion, fewer returns, or stronger repeat purchase.

### 2. Map the journey

Cover the relevant path:

`entry -> discovery -> evaluation -> selection -> cart -> checkout -> confirmation -> post-purchase`

Document major alternate and failure paths: zero search results, invalid variants, unavailable inventory, promotion errors, payment failure, slow loading, empty cart, and interrupted checkout.

### 3. Design the information hierarchy

Prioritize decision-critical information for the current page. Keep one dominant action per decision point. Reveal secondary detail progressively. Make price, availability, fulfillment, returns, product options, and total cost understandable before commitment.

For page and interaction patterns, read [references/storefront-patterns.md](references/storefront-patterns.md).

### 4. Establish the visual system

Reuse existing tokens first. Otherwise define a compact system for color, type, spacing, radii, elevation, icons, motion, and responsive breakpoints. Design reusable primitives and commerce components before page-specific variations.

Avoid generic template aesthetics. Derive a distinct direction from the product category, audience, positioning, and available brand assets. Use decoration only when it reinforces hierarchy or brand character.

### 5. Specify complete states

Include default, hover, focus, active, selected, disabled, loading, empty, error, success, unavailable, and offline states where relevant. Specify keyboard behavior, focus order, validation timing, reduced motion, touch targets, text resizing, and screen-reader labels.

### 6. Implement with restraint

Use semantic HTML and the repository's component architecture. Keep business rules separate from presentation. Preserve URLs, analytics hooks, SEO metadata, structured data, and localization behavior unless changes are explicitly required. Do not add a dependency when existing code can meet the need cleanly.

### 7. Validate

Validate the critical path at mobile and desktop widths. Test keyboard navigation, focus visibility, content overflow, long translations, missing images, slow requests, empty data, and error recovery. Run available lint, type, unit, integration, and browser tests.

For audits and final acceptance, read [references/audit-checklist.md](references/audit-checklist.md).

## Make decisions by priority

When goals conflict, use this order:

1. Prevent deception, inaccessible barriers, and irreversible mistakes.
2. Preserve task completion and accurate commercial information.
3. Reduce uncertainty and interaction cost.
4. Improve conversion without hiding choices or adding pressure.
5. Strengthen brand expression and delight.

Never use fake urgency, concealed fees, preselected paid extras, obstructive cancellation, misleading scarcity, or visually disguised consent.

## Deliver useful artifacts

Match the output to the request. Useful deliverables include:

- a prioritized audit with evidence, severity, impact, and fix;
- a journey or page-flow specification;
- a component and state inventory;
- responsive implementation in the existing codebase;
- a design-token proposal;
- an experiment brief with hypothesis, primary metric, guardrails, and stopping rule.

For implementation work, finish with changed files and verification results. For design work, explain hierarchy, responsive behavior, states, and rationale clearly enough to implement.
