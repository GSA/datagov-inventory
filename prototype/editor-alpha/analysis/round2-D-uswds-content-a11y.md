# Round 2, analyst D: USWDS, content and accessibility

Assumes USWDS 3.14.0 is vendored. I messaged A, B and C. C replied, and A's round-2 file adopts my notice, undo and shared-edit positions.

## 1. Critique

### A (users and journeys)

- **J2, blank catalog.** Showing "Datasets" as missing before any check puts error styling on a form the user hasn't touched.
  - Show a neutral note, "Not filled in yet", instead.
  - Switch to error styling only after a check, or after the user removes a field's last value (#26).
- **J11, shared-edit prompt on the first keystroke.** It takes focus mid-typing (WCAG 3.2.2) and is easy to trigger by accident. Replace it with an inline alert in the object header, shown before editing. A has adopted this.
- **J3.** A is right that a data.json 1.1 file can decompose cleanly and then show hundreds of problems. I add copy for refusing it; see conflict 4.
- **J7, filter "matches plus parents".** It hides levels and is hard to follow by ear. Use B's flat list: one level of treeitems, with the path as visible text.

### B (information architecture and routes)

- **"Show next 50" button inside `role=tree`.** This is invalid: a tree may only contain treeitems, so axe flags it (`aria-required-children`).
  - Make it a treeitem: "Show 50 more datasets (51–100 of 3,214)". Enter loads the batch and moves focus to item 51.
  - Put "View all as a table" as a link *after* the tree.
- **Tree selection is a page link.** Each click reloads the page, which throws keyboard users back to the top. `mock.js` must restore focus to the selected treeitem when the URL has `?focus=tree`. The real app updates the pane without moving focus; Enter opens the object.
- **Modals.**
  - `edit-shared` becomes an inline alert.
  - `delete-shared` must not list thousands of places in a modal. Show a summary by class and the first 10, plus a "See all places" link to the usage list.
- **Frame.** Use static duplicated HTML, not JS-injected, so the skip links, landmarks and site alert exist without JS and axe scans what ships.
- **Tree group labels.** Use sentence case: "Contact point", not `contactPoint`.
- **Check accordions.** Accepted. Put the count in each heading, open the first one, and open whichever holds a linked problem.
- **Sortable table with pagination.** `usa-table--sortable` sorts only the rows in the DOM, so sorting across pages has to be custom. Note this on `editor/datasets`.
- **Agreed:**
  - Tree is a `nav` outside `main`, and the detail pane is `main`. I add a "Skip to catalog tree" link.
  - Export is a page, not a dialog. Saying the shared-object note once on the page meets #22.

### C (data and editing)

- **Combo box with free text.** `usa-combo-box` can't take free text. Adopt C's revision:
  - `usa-select` with optgroups "ISO 19115" and "Dublin Core".
  - A last option, "Other repeating period (ISO 8601)", shows a text input. Focus moves to that input.
- **Wording.** A field message is an instruction without the path; the path appears only in summaries.

| C | Rewrite |
|---|---|
| "Title is required." | "Enter a title." |
| "must start with mailto:" | "Start the email with mailto:, for example mailto:bridges@example.gov." |
| "…starting with https://" | "Enter a full web address, starting with https:// or http://." The schema doesn't require https. |
| "must be a list…" | "Enter each keyword separately." |
| "choose a value from the list" | "Choose a frequency from the list. Use “monthly”, not “Monthly”." Show the second sentence only for case-only mismatches. |
| "Temporal coverage 1: give a start…" | "Time period 1: enter a start date, an end date, or both." |

- **Recheck timing.** Recheck on **blur**, not about 1 second after typing stops, so errors don't appear or get announced mid-word.
- **"Use detailed form" toggle.** Make it a `usa-button--unstyled` with `aria-expanded`. Focus stays on it, and the text value carries over into the detailed form.
- **Agreed:** group problems by object ("affects 5 places").

## 2. Components per route (B's routes)

**Frame on every page:**
- `usa-skipnav`, plus "Skip to catalog tree" on editor pages
- `usa-banner`
- `usa-site-alert--info --slim` (alpha label)
- `usa-header--basic` with nav: Overview, Editor, Check, Export, Help, and a Give feedback link
- Save status as plain text, linking to Your data
- `usa-footer--slim`: Your data, Help, Feedback, Clear my data, and the schema-version line
- `usa-identifier`

