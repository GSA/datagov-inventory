# Round 1, analyst D: USWDS, content and accessibility

Lens: which USWDS 3.x parts to use, plain-language wording, empty/loading/error states, Section 508 / WCAG 2.1 AA.
Schema facts used: the copy is GSA/dcat-us @ `4996591` (2026-10-07). Date properties accept `date-time`, `date`, `YYYY` or `YYYY-MM`. The only `maxLength` is on 2-letter language codes.

## 1. Page frame (every page, #16, #32)

Top to bottom:

1. **`usa-skipnav`** "Skip to main content" → `#main-content`. The editor page also gets a second skip link, "Skip to object form" (→ `#detail-pane`), so keyboard users don't have to step past the tree.
2. **`usa-banner`**, the standard "An official website of the United States government" banner. Only show it if the site is hosted on `.gov` (`alpha.inventory.data.gov`, per #32). See the open questions.
3. **Alpha label: use `usa-site-alert usa-site-alert--info usa-site-alert--slim`, not `usa-alert`.** A site alert is the USWDS part made for a site-wide message on every page. It sits outside `<main>` in its own labelled `<section aria-label="Site alert">` and has no close button, so it can't be dismissed. That matches "any page shows a banner" (#32). A `usa-alert` is an in-page, contextual message. Putting one in `<main>` on every page would add noise to the main content and to the axe scans. Also add a `usa-tag` reading "Alpha" next to the site title in the header, as a second visual cue.
4. **`usa-header usa-header--basic`** with primary nav: *Start*, *Editor*, *Check results*, *Help*, and a *Give feedback* link. Use the basic header, not the extended one. There are only five items, and the extended header uses about 100px more height, which the two-pane editor needs. Mark the current page with `usa-current` and `aria-current="page"`.
5. **Editor toolbar** (editor page only, under the header): catalog title, save status, and buttons in a `usa-button-group`: *Check catalog*, *Export*, *Undo last removal* (shown only while there is something to undo), *Clear my data*. Use a plain `<div>` with a heading, **not `role="toolbar"`**, because that role promises arrow-key movement.
6. **`<main id="main-content">`**.
7. **`usa-footer usa-footer--slim`** with links: Help, "Where your data lives", Give feedback, Clear my data from this browser. Under it, **`usa-identifier`** (GSA parent, plus the required links: Accessibility statement, Privacy policy, FOIA, No FEAR Act, OIG, Performance, USA.gov). Federal sites must have the identifier. The mockup can use placeholder hrefs.

## 2. Components per feature

| Feature | Use | Notes / avoid |
|---|---|---|
| Start: three ways in (#21) | `usa-card-group` with 3 `usa-card`s: Open a file, Paste JSON, Start a blank catalog | Each card has one real `usa-button`. Don't make the whole card clickable. |
| Open file (#21) | `usa-file-input` with `accept=".json,application/json"`. Its drop target already covers drag and drop | Hint: "DCAT-US 3.0 JSON only. Up to [50 MB]." The limit comes from #29, so it is a placeholder for now. |
| Paste JSON (#21) | `usa-textarea` plus a "Load pasted JSON" button | No `usa-character-count`, because the limit is in MB, not characters. |
| Load summary (#21) | `usa-summary-box` with the file name and object count, and a `usa-table` of objects by class (no sorting needed) | |
| Step indicator | **Avoid.** The workflow isn't linear (load, edit, check, export can happen in any order). | |
| Tree (#23) | **Custom ARIA treeview** styled with USWDS tokens. See below. | `usa-sidenav` is a navigation list of links with no expand/collapse and no arrow keys, so it can't meet #23. Borrow only its look. |
| Tree filter (#23) | A labelled `usa-input type="search"` ("Filter by title or name") plus a polite match count | **Don't use `usa-search`.** It is a submit form with an icon-only button, and this filter is live. |
| View switch (#20 comment) | `usa-button-group--segmented` with "By catalog" / "By type", using `aria-pressed` | |
| Object form (#24) | `usa-form-group`, `usa-label`, `usa-hint` (schema description), `usa-input`, `usa-textarea` | Show the requirement level as visible words in the label: "(required)" / "(recommended)", not an asterisk alone. Mandatory and Recommended fields always show. Optional fields go in a `usa-accordion--bordered` "Optional fields (n)" that opens automatically if it holds an error. |
| Allowed values (#24) | `usa-select` for up to about 15 values, `usa-combo-box` for more | |
| Dates | Plain `usa-input` with hint "YYYY-MM-DD, YYYY-MM or YYYY. A time is allowed." | **Avoid `usa-date-picker` and `usa-memorable-date`.** The schema allows year-only and date-time values, which they can't hold. |
| Multi-value fields (#24) | `<fieldset>` + `usa-legend` + `<ol>` of inputs. Each row has *Move up*, *Move down*, *Remove* text buttons (`usa-button--unstyled`); "Add another …" goes at the end | No USWDS part does this, so it is custom and must be listed in #30. Don't use drag-only reordering. `usa-input-list` is for checkbox/radio lists and doesn't fit here. |
| Class-valued field (#25) | Each linked object shows as a small bordered row: title, `usa-tag` with the class, "Used in 4 places", and actions *Open*, *Edit a copy for this one*, *Remove from this field*. Then *Add [contact point]* | `usa-tag` isn't interactive, so never put the actions on the tag. |
| Select-or-create dialog (#25) | One `usa-modal usa-modal--lg`. Step 1: labelled search input, then results as `usa-radio--tile` (title, class, usage count), then *Select*. Below that, *Create a new [class]* | **`usa-combo-box` doesn't fit** select-existing: it can't show usage counts and gets slow with thousands of options. Results show 20 at a time, then "Show more". |
| Create new inside dialog (#25) | Swap the same modal's content. Put a `usa-breadcrumb` at the top ("Dataset › Contact point › New address") with a *Back* button | **Never a second `usa-modal`** (ADR 0002 "Dialogs are single-level"). |
| Usage list (#25, #26) | `usa-table` (Object, Class, Field), with each object a link | |
| Delete confirm (#26) | `usa-modal` with `data-force-action`, listing affected places in a `usa-list`. The delete button is `usa-button--secondary` (the red one) and its label says what it does: "Delete from 4 places" | |
| Undo (#26) | `usa-alert--success usa-alert--slim` in the toolbar status area, with an *Undo* button and a polite announcement. It **doesn't auto-hide** (WCAG 2.2.1) | USWDS has no toast, so don't build a floating timed one. |
| Field errors (#27) | `usa-form-group--error`, `usa-label--error`, `usa-error-message` (with an `id` the input references in `aria-describedby`), `usa-input--error`, and a `usa-icon` error icon | **Avoid `usa-validation`.** It is a live checklist for password-style rules. |
| Object error summary (#27) | `usa-alert--error` at the top of the form, headed "This dataset has 3 problems", with a list of links that move focus to each field | |
| Catalog check results (#27) | `usa-summary-box` for totals, an h3 per class, and under each a `usa-table usa-table--sortable` (Object, Field, Problem) with `usa-pagination` past 50 rows | Sorting is optional. Its built-in announcer is fine. |
| Stale result (#27) | `usa-tag` "Changed since last check" | |
| Help (#32) | `usa-in-page-navigation`; `usa-process-list` for "Open, edit, check, export"; `usa-icon-list` for known limits | Use in-page navigation **only on Help**. In the editor it would add a third column. |
| Feedback (#32) | A link with visible "(opens in a new tab)" text and the warning next to it | |
| Avoid everywhere | `usa-tooltip` (hover/focus only, hides help, poor on touch; use `usa-hint`), `usa-language-selector` (English only), `usa-step-indicator`, `usa-range`, `usa-input-mask` | |

**The tree: the least custom it can be.** USWDS has no tree, and #23 requires arrow keys with correct roles, so the tree has to be the WAI-ARIA APG treeview. Reuse as much as possible:

- `usa-sidenav` spacing and its current-item bar for the look.
- `usa-icon` `expand_more`/`navigate_next` for the twisty, with `aria-hidden`.
- `usa-tag` for the class.
- `usa-icon error` plus text for problems.
- `usa-sr-only` for the extra spoken text.

The custom parts are the `role=tree/treeitem/group` markup, the roving tabindex, the key handler and the virtualization. The mockup marks them with `data-custom-component="treeview"` and a visible note in a "Custom parts" legend on the Help page, so #30 can list them.

## 3. Wording (plain language, to agree in #9 and #32)

- **Alpha site alert:** "**Alpha.** This is a test version of the Data.gov inventory editor. It may change, and it may have problems. [Give feedback]"
- **First-visit notice** (`usa-alert--info` on Start): "**Your catalog stays in this browser.** Files you open are not uploaded, and nothing you enter is sent anywhere. The editor keeps your working copy in this browser on this device only. It is not backed up, and it is lost if you clear this browser's site data. To keep your work, export it. You can clear it from this browser at any time with **Clear my data**."
  - Recommendation: show this notice **on every visit to Start**, not only the first. A "seen" flag would have to be stored somewhere other than the working copy, which conflicts with "store nothing outside the working copy" (#28). See the open questions.
- **Advisory check disclaimer** (on check results, the export warning and Help; #9, #27, #32): "**This is an advisory check, not the official Data.gov validator.** It compares your catalog with the DCAT-US 3.0 schema (GSA/dcat-us, version of 7 October 2026, commit 4996591), in your browser. Passing this check does not mean Data.gov will accept your catalog."
- **No problems found:** "The advisory check found no problems." Never say "Valid" or "Approved".
- **Save status:**
  - "Saving…"
  - "Saved in this browser at 2:41 PM"
  - "**Not saved.** Your latest changes are only in this tab."
- **Restore or discard:** heading "**Continue where you left off?**" Body: "This browser has a working copy of *Department of Example Affairs catalog* (3,214 datasets), last saved on November 5, 2026 at 2:41 PM." Buttons: **Restore working copy** / **Discard it**, plus the link "Export it before deciding".
  - Discard confirm: "Discard this working copy? It will be deleted from this browser and cannot be recovered."
- **Clear my data:** heading "**Clear your data from this browser?**" Body: "This deletes your working copy of *Department of Example Affairs catalog* from this browser on this device. It is not backed up anywhere, so you cannot get it back. Export the catalog first if you want to keep it." Buttons: **Export first** / **Clear my data** / **Cancel**.
  - Afterwards: "Your data has been cleared from this browser."
- **Storage unavailable** (`role="alert"`, stays until saving works again): "**Your changes are not being saved.** This browser is not letting the editor save your work. It may be a private window, storage may be full, or site data may be blocked. Your work exists only in this tab until you download it." Button: **Download catalog (.json)**.
- **Second tab:** "**The editor is already open in another tab.** To protect your work, you can only edit in one tab at a time. Go back to the other tab, or close it and select **Try again**."
- **File too large:** "*agency-catalog.json* is 72 MB. The editor can open files up to 50 MB. Your working copy has not changed."
- **Not JSON:** "*catalog.txt* could not be read because it is not valid JSON (problem near line 214). Your working copy has not changed."
- **No DCAT class:** "This file is JSON, but it does not contain a DCAT-US 3.0 catalog, dataset, data service or series. The editor opens DCAT-US 3.0 JSON only. It cannot open data.json (DCAT-US 1.1) files. Your working copy has not changed."
- **Replace working copy:** heading "**Replace your working copy?**" Body: "Opening *new-file.json* will replace your working copy of *Department of Example Affairs catalog* in this browser. To keep it, export it first." Buttons: **Export current copy** / **Replace working copy** / **Cancel**.
- **Export with problems:** "**This catalog did not pass the advisory check.** The check found 27 problems in 9 objects. You can still download the file, but Data.gov may reject it. The file itself is not marked." Buttons: **Review problems** / **Download anyway**. Follow with the disclaimer.
- **Shared objects note** (once, in the export dialog; #22): "12 objects are used in more than one place. DCAT-US 3.0 cannot point to a shared object, so each one is written out in full wherever it is used. If you open this file again, they will be separate copies."
- **Export done:** "Downloaded *department-of-example-affairs-catalog-2026-11-05.json* (31 MB)."
- **Export failed:** "We could not build the file. These objects link back to each other in a loop: *Survey A* → *Series B* → *Survey A*. No file was downloaded."
- **Delete shared object:** heading "**Delete *OSS Data Desk* from 4 places?**" Body: "This contact point is used in 4 places. Deleting it removes it from all of them:" followed by the list. Buttons: **Delete from 4 places** / **Cancel**.
- **Remove link** (no dialog): "Removed *OSS Data Desk* from Contact point. It is still used in 3 other places." Button: **Undo**.
- **Undo:** "Deleted *OSS Data Desk* from 4 places." Button: **Undo**. After undo: "Restored *OSS Data Desk*."
- **Feedback warning:** "Give feedback on GitHub (opens in a new tab). **Do not paste catalog content, personal information or anything sensitive.** Nothing from your catalog is attached."

## 4. Empty, progress and error states

**Progress.** USWDS has no progress bar or spinner. Use the native `<progress>` element: it has the implicit `progressbar` role and needs a `<label>`. Style it with USWDS tokens. Next to it, show text and a **Cancel** button. Progress shows inline, not in a modal, so editing stays possible (#21, #27).

| Screen | Empty | Progress | Error |
|---|---|---|---|
| Start | 3 cards + notice | "Reading *file.json*… 12 of 31 MB", then "Building objects… 1,200 of 3,214 datasets" | too large / not JSON / no DCAT class, shown as `usa-alert--error` above the cards with focus moved to it |
| Restore prompt | n/a | "Restoring working copy…" | stored copy unreadable: "Your saved working copy could not be opened." with *Discard it* |
| Editor tree | blank catalog: "This catalog has no datasets yet. Add one from the catalog's **Datasets** field." Filter with no matches: "No objects match 'xyz'." plus *Clear filter* | n/a | node problem marker |
| Detail pane | "Select an object in the catalog contents to see and edit it." | n/a | error summary + field errors; second tab; storage unavailable |
| Select dialog | "There are no contact points in this catalog yet." plus *Create a new contact point* | n/a | n/a |
| Check results | "This catalog has not been checked yet." plus *Check catalog* | "Checking… 1,250 of 3,214 objects" | check could not run |
| Export | n/a | "Building your file…" | loop or too-deep graph, no file produced |

## 5. Accessibility

**Tree keyboard model** (APG treeview, #23):

- Tab stops on the tree once (roving `tabindex`).
- ↓/↑ move to the next/previous visible node.
- → opens a closed node, or on an open node moves to its first child.
- ← closes an open node, or moves to the parent.
- Home/End go to the first/last node.
- Enter (and Space) opens the object in the detail pane. Selection **doesn't follow focus**, because loading a big form on every arrow press is slow and disorienting.
- Typing a letter jumps to the next matching node.
- Attributes:
  - On the nodes: `aria-expanded`, `aria-selected`, and `aria-level`/`aria-setsize`/`aria-posinset`. The last three are required once virtualized, because most nodes won't be in the DOM.
  - On the tree: `aria-label="Catalog contents"`.
- Each node's spoken name: "*Annual Widget Survey 2025*, Dataset, 2 problems, shared in 3 places". The extra words come from `usa-sr-only` text, not `aria-describedby`, because screen readers handle that on treeitems inconsistently.

**Focus:**

- A dialog opening moves focus to its heading (`tabindex="-1"`).
- Swapping dialog content moves focus to the new heading. *Back* returns focus to the field you came from.
- Closing returns focus to the button that opened the dialog. After *Create* or *Select*, focus goes to the newly added value (#25).
- After a delete, focus goes to the next sibling node, or the parent if there is none (#26). After *Undo*, it goes to the restored item.
- Load errors move focus to the error alert. Error summary links move focus to the field.

**Live regions:** two regions, empty in the page source from load:

- `role="status"` (polite). Announces:
  - "Saved", but not "Saving…", and only after a short pause
  - the filter match count
  - check start, every 25%, and the final count ("Check finished: 27 problems in 9 objects")
  - export done
  - undo messages
  - multi-value reorder ("Moved to position 2 of 4")
- `role="alert"`: storage failure, second tab, export failure.

**Not colour alone:** every error or problem has an icon, the word ("Problem", "Error"), and a count. The required level is shown in words.

**Headings:**

- Each page has one h1. On the editor it is "Edit catalog", with the catalog title as text.
- h2: "Catalog contents" (tree) and the object heading in the detail pane, for example "Dataset: Annual Widget Survey 2025".
- h3: form sections.
- The dialog uses `usa-modal__heading`, an h2.

**Landmarks:**

- banner (contains `usa-header`). The gov banner and site alert are labelled sections before it.
- `nav` labelled "Primary".
- `main`. Inside it, the tree goes in a `<nav aria-label="Catalog contents">` and the detail pane is a labelled `<section>`.
- contentinfo (footer).

**Reflow at 320px / 400% zoom (1.4.10):**

- The two panes stack. The tree collapses into a disclosure button, "Show catalog contents (3,214 datasets)".
- Tables use `usa-table--stacked`.
- The modal fills the screen width.
- The toolbar buttons wrap.
- Nothing scrolls sideways except the result tables inside `usa-table-container--scrollable`.

**Target size:** at least 24×24 px (the 2.2 AA rule, as good practice). Tree twisties and row actions are at least 44 px tall, like USWDS buttons. Avoid icon-only buttons; where one is unavoidable, give it an `aria-label`.

**What the mockup demonstrates vs what it only notes:**

- **Demonstrates:**
  - the frame and skip links
  - the site alert and notice
  - a working arrow-key tree (mock JS)
  - one modal with content swap, breadcrumb and focus return
  - field errors with icon and text, and the error summary
  - live-region messages
  - the delete confirm and undo
  - all the copy above
  - the stacked layout at 320px
- **Notes only:**
  - virtualization and `aria-setsize`
  - real progress and timings
  - the `beforeunload` warning
  - the two-tab lock
  - screen-reader results and axe CI (#17, #30)
  - forced-colors mode

## Open questions

1. Hostname: will the alpha be on `.gov`? If not, the `usa-banner` claim is misleading and should be dropped.
2. The first-visit notice needs a "seen" flag. Do we store one (in IndexedDB, next to the working copy), or show the notice on every visit to Start (recommended)?
3. File size limit: 50 MB is a placeholder until #29 sets the real number.
4. Second tab: is "Try again" enough, or should the newer tab be able to take over editing (Web Locks)?
5. Field-level schema failures: error (red) or warning (yellow) styling? Red is more accurate against the schema, but may suggest that saving or export is blocked.
6. The feedback route needs a GitHub account. Should we also offer a mail link, and to which address?
7. Should Mandatory fields missing in a dialog's *Create* block creation, or only be flagged (advisory everywhere)?
