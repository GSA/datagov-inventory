# Accessibility test record: Inventory editor alpha

Evidence for [#30](https://github.com/GSA/datagov-inventory/issues/30): automated scans of every editor state, and a
manual keyboard and screen-reader test. The standard is WCAG 2.1 AA (Section 508). Automated checks don't prove
conformance. The screen-reader rows below need a person to fill them in.

- **Build tested:** `main` at `db2cdb7`, plus the fixes listed under [Findings](#findings).
- **How:** the production build (`npm run build && npm run preview`) under the production CSP, Chromium from
  Playwright 1.61, on 2026-11-25.

## Automated: axe on every state

[`editor/e2e/accessibility.spec.ts`](../editor/e2e/accessibility.spec.ts) drives the editor through every state and
runs axe with the WCAG 2.1 A and AA tags at each one, once at 375 px and once at 1440 px. It runs in the
**Playwright** CI check, so any violation fails the build. It covers:

- **Pages:** start (with and without an open catalog), page not found, no catalog open, invalid address, catalog not
  in this browser, browser storage unavailable, and the header menu open on a phone.
- **Import:** the page, a load in progress, a load error, the slim "catalog is open" alert, the "Replace the open
  catalog?" prompt, and the storage-unavailable alert.
- **Tree:** loaded, expanded with a nested object open, filtered, and filtered to no matches.
- **Forms:** a dataset's form, the form with a field error after checking the object, a new object created in place
  of the form, a shared object with its places shown, and the in-place prompt before deleting a shared object.
- **Picker ("Add an existing …"):** the list open with an option active, no matches, and an object just added.
- **Check results:** an error with its results shown and hidden, out of date after an edit, and no errors.
- **Export:** the warning dialog for a catalog with errors, and the success alert.
- **Restore:** the catalog restored from browser storage after a reload.

There is no "restore or discard" prompt on `main`: a reload reopens the catalog from its address. The prompt is an
unchecked criterion of #28. When it's built, add it to the spec.

axe couldn't compute contrast for a few stock USWDS parts ("needs review"), so they were measured by hand (below).

## Keyboard test script

Use the keyboard only: Tab, Shift+Tab, Enter, Space, the arrow keys and Escape. At each step, check that focus is
visible and goes where the step says.

| # | Task | Steps | Expected |
|---|---|---|---|
| 1 | Load | On the start page, Tab to **Import a catalog**, Enter. Tab to **Sample catalog** and pick one with the arrow keys, Tab to **Load sample**, Enter. | The editor opens, with focus on the catalog's title (h1). |
| 2 | Open | Tab into the tree (one tab stop). Use Down and Up to move, Right to open a row, Left to close it, Enter to open an object. | The object's form opens, and focus stays in the tree. |
| 3 | Edit | Tab to **Title**, type, then Tab away. | The tree row shows the new title. The status line says "Saved". |
| 4 | Link an existing object | In **Contact point**, type in **Add an existing Contact**, press Down to reach an option, Enter. | The contact is added, focus is on its link, and "Added … to Contact point" is announced. |
| 5 | Create new | Tab to **Create new Distribution** (in the Distribution field), Enter. Then Tab to **Back to …**, Enter. | A new distribution replaces the form, with focus on its heading. Back returns to the dataset, with focus on the new distribution's link. |
| 6 | Delete and undo | On an object, Tab to **Delete object**, Enter. Shift+Tab to **Undo**, Enter. | "Deleted …" is announced, then "Undone …". Focus stays on Undo. |
| 7 | Check | Tab to **Validate catalog**, Enter. With errors, Tab to **Show results**/**Hide results** and to each object link. | The result is announced once. Each object in the results opens its form. |
| 8 | Export | Tab to **Export catalog**, Enter. If the warning dialog opens, Tab between **Go Back** and **Download Anyway**. | The file downloads, and "Catalog exported successfully" is announced. Focus can't leave the dialog while it's open. |

### Results with a keyboard (agent, Chromium)

Every task passed. Tasks 1, 2, 3, 5, 7 and 8 are automated, keys only, in *the main tasks can be done with the
keyboard alone*. Task 4 is in `select-or-create.spec.ts` (*picks with the keyboard alone*), and task 6 is in *a delete
and its undo are announced*. The tree's other keys (Right, Left, Home, End) are in `catalog-tree.spec.ts`.

| Check | Result |
|---|---|
| Focus visible | Every tab stop on the import page and on a dataset's form shows the USWDS 4 px focus ring. The ring is 3.0:1 against the selected tree row and 3.2:1 against white. |
| Focus order | Header, then the page's actions, then the tree filter, the tree, and the form in reading order. Focus moves on purpose: to the h1 after a load, to the object's heading after Create new, to the row after Back, and into the dialog (on **Go Back**) and back to **Export catalog**. |
| Focus lost | Undo dropped focus to `<body>` once it was used up. Fixed (F1). |
| Reflow (320 px; 400 % zoom) | No horizontal scroll on the start, import, form, check results, dialog, picker, shared object or delete prompt screens. |
| 200 % zoom (640 px) | The same screens: no horizontal scroll. |
| Text spacing (WCAG 1.4.12) | No horizontal scroll or clipped text at 1440, 375 and 320 px. The class name beside a tree row is cut with an ellipsis, as it is without the spacing (by design: the full text is in the row's accessible name and on hover). |
| Contrast | Measured where axe couldn't: current nav link 6.7:1, tree class names 6.7:1, the "Shared" tag 13.1:1, the error badge 5.6:1, field errors 7.0:1, hint text 4.6:1, the selected tree row 9.6:1. |
| Headings and landmarks | One h1 per page, then h2 for "Catalog contents" and the object, and h3 for each field group. Landmarks: the banner, a "Primary" nav, main, the tree's nav (labelled "Catalog contents"), the "Where this object is" breadcrumb, and a form labelled "Edit …". Each page has its own title. |
| Live regions | Announced once, politely: the check's result, the filter's match count, the picker's matches and "Added …"/"Removed …", the export result, load errors (alert), and now delete and undo (F2). A stale check result is cleared silently. Nothing announces progress ticks. |
| Dialog | The export warning traps focus and returns it to **Export catalog**. Escape doesn't close it (USWDS `forceAction`), so the user must choose: see F3. |

## Screen readers (needs a person)

Repeat the keyboard script with each combination and record the result: pass, or the step and what was heard.

| Screen reader | Browser | Tester | Date | Result |
|---|---|---|---|---|
| NVDA (latest) | Firefox or Chrome, Windows | | | Not yet run |
| JAWS (latest) | Chrome, Windows | | | Not yet run |
| VoiceOver | Safari, macOS | | | Not yet run |

Listen especially for: the tree (role, level, expanded state, "Shared · N places", item counts), the picker (option
count, the active option), the field-error alert, the "Used in N places" disclosure, and the delete, undo and check
announcements.

## USWDS parts and the ones we built

USWDS (through `@trussworks/react-uswds`) was enough for the page frame and most controls: the banner, header and
navigation, buttons and button groups, text inputs and text areas, labels and hints, the file input, the `<select>`,
alerts (including the in-place delete and replace prompts), the breadcrumb, accordions (check results, "Used in"),
the process list, and the export warning modal.

USWDS had no suitable part for two things, so we built them on the WAI-ARIA APG patterns:

- **The catalog tree** ([`CatalogTree.tsx`](../editor/src/CatalogTree.tsx)): an APG treeview. USWDS has no tree view.
- **The "Add an existing …" picker** ([`LinkField.tsx`](../editor/src/LinkField.tsx)): an APG combobox with a listbox
  popup that shows the first 25 matches. The USWDS combo box renders every option, which is too slow for thousands of
  objects.

These two need the screen-reader pass most.

## Findings

| # | Finding | Status |
|---|---|---|
| F1 | Undo was `disabled` once used up, so focus fell to `<body>` (WCAG 2.4.3; DESIGN.md). | Fixed in #30's PR: Undo is `aria-disabled` and keeps focus. |
| F2 | Deleting an object and undoing it changed the tree with no announcement (WCAG 4.1.3). | Fixed in #30's PR: both are announced. |
| F3 | The export warning is a modal, which DESIGN.md rules out. Escape doesn't close it, and its labels are title case ("Validation Errors Detected", "Go Back", "Download Anyway"). Not a WCAG failure. | Needs a ticket and an owner. |
| F4 | No "Skip to main content" link. WCAG 2.4.1 is met by the landmarks and headings, and the header has only four tab stops, but USWDS sites usually have one. | Needs a decision. |
| F5 | Screen-reader pass not done. | Needs a tester (table above). |
