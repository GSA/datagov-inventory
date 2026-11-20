---
name: user-experience-review
description: Reviews or verifies a user interface change in the editor through six independent lenses, then combines the findings. Use when reviewing, verifying or planning a UI or UX change, or before opening a PR that changes what users see or do.
---

# User experience review

Checks a change against [DESIGN.md](../../../DESIGN.md), which holds the rules.

## Steps

1. List the states the change touches (e.g. typical, shared, just created, errors, long titles, 3,000 datasets).
2. Screenshot each state at 375px and 1440px from the production build (`npm run build && npm run preview`), before (main) and after.
3. Run each lens below as an independent reviewer: a sub-agent per lens where the harness supports them, otherwise one after another, each fresh. Give it its checklist, the screenshots, the code and DESIGN.md, not other lenses' findings. It returns ranked findings with evidence (state, width, measurement).
4. Combine: adopt what lenses agree on, settle conflicts by DESIGN.md, and on a tie accessibility wins. Record each conflict and its resolution.
5. Check the result against DESIGN.md rule by rule; run the axe specs, and the perf specs if anything could be slower.
6. Open the PR with the [pull-request](../pull-request/SKILL.md) skill, adding findings by lens, conflicts and how they were settled, and what was deliberately left alone.

## Lenses

1. **Visual hierarchy and layout**: what draws the eye first, and should it? Do weight, grouping and spacing show what belongs together? Same order in every state? USWDS before custom?
2. **Task flow for a federal data manager**: do they see, in order, what this is, whether it's shared (before editing), a way back, whether it's valid? Which steps or controls can go?
3. **Accessibility (WCAG 2.1 AA, Section 508)**: in a live browser, keyboard only. Tab order and focus after navigation, each action and Back; headings, names and roles; APG patterns for custom widgets; announcements; color and contrast; reflow at 320px; axe.
4. **Content and plain language**: anything said twice? Schema terms instead of the user's words? Labels from `labels.ts`? Results and headings plain?
5. **Power user on large catalogs**: with 3,000+ datasets, measure pixels and tab stops from the heading to the first field at both widths, and input to next paint. Are long lists folded?
6. **Mobile (375px)**: horizontal scroll, touch targets under 44px, anything phones need but can't reach, buttons that stack full width, a tree that buries the form.
