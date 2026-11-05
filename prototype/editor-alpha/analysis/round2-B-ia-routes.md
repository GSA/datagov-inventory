# Round 2, analyst B: IA and routes (refined)

## 1. Critique

**A (journeys).** A has the strongest coverage: J1–J18 track the issues closely. Gaps:
- **No hub.** Load summary goes straight to the Editor, and nothing afterwards shows counts, check status and save status together.
- **Export as a dialog** (J14) has to hold a long error summary, the shared-object note and the loop error. A page fits that better.
- **J11 prompts when typing starts.** That interrupts the user and has an ambiguous trigger (A's own open question 3).
- **"Used by 47 datasets" just after a load is wrong.** Loading never merges objects (#20, #15), so a fresh load has no shared objects.
- **"Export first" from the discard confirm** only works as a direct "Download it as a file".

**C (data and editing).** I adopt C's form sections, widgets and sample. Gaps:
- **The 9-dataset sample cannot show scale** (#23, #29). It needs a large variant (conflict 6).
- **Required fields use an asterisk only.** Visible words are better (#30).
- **Auto-opening Optional when a field is filled** makes the form jump. Auto-opening on error is enough.
- **The override file is new scope against #19.** It needs a decision from the #19 owner.
- **C doesn't say which values become tree nodes.** String-form Concept and Identifier values are not nodes.

**D (USWDS and accessibility).** I adopt D's components, wording, focus and live regions. Gaps:
- **The nav has no hub and no Export.** "Start", with a catalog open, is really the replace path.
- **D assumes a single editor page.** A static mockup needs one file per class.
- **D lists the two-tab lock as "notes only".** A static page is cheap, so show it.
- **"Data.gov may reject it"** implies the alpha submits files. It doesn't, so drop that clause.

**Corrections to my round 1:**
- `data.html` and `about.html` are dropped and folded into Help, modals and the footer.
- The "2,906 uses" figure is withdrawn.

## 2. Firm decisions

**(a) The frame is static HTML copied into every page.** No JS injection, in this order:
1. `usa-skipnav`, plus "Skip to catalog tree" on editor pages
2. `usa-banner`
3. Alpha `usa-site-alert--info --slim`, with the feedback link
4. `usa-header--basic` with the Alpha `usa-tag`
5. Save status, a `role="status"` link to `help.html#your-data`
6. On editor pages, tree `nav` then `main`; elsewhere, just `main`
7. `usa-footer--slim` (Help, Where your data lives, Feedback, Clear my data), then `usa-identifier`

Nav with a catalog loaded: **Overview · Editor · Check results · Export · Help**. With none: **Start · Help**.

**(b) States.** Every page renders its default state with no JS.
- **Separate files** for journey destinations, gates and major #30 axe targets: restore, second tab, Dataset with errors, check results, export.
- **JS toggles** (`?state=` read by `assets/mock.js`) for transient feedback on the same screen: errors, progress, alerts and modals. `index.html` deep-links every state.

**(c) The hub is `workspace.html`, the Overview.** Loads and restores land there, the logo links there, and Check results and Export link back to it.

**Editor layout:**
- **Toolbar** (a `div` with a heading, not `role=toolbar`): view switch (`usa-button-group--segmented`), Check catalog, Export, Undo last removal (only while available), Clear my data.
- **Tree:** a custom ARIA tree in `nav[aria-label="Catalog contents"]` with a search-input filter and a polite match count.
  - Views: **By catalog structure** (the default, #23) and **By type** (#20 comment).
  - Groups use sentence-case schema labels, e.g. "Datasets (9)".
  - Large groups render 50 items, then a last *treeitem*, "Show 50 more datasets (51–100 of 3,214)". It moves focus to item 51.
  - A link after the tree, "View all as a table", goes to `editor/list.html`.
  - Tree links carry `?focus=tree` so `mock.js` can restore focus after the reload (D).
- **Detail pane:** `main`, containing:
  - `usa-breadcrumb`, following the active view
  - Object header: class tag, "Used in N places" (expands to a table), check tag, Check this object, Delete
  - C's sections: **Required**, **Recommended**, **Optional fields (n, k filled)** (accordion, opens on error), **Other properties (not in DCAT-US 3.0)** (read-only)

## 3. Route table (20 HTML files)

All state names are JS toggles (decision b).

| Route | Screen | Purpose | Key contents and states | Components | Source |
|---|---|---|---|---|---|
| `index.html` | Screen map | Every page and state | Links by journey J1–J18 | `usa-collection` | brief |
| `start.html` | Start | No copy; replace path | Notice on every visit; 3 cards. States: `progress`, `too-large`, `not-json`, `no-dcat`, `dcat-11`, `replace-confirm`, `cleared` | `usa-card-group`, `usa-file-input`, `<progress>`, alert, modal | #21, #28, #32 |
| `paste.html` | Paste JSON | Load pasted text | Keeps text on error. States: `not-json`, `no-dcat`, `progress`, `replace-confirm` | `usa-textarea`, alert, modal | #21 |
| `restore.html` | Continue where you left off? | Return gate | Restore / Discard / Download. States: `discard-confirm`, `restoring`, `unreadable` | `usa-summary-box`, modal | #28, #30 |
| `in-use.html` | Open in another tab | Two-tab lock | Try again | alert | #28 |
| `workspace.html` | Overview (hub) | Home | Catalog card, counts by class, check status, actions (Add dataset, Check, Export, Open another catalog, Clear my data). States: `loaded`, `large`, `stale-check`, `storage-failed`, `clear-confirm`, `empty` | `usa-summary-box`, `usa-table`, `usa-card`, modal | #21, #27, #28 |
| `editor/catalog.html` | Catalog | Root form | Fallback label "Untitled catalog"; title hinted to the top. State: `blank` | tree, form, accordion | #21, #23, #24 |
| `editor/list.html` | Class list | Browse 3,214 (large variant) | `?type=`; 50 per page, filter, Add | `usa-table--sortable`, `usa-pagination` | #23, #29 |
| `editor/dataset.html` | Dataset D5 | Main edit flows | contactPoint (used in 5 places, Edit a copy), publisher (Organization only), distributions, keyword rows. States: `select`, `create`, `create-nested`, `copy-made`, `removed-link`, `storage-failed` | modal content swap, `usa-breadcrumb`, `usa-radio--tile`, `usa-combo-box` | #24–#26, #28 |
| `editor/dataset-errors.html` | Dataset D1 with problems | Fix-errors destination | Error summary; date, frequency and email errors; Optional open | `usa-form-group--error`, `usa-error-message`, `usa-icon` | #27, #30 |
| `editor/distribution.html` | Distribution | Child object | Fallback label; Recommended first; download URL error | `usa-input[type=url]` | #24, #27 |
| `editor/dataservice.html` | Data service | Service | endpointURL list, servesDataset, publisher is an Agent | rows, modal | #25 |
| `editor/series.html` | Dataset series | Series | "Series IRI" field, ordered members, first and last | rows | #24 |
| `editor/contact.html` | Contact (Kind) | Shared object | "Applies to all 5 places", usage table. States: `delete-shared` (summarised by class, first 10 places), `deleted` (Undo) | `usa-table`, modal `data-force-action` | #25, #26 |
| `editor/organization.html` | Organization | Reused publisher | subOrganizationOf; used in 7 places | form, `usa-table` | #25 |
| `editor/object.html` | PeriodOfTime (generic) | Generic renderer | Start-or-end rule. State: `delete-unused` | form, modal | #19, #26 |
| `check.html` | Check results | Advisory check | Disclaimer; problems by class, deduplicated per object. States: `not-run`, `running`, `clean`, `stale` | `usa-summary-box`, `usa-table`, `<progress>` | #9, #27 |
| `export.html` | Export | Download | File name; shared note once; Review problems / Download anyway. States: `clean`, `exporting`, `done`, `loop-error` | alert, `role=status` | #22, #27 |
| `help.html` | Help | Limits, data, check | About the alpha, known limits, your data, keyboard, custom parts, out of scope | `usa-in-page-navigation`, `usa-process-list` | #29, #32 |
| `feedback.html` | Feedback | Warning before leaving | Sensitive-data warning; GitHub and mail links | alert | #32 |
| `404.html` | Not found | Bad route | Links to Overview and Start | none | brief |

**Journey check (A).** Every step has a route or state:

| Journey | Lands on |
|---|---|
| J1 | `start` |
| J2 | `editor/catalog?state=blank` |
| J3 | `start` progress → `workspace?state=loaded`, plus the `start` error states |
| J4 | `paste` |
| J5 | Overview → `start?state=replace-confirm` |
| J6 | `restore` |
| J7 | Tree → `editor/list` (large variant) |
| J8 | `editor/dataset` |
| J9, J10 | `editor/dataset?state=select`, `create`, `create-nested` |
| J11 | `editor/contact`, or `editor/dataset?state=copy-made` |
| J12 | `removed-link`, `delete-unused`, `delete-shared`, `deleted` |
| J13 | `check` → `editor/dataset-errors` |
| J14 | `export` |
| J15 | `workspace?state=clear-confirm` → `start?state=cleared` |
| J16 | `storage-failed` |
| J17 | `in-use` |
| J18 | `help`, `feedback` |

## 4. Conflicts resolved

1. **Export: page vs dialog** (A, D, and the "export dialog" wording in #22). **Page.** The content is long and links out.
2. **Load summary.** **The hub's `loaded` state**, because the counts table is the same.
3. **Tree view names.** **"By catalog structure"** (default) and **"By type"**.
4. **Shared-edit prompt.** **No interruption while typing.** Use *Edit a copy for this one* on field rows, and a standing notice on the shared object (agreed with D).
5. **Usage counts vs no-merge** (agreed with C). The sample is a **restored working copy** that the user has already linked: Help Desk in 5 places, OSS in 7.
6. **Scale** (agreed with C). The default is C's 9-dataset sample. 3,214 datasets appear only in `workspace?state=large` and `editor/list.html`. That variant has about 3,214 Kind objects and no shared badges.
7. **Names.** "Department of Example Affairs Data Catalog", file `department-of-example-affairs-data-catalog-2026-11-05.json`.
8. **Required marker.** **Visible words**, not an asterisk alone.
9. **First-visit notice.** **Inline on every Start visit**, not dismissible. There is no "seen" flag (#28).
10. **Undo.** **Last link removal or delete only.** Shown as a slim alert that doesn't auto-hide, plus the toolbar button.
11. **Error styling.** **Red for schema failures**, always with "advisory" wording. Empty Recommended fields get an info note.
12. **`usa-banner`.** **Keep it**: cloud.gov and `alpha.inventory.data.gov` are .gov hosts. Drop it only for GitHub Pages.

## Open questions
- Who owns the override file, and does CI keep it current?
- Can the restore page's Download build the file without loading the copy into memory?
