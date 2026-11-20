---
name: pull-request
description: Opens or updates a pull request with before and after screenshots, performance numbers on large catalogs, and a risk rating. Use when creating a PR, or updating its description after new commits.
---

# Pull request

## Before opening

1. Branch off the latest `main` as `<issue>-<slug>`. Do only what the issue asks.
2. Run `npm run build`, `npx vitest run` and `npx playwright test` in `editor/`, and note the counts.
3. For UI changes, run the [user-experience-review](../user-experience-review/SKILL.md) skill first.

## Screenshots (any visible change)

- Capture each changed state at 375px and 1440px from the production build (`npm run build && npm run preview`), before (`main`) and after.
- Commit them to a never-merged `pr-assets/<topic>` branch, and link them by commit SHA: `https://github.com/GSA/datagov-inventory/raw/<sha>/<file>.png`.
- Show them in a table with a `before | after` row per state and width.

## Performance (any change to rendering, the tree, forms, loading or validation)

- On `main` and on the branch, run `PERF=1 npx playwright test tree-performance validation-performance` on 3,000 datasets (add `CPU_THROTTLE=4` for a slow machine).
- Report the worst of 3+ runs per interaction in a `main | branch` table. Mark each ✅ (≤100 ms input to next paint) or ❌, and explain any regression.
- Not measured? Say why the change can't affect speed.

## Description

```markdown
## Summary
What changed and why, in plain words. Closes #n (or Refs #n).

## What changed
Short bullets, or a before/after table.

## Risk: Low | Medium | High
Why, and what could break. Rollback: revert on main (it redeploys).

## Performance
## Screenshots
## Tests
What ran and the counts; new or changed tests.

## Not changed
Found but left out, each worth its own issue.
```

Rate the risk:

- **Low**: docs, tests, or a contained UI change with tests and axe passing.
- **Medium**: shared components, labels, the catalog model, focus or keyboard behavior, or a perf change.
- **High**: export or import output, stored data, the CSP, dependencies, or anything that can lose a user's catalog.

No AI attribution lines in commits or the PR.