| Route | Components |
|---|---|
| `start` | `usa-alert--info` notice (not dismissible); `usa-card-group` with 3 cards; `usa-alert--error` for load errors, which receives focus |
| `restore` | `usa-summary-box`; Restore / Discard buttons; "Export it before deciding" link; discard confirm as a `usa-modal` with `data-force-action` |
| `in-use` | `usa-alert--warning` and a Try again button |
| `load-file`, `load-paste` | `usa-file-input` or `usa-textarea` (pasted text kept after an error); native `<progress>` with label, text and Cancel; error alerts; replace modal shown **after** parsing (A §5) |
| `workspace` | `usa-summary-box`; `usa-table` of objects by class; `usa-tag` for check status; load summary as a `usa-alert--success` with `role=status` |
| `editor/*` | Custom ARIA treeview; filter `usa-input type=search` with a match count; `usa-button-group--segmented` with `aria-pressed`; `usa-breadcrumb`; object header with `usa-tag` and usage list; Required and Recommended sections, then an Optional `usa-accordion`; "Other properties" `usa-summary-box`; labels with "(required)" / "(recommended)" in words (agreed with C); repeatable `fieldset` rows; link cards; error summary `usa-alert--error`; inline shared alert `usa-alert--info --slim`; one `usa-modal--lg` for select-or-create (search, `usa-radio--tile` results, breadcrumb and Back when content swaps); delete confirm with `data-force-action` |
| `editor/datasets` | `usa-table--sortable` in `usa-table-container--scrollable`; `usa-pagination` |
| `check` | Disclaimer `usa-alert--info`; `<progress>`; `usa-summary-box`; bordered `usa-accordion` per class |
| `export` | Disclaimer; problem summary; shared-object note; Download button; result `usa-alert` |
| `data` | `usa-summary-box`; storage text; Download; Clear (in a `usa-modal`); storage-failure `usa-alert--error` with `role=alert` |
| `help` | `usa-in-page-navigation`, `usa-process-list`, `usa-icon-list` |
| `feedback` | `usa-alert--warning`; GitHub and mail links with "(opens in a new tab)" |

## 3. Copy deck (final)

The sample uses C's names. "3,214" appears only with `?catalog=large`. Everything not listed here is as in round 1, with the catalog name updated.

- **Alpha:** "**Alpha.** This is a test version of the Data.gov inventory editor. Your catalog stays in this browser. [Give feedback]" (B's idea, shortened)
- **Disclaimer:** "**This is an advisory check, not the official Data.gov validator.** It compares your catalog with the DCAT-US 3.0 schema (GSA/dcat-us, version of October 7, 2026, commit 4996591), in your browser. Passing this check does not mean Data.gov will accept your catalog."
- **Check:**
  - With problems: "Advisory check: 4 problems in 3 objects."
  - With none: "The advisory check found no problems."
- **Restore:** "**Continue where you left off?** This browser has a working copy of *Department of Example Affairs Data Catalog* (9 datasets), last saved on November 5, 2026 at 2:41 PM."
- **No DCAT class:** "This file is JSON, but the editor could not find a DCAT-US 3.0 catalog or dataset in it. Your working copy has not changed."
- **data.json 1.1:** "This looks like a data.json file (DCAT-US 1.1). The alpha opens DCAT-US 3.0 JSON only. [How to get a DCAT-US 3.0 file] Your working copy has not changed."
- **Export with problems:** "**This catalog did not pass the advisory check.** The check found 4 problems in 3 objects. You can still download the file. The file itself is not marked." Buttons: **Review problems** / **Download anyway**.
- **Shared-object note:** "2 objects are used in more than one place. DCAT-US 3.0 cannot point to a shared object, so each one is written out in full wherever it is used. If you open this file again, they will be separate copies."
- **Export done:** "Downloaded *department-of-example-affairs-data-catalog-2026-11-05.json*."
- **Shared-object header:** "**Used in 5 places.** Changes here apply to all of them."
  - Add the **Edit a copy for this one** button only when the user arrived from a referring field.
- **Delete shared:** "**Delete *OSS Data Help Desk* from 5 places?** This contact is used in 4 datasets and 1 dataset series. Deleting it removes it from all of them." Buttons: **Delete from 5 places** / **Cancel**.
- **Remove link:** "Removed *OSS Data Help Desk* from Contact point. It is still used in 4 other places." Button: **Undo**. After undo: "Restored *OSS Data Help Desk*."
- **Before any check:** "Not filled in yet."
- **Non-schema hint** (warning style): "This required list is empty. The schema allows this, but Data.gov may not."

## 4. Conflicts and resolutions

1. **First-visit notice (settled with A and B):** shown on every visit to Start, inline, not dismissible, with no flag.
   - This follows #28: "store nothing outside the working copy".
   - Only people without a working copy reach Start, and Clear my data leads back there, so the repetition costs little.
2. **Undo (settled with A and B):** a persistent `usa-alert--success --slim` with an Undo button and `role=status`, never auto-hidden (WCAG 2.2.1), plus "Undo last removal" in the toolbar.
   - It is one step, covers both remove and delete, and lasts for the session (#26).
   - There is no toast; USWDS has none.
   - Focus after a delete goes to the next tree node. After undo it goes to the restored item.
3. **Gov banner: keep it.**
   - The #31 plan is nginx on cloud.gov (`*.app.cloud.gov`), and #32 names `alpha.inventory.data.gov`. Both are .gov.
   - Drop the banner if a non-.gov host such as GitHub Pages (#31 lists it as a candidate) is chosen. Make that a launch check.
4. **data.json 1.1:** detect it explicitly and refuse it with the copy above. This needs owner sign-off because it extends #20.
5. **Styling:** error style plus advisory wording for schema failures; warning style for non-schema hints only (C).
6. **Create with missing Mandatory fields:** never blocked; the missing fields are flagged inline (A, C).
7. **Required markers:** in words plus section headings, not an asterisk alone (C).
8. **Navigation:** B's set. "Your data" moves to the footer and the save-status link (A).
9. **Still open, for the owners:**
   - the mail address for feedback
   - the 50 MB file limit (#29)
   - whether a second tab can take over editing (Web Locks)
