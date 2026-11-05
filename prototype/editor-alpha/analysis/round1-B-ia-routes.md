# Round 1, analyst B: information architecture and routes

## 1. Principles

- **One working copy, so there is one "app context".** Every route except start, restore, help, about, feedback and 404 assumes a catalog is loaded. With no working copy, those routes show a "No catalog open" empty state that links to `start.html` (#21, #28).
- **Static-mockup reality.** Each route is one HTML file. Variants of a screen are **states**, selected with `?state=<name>` and toggled by one small shared script (`assets/mock.js`). `index.html` links to every page and every state, so nothing depends on clicking through a long flow. Tree selection is a plain link to the class page, e.g. `editor/dataset.html?id=ds-0042`. In the mockup the id only changes the title and highlight.
- **Modal vs page.** Anything that interrupts a single object or action is a USWDS modal: select-or-create, delete confirm, replace-working-copy confirm, clear-data confirm, edit-shared warning. Anything with long content or that gates entry is a page: restore prompt, check results, export, help. Dialogs are single-level. "Create new" inside a dialog replaces the dialog's content and adds a dialog breadcrumb and Back button, never a stacked modal (ADR 0002, #25).
- **Real-app deep links** (for the build team): a hash router (`#/edit/dataset/<internal-id>`) suits static hosting (#31). The ids are the internal ids that decompose assigns (#20), because `@id` is optional on most classes. A deep link works only in the browser that holds the copy, and the help page says so (#28).

## 2. Global page frame (every page, #16, #32)

1. USWDS **gov banner** ("An official website of the United States government").
2. **Alpha banner**: a USWDS site alert (info, slim) on every page. It reads: "Alpha: an early test version. Your catalog stays in this browser and is not sent anywhere. [Give feedback](feedback.html)" (#32).
3. **Header** (USWDS basic header), from left to right:
   - Title: "Data.gov Inventory editor (alpha)".
   - Nav: **Overview** (`workspace.html`) · **Editor** (`editor/catalog.html`) · **Check** (`check.html`) · **Export** (`export.html`) · **Your data** (`data.html`) · **Help** (`help.html`).
   - With no catalog open, the nav shrinks to Start · Help · About.
4. **Save-status indicator** in the header, right side. It is a `role="status"` live region with icon and text, never colour alone: "Saved 2:41 pm", "Saving…", or "Not saved: storage unavailable". It links to `data.html` (#28, #30).
5. **Main** landmark. On editor pages this is the two-pane layout (section 4).
6. **Footer** (USWDS slim footer plus identifier):
   - Links: About, Help, Feedback, "Clear my data from this browser" (→ `data.html#clear`).
   - Version note: "Advisory check uses DCAT-US 3.0 schema copy @ 4996591 (2026-10-07)" (#27, #32).
   - App version and "No catalog content leaves this browser".

## 3. Dashboard = `workspace.html` ("Catalog overview")

For a single-copy, browser-only editor, the dashboard is the **workspace overview**. It is the home once a catalog is loaded. It shows:

- **Catalog card**: title, file name, loaded date, last change. Links: "Open in editor" and "Start over / load another" (which asks for confirmation, #21).
- **Objects by class** table: Catalog 1, Dataset 3,214, Distribution 9,870, DatasetSeries 12, DataService 4, Kind 41, Organization 6, Location 58, PeriodOfTime 310, Concept 77, Other. Each count links to the class list (`editor/datasets.html?class=…`), which switches the tree to by-class view (#21, #20 comment).
- **Check status**: "Not checked yet", or "Checked 2:30 pm: 37 problems in 21 objects (advisory)" with a link to `check.html`. Stale results after edits are flagged (#27).
- **Save status**, in long form, and the "kept only in this browser" reminder (#28).
- **Quick actions**: Add dataset, Run check, Export, Clear my data.
- **Load summary state**: `?state=loaded` adds a success alert: "Loaded oss-catalog.json: 13,612 objects". This makes the load summary in #21 a state of this page, not a separate screen.
- **Empty state**: `?state=empty` shows "No catalog open" (deep link with no working copy).

## 4. Editor layout and navigation (#23, #24, #20 comment)

**Editor toolbar**, above both panes:

- View switch, as a segmented control (radio buttons): **By catalog hierarchy** | **By class**.
- Tree filter box, "Filter by title or name", with a live result count.
- "Show only objects with problems" checkbox (proposal, built on #23's text markers).
- **Undo last removal** button, enabled after a removal (#26).
- Check catalog and Export shortcuts.

**Left pane: tree.** `nav` landmark "Catalog tree", WAI-ARIA tree pattern, arrow-key operable (#23, #30).

- **By catalog hierarchy**: Catalog → groups by field, then items. Example: `dataset (3,214)`, `datasetSeries (12)`, `service (4)`, `contactPoint (1)`. Each object expands to its own field groups, e.g. Dataset → `distribution (3)`, `contactPoint`, `publisher`, `temporal`. This is jbrown-xentity's "by field, dropdown listing for lists" (#20 comment).
- **By class**: a flat group per class, `Dataset (3,214)`, `Kind (41)`, `Organization (6)` …. Each item appears once (#20 comment).
- **Shared objects** carry a text badge such as "shared, 2,906 uses". They are the same object wherever they appear (#23, #25).
- **Problem markers** are an icon plus text ("2 problems") (#23, #27).
- **3,000+ items**:
  - A big group renders the first 50 items, then two controls: "Show next 50 (51–100 of 3,214)" and "View all as a list". "View all as a list" opens `editor/datasets.html`, a paginated table.
  - The mock items carry `aria-setsize="3214"` and `aria-posinset`, the way a virtualized tree would.
  - Record the real approach (virtualized or lazy loading) in #23. The supported size comes from #29.
- **Filter results** flatten to the matching nodes with their path shown, e.g. "in: Annual Widget Survey 2025 › distribution". Empty state: "No objects match 'xyz'. Clear filter".

**Right pane: detail** (`main`).

- **Breadcrumb**, following the current tree view:
  - By hierarchy: Catalog › Annual Widget Survey 2025 › CSV file.
  - By class: Distributions › CSV file.
- **Object header**: class tag, title, "Used in N places" (expandable list of the places), check status, and actions (Check this object, Delete).
- **Form** generated from the schema, grouped Mandatory / Recommended / Optional (#24).
- Class-valued fields show chips that link to the referenced object. Each chip has "Remove from this field" (#26). The field also offers "Select or create…" (#25).
- A read-only **"Other properties (not in the schema)"** section at the bottom (#24).

## 5. Route map (23 pages)

| Route file | Screen name | Purpose | Key contents / states | Source |
|---|---|---|---|---|
| `index.html` | Screen map (mockup only) | Click into any screen or state | Grouped links to every page × `?state=`; legend; "not part of the product" note | brief |
| `start.html` | Start | Entry with no working copy | First-visit notice (default `?state=first-visit`, dismissible summary box): stays in browser, not sent, not backed up, can be cleared. Three choices: Open a file, Paste JSON, Start a blank catalog. Link to help/limits | #21, #32 |
| `restore.html` | Restore or discard | Gate on return when IndexedDB holds a copy | Catalog title, last saved time, object count; **Restore** / **Discard** (discard confirm modal); nothing restored silently | #28, #30 |
| `in-use.html` | Open in another tab | Second-tab lock | Warning that another tab holds the copy; "Switch to that tab" help; Reload | #28 |
| `load-file.html` | Open a file | Choose or drop `.json`, read locally | File input/drop zone, size limit stated. States: `progress` (progress bar, page usable), `too-large`, `not-json`, `no-dcat-class` (error summary, "working copy unchanged"), `replace-confirm` (modal) | #21, #20 |
| `load-paste.html` | Paste JSON | Same path for pasted text | Textarea, Load button; same error/replace states | #21 |
| `workspace.html` | Catalog overview (dashboard) | Home with a catalog loaded | See section 3. States: default, `loaded` (load summary), `stale-check`, `empty` | #21, #27, #28 |
| `editor/catalog.html` | Editor: Catalog | Root object form | Tree (hierarchy, catalog selected); title/description/publisher/contactPoint/themeTaxonomy… State `blank` (new empty catalog, required markers) | #21, #23, #24 |
| `editor/datasets.html` | Editor: class list | Browse 3,000+ of one class | `?class=dataset` default. Table with title, identifier, distributions, problems, "used in"; filter; sort; USWDS pagination (50/page, "Page 3 of 65"); "Add dataset". Same template for any class | #23, #29 |
| `editor/dataset.html` | Editor: Dataset | Richest form, primary flows | Distribution list (add/reorder/remove), contactPoint chip "shared, 2,906 uses", publisher (Organization), keyword multi-value, enum fields. Modals: `select` (search + usage counts), `create` (Kind form), `create-nested` (dialog breadcrumb Contact point › New contact › New address), `edit-shared` ("Edit for all 2,906" / "Edit a copy for this one"), `remove-link` (undo alert). State `errors` (inline messages and error summary) | #24, #25, #26, #27 |
| `editor/distribution.html` | Editor: Distribution | Child object under a dataset | accessURL/downloadURL/mediaType; accessService select; breadcrumb back to dataset | #23, #24 |
| `editor/dataservice.html` | Editor: Data service | Top-level service | endpointURL, servesDataset (select-existing datasets), mandatory contactPoint/publisher | #23, #25 |
| `editor/dataset-series.html` | Editor: Dataset series | Series and members | seriesMember ordered list (select existing datasets), first/last; note that members are not also in catalog.dataset | #23, #24 |
| `editor/contact.html` | Editor: Contact (Kind) | Shared-object view | "Used in 2,906 places" list (grouped, paginated); fn, hasEmail. State `delete-shared` (modal listing places, confirm), `deleted` (alert with Undo) | #25, #26 |
| `editor/organization.html` | Editor: Organization | Reused publisher | name, subOrganizationOf (select existing Organization), usage list | #25, ADR 0005 |
| `editor/object.html` | Editor: other class (Location) | Proves the generic renderer | Location form generated as-is; "Other properties" read-only section; state `delete-unused` (simple confirm) | #19, #24, #26 |
| `check.html` | Check results | Whole-catalog advisory check | Advisory notice naming schema copy and "not the official Data.gov validator". States: `not-run`, `running` (progress, editing still possible), `results` (grouped by class, accordion, each problem in plain words linking to `editor/…?state=errors#field`), `clean`, `stale` | #27, #9, #32 |
| `export.html` | Export | Download DCAT-US 3.0 JSON | File name preview (`office-of-sample-statistics-2026-11-05.json`); note given once: "shared objects are written in full wherever used". States: `ready`, `has-errors` (summary first, can still download, "did not pass the check"), `loop-error` (names the objects, no file), `exporting`, `done` (announced) | #22, #27 |
| `data.html` | Your data in this browser | Storage and clearing | Save status detail, size used, per-browser/per-device/not-backed-up text, Download a copy, **Clear my data** (confirm modal). States: `storage-failed` (offer download), `cleared` | #28, #32 |
| `help.html` | Help | Task help and limits | Sections with anchors: Getting started, Editing and sharing objects, The advisory check, `#known-limits` (DCAT-US 3.0 JSON only, one working copy, supported size from #29, browsers tested), Your data | #32, #29 |
| `about.html` | About this alpha | Expectations | What alpha means; out of scope (no login, publish, data.json 1.1, live preview); privacy/no network; versions | #15, #32 |
| `feedback.html` | Give feedback | Interstitial before leaving | Warning "do not paste catalog content or sensitive data"; buttons to GitHub issue form and mailto; nothing attached | #32 |
| `404.html` | Page not found | Bad route | Links to Overview/Start | brief |

**Fake data:** "Office of Sample Statistics" (Department of Example Affairs).

## 6. Main click paths

- First visit: `start` → `load-file?state=progress` → `workspace?state=loaded` → `editor/catalog` → tree → `editor/dataset` → contactPoint "Select or create" modal → `check` → `export?state=has-errors` → download.
- Return visit: `restore` → `workspace`.
- Large catalog: `workspace` count link → `editor/datasets` (page 3) → `editor/dataset`.

## Open questions

1. Should the load summary stay a state of the overview (my proposal) or be its own page? Is the overview needed at all, or should the editor's catalog page be home?
2. Breadcrumbs for shared objects reached by different paths: show the path you came by (needs `?from=`), or only "Class › Title"?
3. Does the by-class view include small value classes (PeriodOfTime, Checksum, Concept), or only "entity" classes, with value objects shown inline in forms?
4. Should the frame be injected by JS (one source of truth) or duplicated as static HTML (better for no-JS axe scans of the mockup)?
5. "Show only objects with problems" is not in any issue. Keep it or drop it?
6. Is "Start over / load another" just load-with-replace-confirm, or should it also offer "Export first"?
