# Audit and acceptance checklist

## Audit method

Record for each issue:

1. **Evidence:** page, state, viewport, and observable behavior.
2. **Affected user:** who encounters it and under what condition.
3. **Impact:** blocked task, confusion, lost trust, accessibility barrier, revenue risk, or maintenance cost.
4. **Severity:** critical, high, medium, or low.
5. **Fix:** concrete behavior or design change.
6. **Validation:** test or metric that demonstrates the fix.

Rank critical-path blockers and misleading commercial information above polish.

## UX and commerce

- Customers can understand what is sold and reach relevant products.
- Search, categories, filters, sort, breadcrumbs, and back navigation preserve context.
- Product options, availability, price, promotions, delivery, returns, and recurring terms are clear.
- Add-to-cart feedback is immediate and preserves the selected variant.
- Cart editing is predictable and totals update correctly.
- Checkout explains errors, retains valid input, and supports recovery.
- Confirmation removes uncertainty about whether payment succeeded.
- Empty, loading, unavailable, and failure states offer a next action.

## Accessibility

- All tasks work with keyboard only and show visible focus.
- Page structure uses landmarks and logical headings.
- Controls have programmatic names, roles, states, and error relationships.
- Contrast, touch targets, text resizing, zoom, and reflow are usable.
- Images have appropriate alternative text; decorative images are ignored.
- Dynamic cart, inventory, validation, and confirmation updates are announced when needed.
- Motion respects reduced-motion preferences.

## Responsive and visual quality

- Hierarchy remains clear on mobile, tablet, and desktop.
- No unintended overflow, clipping, overlap, or layout shift occurs.
- Long titles, prices, translations, and large text remain usable.
- Product imagery is consistently framed without hiding important detail.
- Components use consistent tokens and interaction states.

## Performance and resilience

- Main product content and the purchase action avoid unnecessary client work.
- Images use appropriate dimensions, formats, lazy loading, and reserved aspect ratios.
- Loading states prevent duplicate actions and preserve layout.
- Network failures provide retry or recovery when appropriate.
- Core flows remain understandable if optional third-party widgets fail.

## Trust, privacy, and ethics

- Claims, stock, reviews, countdowns, discounts, and delivery estimates are truthful.
- Fees and recurring charges appear before commitment.
- Consent is specific and not bundled with purchase.
- Destructive actions require confirmation or offer undo.
- Security and privacy claims match actual behavior.

## Experiment quality

- State one falsifiable hypothesis and one primary metric.
- Add relevant guardrails for refunds, cancellations, errors, support, accessibility, and performance.
- Define the audience, exposure unit, duration or stopping rule, and instrumentation before launch.
- Do not treat clicks alone as proof of customer or business value.
