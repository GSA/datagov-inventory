# Spec: Data.gov Inventory editor alpha (browser only)

This spec merges a three-round analysis by four sub-agents: users and journeys, IA and routes, catalog data and editing, and USWDS, content and accessibility. Their full write-ups are in `analysis/`. Every requirement links to its source in [GSA/datagov-inventory](https://github.com/GSA/datagov-inventory): the epic is #15, its sub-issues are #8, #9 and #16–#32, plus ADR 0002, ADR 0005 and ADR 0010.

Sources were read on 2026-11-05. All the gh calls worked: `gh issue view 15` with `--comments` printed nothing in this terminal, so it was read with `--json`. No sub-issue has sub-issues of its own. The schema is GSA/dcat-us `jsonschema/definitions` at commit 4996591 (2026-10-07).

## 1. What the alpha is

The alpha is a static, browser-only app. A data manager opens a DCAT-US 3.0 JSON file (or pastes JSON, or starts a blank catalog), then browses and edits its objects in forms generated from the schema. They check the result against the schema in the browser and download the edited file (#15).

Things the alpha does not have (#15):
- **Server and accounts:** no login, server, database, audit or upload.
- **Publishing:** no publish step, and no draft or live states.
- **Other formats:** it does not open data.json 1.1 or JSON-LD.
- **Validation:** it does not use the official validator.
- **Editing extras:** no live JSON preview and no bulk editing.
- **Scope:** one working copy at a time.

The catalog lives in browser memory and IndexedDB, and nothing is sent anywhere (#15, #28, #16 CSP).

## 2. Personas

| Persona | Needs | Sources |
|---|---|---|
| **Agency data manager / steward** (primary) | Open the agency's 3.0 file, find and fix datasets, run the check, download a clean file. Most catalogs have fewer than 50 datasets; one has 3,000+. | ADR 0002, #23, #27, #29 |
| **Occasional publisher** | Fill in the right fields without reading the standard. Reuse the agency's contact and publisher. | #24, #25 |
| **First-time evaluator** (agency staff, team, ISSO, testers) | Know what the alpha is and isn't, try it, give feedback. | #32 |
| **Keyboard and screen-reader users** | Load, open, edit, create, check and export without a mouse. | #30, #23, #25 |
| **People on shared government machines** | Leave no data behind. Cope when browser storage is blocked. | #28 (AC-12, SC-28) |

## 3. Key flows

| # | Flow | Screens (`?state=`) | Sources |
|---|---|---|---|
| J1 | First visit | `start` (data notice shown on **every** visit, never dismissed) | #32, #28 |
| J2 | Blank catalog | `start` → `editor/catalog?state=blank` (Title first; required Datasets shows the neutral note "not filled in yet") | #21, #24 |
| J3 | Open a file | `start` → `?state=progress` → `workspace?state=loaded` (load summary) → `editor/catalog`. Failures: `too-large`, `not-json`, `no-dcat`, `dcat-11`. Each says "working copy unchanged" | #20, #21 |
| J4 | Paste JSON | `paste` (same states; the pasted text is kept after an error) | #21 |
| J5 | Replace the copy | Overview "Open another catalog" → file parses → `start?state=replace-confirm` (Export current copy / Replace / Cancel) | #21 |
| J6 | Return visit | `restore` → `workspace`, or `restore?state=discard-confirm` → `start`. Also: download it before deciding | #28 |
| J7 | Find a dataset | tree filter, the "By type" view, `editor/list` (large: `?state=large`, 50 per page) | #23, #29, #20 comment |
| J8 | Edit a dataset | `editor/dataset`. The tree label updates as you type; the status goes Saving… then Saved | #24, #28 |
| J9/J10 | Reuse or create a linked object | `editor/dataset?state=select` → `create` → `create-nested`. One dialog only: its content is replaced and a breadcrumb plus Back appear | #25, ADR 0002 |
| J11 | Edit a shared object | `editor/contact` ("Used in 5 places. Changes apply to all"). From a field (`?from=`) it also offers **Edit a copy for this one** → `dataset?state=copy-made` | #25, ADR 0005 |
| J12 | Remove, delete, undo | `dataset?state=removed-link`; `object?state=delete-unused`; `contact?state=delete-shared` → `deleted` (Undo, last removal only) | #26 |
| J13 | Check and fix | `check?state=running` → results grouped by type, deduplicated per object → `editor/dataset-errors?state=errors` → `check?state=stale` | #27 |
| J14 | Export | `export` (problem summary first, Download anyway, shared-objects note shown once) → `done`; or `loop-error` (no file) | #22, #27 |
| J15 | Clear my data | footer link (every page) → modal (Export first / Clear / Cancel) → `start?state=cleared` | #28, #15 |
| J16 | Storage failure | `?state=storage-failed` on the overview and editor pages: `role=alert` plus Download catalog | #28 |
| J17 | Second tab | `in-use` (Try again; no takeover) | #28 |
| J18 | Help and feedback | `help` (about, not in alpha, your data, the check, limits, keyboard, custom parts), `feedback` | #32, #29, #30 |

## 4. Route map (22 pages)

| Route | Screen | Purpose | Main components | Sources |
|---|---|---|---|---|
| `index.html` | Screen map | Mockup only: every screen and state | `usa-table` | — |
| `start.html` | Start | Data notice; open a file, paste, or blank | `usa-alert--info`, `usa-card-group`, `usa-file-input`, `<progress>`, `usa-alert--error`, `usa-modal` | #21, #32 |
| `paste.html` | Paste JSON | Load pasted text | `usa-textarea`, `usa-alert`, `usa-modal` | #21 |
| `restore.html` | Continue where you left off? | Restore, discard, or download | `usa-summary-box`, `usa-button-group`, `usa-modal` (forced action) | #28 |
| `in-use.html` | Open in another tab | Two-tab lock | `usa-alert--warning` | #28 |
| `workspace.html` | **Overview (dashboard, the hub)** | Catalog summary, counts by type (links to the editor), check status, "Your data" card, actions. The load summary is the `loaded` state | `usa-summary-box`, `usa-table`, `usa-card`, `usa-tag` | #21, #27, #28 |
| `editor/catalog.html` | Editor: Catalog | Tree plus the root form | custom tree, `usa-button-group--segmented`, `usa-breadcrumb`, form groups, `usa-accordion` | #21, #23, #24 |
| `editor/list.html` | Editor: Datasets list | Table of datasets. Large variant: 3,214 rows with pagination and a tree that loads 50 at a time | `usa-table`, `usa-pagination` | #23, #29 |
| `editor/dataset.html` | Editor: Dataset | Main form, linked objects, select-or-create dialog | `usa-modal--lg`, `usa-radio--tile`, `usa-breadcrumb` (in the dialog), `usa-select` with optgroups | #24, #25, #26 |
| `editor/dataset-errors.html` | Editor: Dataset with problems | Field errors and summary | `usa-form-group--error`, `usa-error-message`, `usa-alert--error`, `usa-icon` | #27 |
| `editor/distribution.html` | Editor: Distribution | A class with no required fields; promoted fields; web address error | as above | #24, #27 |
| `editor/dataservice.html` | Editor: Data service | Endpoint URLs; the publisher field takes an Agent | multi-value rows | #24, #25 |
| `editor/series.html` | Editor: Dataset series | Series IRI field; ordered members | multi-value, linked rows | #24 |
| `editor/contact.html` | Editor: Contact (shared) | Usage list; changes apply to all; delete shared; edit a copy | `usa-accordion`, `usa-table`, `usa-modal` (forced action) | #25, #26 |
| `editor/contact-bridge.html` | Editor: Contact with a problem | Email without `mailto:` | error components | #27 |
| `editor/organization.html` | Editor: Organization | Publisher used in 10 places | — | #25 |
| `editor/object.html` | Editor: any other class (Location) | Generic renderer; delete an unused object | — | #19, #24, #26 |
| `check.html` | Check results | Advisory check: totals, per-type accordions, "not checked by the schema" | `usa-summary-box`, `usa-accordion--bordered`, `usa-table`, `<progress>` | #27, #9, #32 |
| `export.html` | Export | Problem summary first, shared-objects note, download, loop error | `usa-alert`, `usa-button-group` | #22, #27 |
| `help.html` | Help | About, not in the alpha, your data, the check, limits, keyboard, custom parts | `usa-in-page-navigation`, `usa-process-list`, `usa-icon-list` | #32, #29, #30 |
| `feedback.html` | Give feedback | Sensitive-data warning, then GitHub or email | `usa-alert--warning` | #32 |
| `404.html` | Not found | Bad link | — | — |

**Page frame on every page** (#16, #32):
- `usa-skipnav`; editor pages add "Skip to catalog tree".
- `usa-banner` (.gov).
- Alpha `usa-site-alert--info --slim`.
- `usa-header--basic` with an "Alpha" `usa-tag`. Nav: Overview, Editor, Check, Export, Help, Give feedback. Before a catalog is loaded: Start, Help, Give feedback.
- A workspace bar with the catalog title and the save status, which is a `role=status` with an icon plus text.
- `usa-footer--slim`: Help, Where your data lives, Give feedback, Clear my data, and the schema version line.
- `usa-identifier`.

**Editor layout** (#23, #20 comment):
- **Left: tree** `nav` holding a custom ARIA treeview, outside `main`:
  - Views: "By catalog structure" (default) and "By type".
  - Filter by title or name, with a polite match count.
  - Problem markers in text, not colour alone.
  - Shared objects show "used in N places".
  - Unlinked objects get their own group.
- **Right: detail pane** (`main`):
  - breadcrumb
  - object header (type tag, check status, title, usage list, Check this object, Delete)
  - the form.

**Form sections** (#19, #24), generated from the schema's `requirementLevel`:
- **Required:** labels say "(required)"; no asterisk alone.
- **Recommended.**
- **Optional:** a collapsed accordion that opens automatically when it contains an error.
- **Other properties (not in DCAT-US 3.0):** read only, kept on export.

**Field widgets:**
- Dates are text inputs, not the date picker, because the schema allows `YYYY`, `YYYY-MM`, dates and date-times.
- Frequency is the only enum. It is a `usa-select` with ISO 19115 and Dublin Core optgroups, plus "Other repeating period", which reveals a text input for `R/P…`. A combo box can't take free text.
- Multi-value fields are rows with Move up / Move down / Remove and "Add another".
- Fields that hold an object are linked-object rows with Open, Edit a copy for this one, and Remove from this field, plus "Add …: select existing or create new".
- Concept and Identifier are plain text, with a "Use detailed form" toggle.

## 5. Data rules the mockup follows

- **Loading never merges identical objects** (#15, #20). A freshly loaded 3,214-dataset file has about 3,230 contacts, each used once.
  - Shared objects only exist after the user links them with "select existing" (#25).
  - The working copy keeps those shares across a restore (#28, one object per record).
  - Export writes each shared object out in full wherever it is used (#22, ADR 0005).
  - So the detailed sample is shown as a **restored working copy**.
- **Usage counts in the sample:**
  - OSS Data Help Desk: 5 places (4 datasets and 1 data service)
  - Office of Sample Statistics: 10
  - Department of Example Affairs: 3
  - Dr. Rosa Example: 3
- **The advisory check finds 4 problems in 3 objects:**
  - D1 Last modified `03/14/2025`
  - D1 Frequency `Monthly`
  - Bridge contact email without `mailto:`
  - D1 CSV download URL with no scheme
  - Problems are listed once per object, with "affects N places".
- **Blank required values pass the schema** (`""`, `[]`), so they are listed separately under "Not checked by the schema".
- **Field messages are instructions without a path** ("Enter a full web address…"). Summaries add a readable path.
- **Nothing is blocked:** create, export and load all work with problems present (#21, #27).
- **Bulk actions are not in the epic.** The only actions on many items are check-all, delete-shared, edit-shared and export.

## 6. Content decisions

The exact wording is in the pages. The rules behind it:
- **Advisory disclaimer** on Check, Export, Help and the footer: it says "not the official Data.gov validator", names the schema commit, and says passing does not mean Data.gov will accept the file (#9, #27, #32).
- **Undo** is a slim success alert that never hides itself, plus "Undo last removal" in the editor toolbar. There is no toast (WCAG 2.2.1, #26).
- **Wording:** "problems", not "errors". Never say "Valid" or "Approved".
- **Feedback** warns not to paste catalog content. Nothing is attached (#32).

## 7. What the sub-agents debated and how they settled it

| Topic | Positions | Resolution |
|---|---|---|
| Sample size | A: about 3,214 datasets; C: 9 detailed | Both. A detailed 9-dataset sample for every form, plus a separate synthetic large variant (`?state=large`) for scale. Never mix their numbers on one screen. |
| Shared counts | B: "2,906 uses"; A: "47" right after load | Impossible, because loading never merges. The sample is a restored copy in which the user linked objects. C's table is canonical. |
| First-visit notice | A: dismissible, then hidden; D: every visit | Every visit to Start, inline. A "seen" flag would break #28's "store nothing outside the working copy". |
| Load summary | A and D: its own screen; B: a hub state | A state of the overview (`workspace?state=loaded`). |
| Export | A and D: dialog; B: page | A page: the content is long and a page avoids stacked modals. The note is said once on the page. |
| Editing a shared object | A: prompt on the first keystroke | An inline notice before editing, so focus isn't taken mid-typing (WCAG 3.2.2). |
| Required markers | C: asterisk; D: words | Round 3 was unanimous: words ("(required)") plus section headings. |
| Blank required field | C: warning style; A and D: neutral | Round 3 was unanimous: neutral "not filled in yet" until a check runs or the last value is removed. |
| "Your data" and About pages | B dropped them, then changed its mind | Round 3, 3 to 1: drop both. Their content is in `help.html#your-data` and `#about-alpha`; Clear my data is a modal on every page. |
| Loading layout | separate load pages vs a card on Start | Round 3, 3 to 1: file input in a Start card, plus a separate `paste.html`. |
| Frequency widget | D: combo box | A select with an "Other" text input, because a combo box can't take `R/P1M`. |
| Tree "Show next 50" | B: a button inside the tree | A treeitem, because a button inside `role=tree` fails axe. Focus moves to item 51. |
| Frame | B: injected by JS | Static HTML on every page, so landmarks and skip links work without JS. |
| Gov banner | D: only on .gov | Kept: #31 (cloud.gov) and #32 (`alpha.inventory.data.gov`) are both .gov. Drop it if GitHub Pages is chosen. |

## 8. Open questions

1. **data.json 1.1 files:** refuse them explicitly? A 1.1 file may pass the "recognizable DCAT class" test and then load with hundreds of problems. This would extend #20.
2. **Select existing after a large load:** thousands of identical-looking contacts. Group them, or show "Used by …" on each result (as mocked)? Relates to #25 and the out-of-scope merging.
3. **The schema copy can't drive two things on its own.** These need a small override file next to the generator. Who owns it, and does CI check it (#19)?
   - Field grouping and promoted fields, such as Catalog title or Distribution download URL.
   - Single-line vs multi-line text boxes.
4. **`format: "iri"`** isn't checked by ajv-formats by default. Without a custom format, the bad download-URL problem won't appear (#27).
5. **Agent vs Organization:** can Agent-typed publisher fields (Catalog, DataService, DatasetSeries) pick Organizations? The mockup says yes (#25).
6. **Untitled objects:** what labels and file names? The mockup uses "Untitled catalog" and `catalog-YYYY-MM-DD.json` (#22).
7. **Size limits:** 50 MB is a placeholder, and the supported catalog size comes from #29.
8. **Second tab:** is "Try again" enough, or can the newer tab take over (Web Locks)? (#28)
9. **Feedback by email:** which address? GitHub needs an account (#32).
10. **Hosting:** if a non-.gov host (GitHub Pages) is chosen, drop the gov banner (#31).
11. **Validator API vs the browser check** (#9 comment by sanason): calling the public harvest validator from the browser would mean catalog content leaves the device, which conflicts with the CSP and "nothing is sent" promise in #15 and #16. Needs a decision in #9.
12. **Large catalogs:** is `editor/list.html` in alpha scope, or a proposal? It is not in any issue, but it helps at 3,000+ datasets.
13. **Unlinked objects in the hierarchy view:** the mockup groups them as "Not linked anywhere", which no issue covers yet (#23, #26).
14. **Location geometry objects (GeoJSON):** read-only, or a raw JSON textarea?
15. **Treeview and axe:** axe's `label-content-name-mismatch` flags expanded tree nodes whose nested children add visible text. This is known friction with the nested APG pattern. Decide the treatment in #30: `aria-owns`, a flat tree with `aria-level`, or a documented exception.
