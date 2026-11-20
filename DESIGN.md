# Design rules

Rules for the editor's user interface (`editor/`). Review changes against them with the [user-experience-review](.claude/skills/user-experience-review/SKILL.md) skill.

## USWDS first

- Use USWDS and `@trussworks/react-uswds` components, utilities and tokens; name colors by token.
- Build a custom component only where USWDS has no suitable pattern, following the WAI-ARIA APG pattern, and note in the code that it is custom (the catalog treeview; the "Add an existing …" combobox, because the USWDS combo box renders every option).
- No USWDS `type="search"` input next to a long list: USWDS floats it, which re-lays out every row.

## Accessibility (required)

- WCAG 2.1 AA and Section 508 compliance is required. The axe checks (`wcag21aa` in `e2e/fixtures.ts`) must pass on every new state.
- Everything works by keyboard, with visible focus that never falls to `<body>` (a busy button is `aria-disabled`, not `disabled`).
- Move focus on purpose: to the heading on navigation, to the result after an action, to the user's row on Back.
- Never convey meaning by color alone. Keep text contrast at 4.5:1 (USWDS "darker" tokens on tinted backgrounds).
- Live regions announce results once, politely, not progress ticks.
- Keep badges and status outside headings. Status hidden only visually stays in the DOM (`usa-sr-only`).

## Mobile and responsive

- Check at 375px and desktop (1440px); reflow at 320px with no horizontal scroll.
- Phones may hide a duplicate (the breadcrumb), never the only way to do something (Back).

## Layout and content

- No modals (huddle 2026-11-06): replace the form pane, or ask in place with an inline alert.
- No layout shift: fixed-width buttons whose labels change, nothing inserted above content after an action, a busy state only after 400 ms and then for at least 500 ms.
- One compact form header in a fixed order (breadcrumb, title, notice, status and actions), with variable-height parts last.
- Say each thing once, and show information only when it adds something ("Used in" only for a shared object). Fold long lists in an accordion.
- Sentence-case labels from `editor/src/labels.ts`, never hard-coded.
- Plain language: the user's words, not schema terms ("Contact", not "Kind"); state results ("No errors found"); headings say what to do ("Fix these 3 errors").

## Performance

- ≤100 ms input to next paint on 3,000+ datasets (`editor/fixtures/largeCatalog.ts`), measured on the production build with `PERF=1 npx playwright test tree-performance validation-performance`, not assumed. Wait in-page (MutationObserver), not with Playwright locators, which inflate timings 3–4×.
- No virtualization libraries; add memoization only where a measurement shows it helps.

## Security

- Render untrusted text only through React: no `dangerouslySetInnerHTML` or `innerHTML`.
- Never loosen the CSP (`editor/cf/security-headers.conf`, `editor/vite.config.ts`).
