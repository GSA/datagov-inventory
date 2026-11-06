# Spec: Data.gov Inventory editor alpha (browser only)

**Revised 2026-11-06 after the team huddle.** The first version of this spec merged a three-round analysis by four sub-agents (users and journeys, IA and routes, catalog data and editing, and USWDS, content and accessibility). Their write-ups are still in `analysis/`. The team reviewed the mockups on 2026-11-06, and this revision carries the decisions they made: see "Decisions from the 2026-11-06 huddle" below and `analysis/huddle-2026-11-06.md`. Where the two disagree, the huddle wins.

Every requirement links to its source in [GSA/datagov-inventory](https://github.com/GSA/datagov-inventory): the epic is #15, its sub-issues are #8, #9 and #16–#32, plus ADR 0002, ADR 0005 and ADR 0010. The schema is GSA/dcat-us `jsonschema/definitions` at commit 4996591 (2026-10-07).

## Decisions from the 2026-11-06 huddle

James (jbrown-xentity) leads product and architecture, so his calls are the decisions. The full notes, with quotes and the impact on each sub-issue, are in `analysis/huddle-2026-11-06.md`.

1. **No modals for select or create.** A class-valued field has an inline combo box to pick an existing object, plus "Create new". Create new **replaces the whole form pane** with the new object's form. The form says what the object is linked to ("Linked to Distribution 'Bridge ratings (CSV)' › Access restriction"), and everything else is blank. One form is open at a time, so forms never stack. "Back to …" returns to the parent, which now shows the new link. This works at any depth without losing anything typed on a parent.
2. **Always show where you are.** The current object is strongly highlighted in the tree, its ancestors open automatically, and a breadcrumb shows the path. A new object appears in the tree at once as "Unnamed distribution" with its problem marker. It is not a draft: it is an object that isn't valid yet, and the user can leave it and come back.
3. **Correct classes per field**, from the DCAT-US 3.0 schema. "Select existing" is not offered where reuse makes no sense; for example, adding a dataset to the catalog is create only (§5).
4. **The "By type" view lists objects.** Each type has a **New** button, and each row has Edit and a trash icon. Delete asks for confirmation and lists every place the object is referenced. There is no drag to reorder: lists are sorted A to Z. The structure view stays the main one.
5. **Autosave, with no Save buttons.** Every edit applies at once and is saved after a 500 ms pause. A small status shows Saving… or Saved. Moving between forms never loses edits.
6. **One editor screen.** There is no Overview / Editor / Check / Export navigation. "Check catalog" and "Export" are buttons on the editor page. The header keeps only Help and Give feedback.
7. **Start page:** import from a file, paste JSON, import from a URL, or start from scratch (a blank catalog run through the same import). After loading, the user goes straight into the editor.
8. **Validation is advisory and never blocks.** Broken files still load. The check runs again after every edit. The red tree markers, the export flow ("Review problems", then "Download anyway") and the blue "advisory check, not the official validator" notice all stay.
9. **DCAT-US 3.0 only.** No 1.1 import and no translation.
10. **Deep links.** Every object has its own hash route. Reloading, sharing, or opening it in a new tab opens the right tree node and form. The editor is one page that switches views by route. On a route change it updates `document.title`, moves focus to the new heading, and announces the change.
11. **No raw JSON editor.**
12. **Scale:** keep the tree filter. Build it, measure with the largest real catalog (DOJ: about 1,800 datasets, 2.4 MB) and a synthetic 3,000, then optimize only if needed.

## 1. What the alpha is

The alpha is a static, browser-only app. A data manager imports a DCAT-US 3.0 JSON file (or pastes JSON, or starts from scratch). They edit its objects in forms generated from the schema, see problems from an advisory check that runs as they type, and download the edited file (#15). Most people will import their existing file, edit a few things, export it, and give the file to their IT team to host where Data.gov can harvest it.

Things the alpha does not have (#15, huddle):
- **Server and accounts:** no login, server, database, audit, upload or sharing.
- **Publishing:** no publish step, and no draft or live states. An object that isn't valid yet is simply marked; it is not a "draft".
- **Other formats:** no data.json 1.1 import or translation, and no JSON-LD.
- **Validation:** the official validator is not used. The check never blocks.
- **Editing extras:** no raw JSON editor, no live JSON preview, no bulk editing, and no "what changed since load" (see Future).
- **Scope:** one working copy at a time.

The catalog lives in browser memory and IndexedDB, and nothing is sent anywhere (#15, #28, #16 CSP). The one exception under discussion is import from a URL (open question 1).

## 2. Personas

| Persona | Needs | Sources |
|---|---|---|
| **Agency data manager / steward** (primary) | Open the agency's 3.0 file, find and fix datasets, run the check, download a clean file. Most catalogs have fewer than 50 datasets; one has 3,000+. | ADR 0002, #23, #27, #29 |
| **Occasional publisher** | Fill in the right fields without reading the standard. Reuse the agency's contact and publisher. | #24, #25 |
| **First-time evaluator** (agency staff, team, ISSO, testers) | Know what the alpha is and isn't, try it, give feedback. | #32 |
| **Keyboard and screen-reader users** | Load, open, edit, create, check and export without a mouse. | #30, #23, #25 |
| **People on shared government machines** | Leave no data behind. Cope when browser storage is blocked. | #28 (AC-12, SC-28) |

## 3. Key flows

| # | Flow | How it works in the mockup | Sources |
|---|---|---|---|
| J1 | First visit | `index.html`: data notice (always shown), then four ways to load | #21, #32 |
| J2 | Import | File, pasted JSON, URL (mocked) or "Start from scratch" all call the same import, save the working copy, and open `editor.html#/` with a load summary. Not JSON, no catalog, and DCAT-US 1.1 are refused with "your working copy has not changed". Invalid 3.0 files load. | #20, #21, huddle |
| J3 | Replace the working copy | Loading while a working copy exists asks first: Export current copy first, Replace, or Cancel | #21 |
| J4 | Return visit | The start page shows "Continue where you left off?" with Continue editing, Download it first, and Discard it. Nothing is restored silently, and continuing is one click. | #28 |
| J5 | Find an object | Tree filter (by title or name); By type lists with their own filter and pages; deep links | #23, #29 |
| J6 | Edit | Type in any field. The tree label, breadcrumb and heading update as you type. The check reruns, and the status goes Saving… then Saved. | #24, #27, #28 |
| J7 | Pick an existing object | In a class-valued field: "Add an existing contact" combo box. Type to filter; each option shows its type, email or format, and "used in N places". | #25 |
| J8 | Create a linked object | "Create new …" creates the object, links it, puts it in the tree, and replaces the form with its form. "Back to …" returns. This nests to any depth: Catalog › Dataset › Distribution › Access restriction. | #25, huddle |
| J9 | Edit a shared object | The header says "Used in 5 places. Changes apply to all of them." "Edit a copy for this one" in the parent's field makes a copy for that field only. | #25, ADR 0005 |
| J10 | Remove or delete | "Remove from this field" unlinks, with Undo. Delete (form header, or the trash icon in By type) asks for confirmation and lists the places that reference the object and any objects only used inside it. Undo restores the last removal. | #26, huddle |
| J11 | Check | The toolbar shows "N problems in M objects". "Check catalog" (`#/check`) lists them by type; each links to the field. | #27 |
| J12 | Export | `#/export`: problem summary first, "Review problems", "Download anyway". The file is built in the browser and downloaded. A loop in links stops the export with the path of the loop. | #22, #27 |
| J13 | Deep link | Copy the address of any form, or open it in a new tab: the same tree node and form open. If another tab saves, the editor asks you to reload. | #23, huddle |
| J14 | Clear my data | Footer button on every page → confirmation (Export first / Clear / Cancel) → start page with "cleared" | #28, #15 |
| J15 | Storage failure | If a save fails: "Your changes are not being saved", with a link to export | #28 |
| J16 | Help and feedback | `help.html`, `feedback.html` | #32 |

## 4. Pages and routes

Five pages, plus one mockup-only page:

| Page | Screen | Main components | Sources |
|---|---|---|---|
| `index.html` | Start | `usa-alert--info` data notice, `usa-summary-box` (continue), `usa-card-group` with file input, textarea, URL input and a button, `<progress>`, error alerts, confirmation dialog | #21, #28, #32 |
| `editor.html` | **The editor** (single page, hash routes) | workspace bar (title, save status), toolbar (problem count, Check catalog, Export), tree or type list, detail pane | #22–#28 |
| `help.html` | Help | `usa-in-page-navigation`, `usa-process-list`, `usa-icon-list` | #32, #29, #30 |
| `feedback.html` | Give feedback | `usa-alert--warning` | #32 |
| `404.html` | Not found | — | — |
| `screens.html` | Mockup only: page and route map | — | — |

**Editor routes** (hash routes, so any static host works without rewrites, #31):

| Route | View |
|---|---|
| `#/` | Catalog form |
| `#/dataset/<id>` | Dataset form |
| `#/dataset/<id>/distribution/<id>/access-restriction/<id>` | The path to an object. Each id must be linked from the one before it; the tree highlights exactly this path. |
| `#/<type>/<id>` | Any object by id. If the path is not a chain of links (an old link, or one typed by hand), the editor replaces it with the object's home path: the first path found from the catalog, breadth first. An object that is not linked anywhere opens under "Not linked anywhere". |
| `…?field=<name>` | Open the object and focus one field (used by check results) |
| `#/type/<type>?page=&q=` | By type list |
| `#/check` | Check results |
| `#/export` | Export |

Type slugs: `dataset`, `series`, `service`, `distribution`, `contact` (Kind), `organization`, `agent`, `access-restriction`, `use-restriction`, `cui-restriction`, `document`, `standard`, `location`, `period`, and so on (`assets/store.js`, `INFO`). Ids are made when a catalog is loaded and saved with the working copy, so links stay valid across reloads and tabs. They are not stable across a re-import.

**On every route change** (huddle, #30): `document.title` becomes "<object> (<type>) | …", focus moves to the new view's `h2`, and a polite `aria-live` region says "Opened distribution: Bridge ratings (CSV)." The first load does not move focus unless the route names a field.

**Page frame on every page** (#16, #32):
- `usa-skipnav`; the editor adds "Skip to catalog contents".
- `usa-banner` (.gov) and the alpha `usa-site-alert--info --slim`.
- `usa-header--basic` with an "Alpha" tag. **Nav: Help, Give feedback.** The logo goes to the editor.
- `usa-footer--slim`: Help, Where your data lives, Give feedback, Clear my data, and the schema version line.
- `usa-identifier`.

**Editor layout** (#23):
- **Workspace bar:** working copy title, save status (`role=status`; icon plus "Saving…", "Saved 3:04 PM" or "Not saved"), "Open another catalog", "Where your data lives".
- **Toolbar:** "Edit catalog", the problem count chip (links to `#/check`; hidden when there are none), **Check catalog**, **Export**.
- **Left (`nav`):** "By catalog structure" (default) or "By type".
  - Structure: a filter (with a polite match count) and a WAI-ARIA treeview rendered from the working copy. The catalog's datasets, series, services and sub-catalogs are groups; other links (publisher, contact point, …) are children of the object that holds them, labelled with the field name. Shared objects appear under every parent that uses them; each copy has its own path. Objects reachable from nothing are grouped under "Not linked anywhere". Groups render 400 rows at a time with a "Show 400 more" treeitem, and the selected row is always rendered.
  - The current row is filled dark blue with a thick left bar, so it is visible at a glance; its ancestors are open and it is scrolled into view. Markers are text plus icon, not colour alone: "⚠ 2" with a screen-reader "problems"; "empty" for objects with nothing filled in.
  - By type: the types with their counts (`usa-sidenav`). The current type is highlighted, with the current object under it.
- **Right (`main`):** one view at a time: an object form, a By type list, the check results, or the export.

**Object form** (#19, #24, #25):
- Breadcrumb of the full path ("Dataset: Regional Bridge Condition Ratings").
- "Linked to <Type> '<parent>' › <field>" bar, with "Back to <parent>". After "Create new" an info alert says the object is new, already linked and listed in the tree, and saves as you type.
- Header: type tag, status tag ("2 problems" or "Nothing filled in yet"), the title (`h2`, the focus target), "Used in N places", and **Delete this …**.
- Sections from `requirementLevel`: **Required** (labels say "(required)"), **Recommended**, **Optional** (filled ones), then a collapsed **More optional fields (N)** accordion. "Other properties (not in DCAT-US 3.0)" are read only and kept on export.
- A required field that is just not filled in yet shows a neutral note ("Not filled in yet."). A wrong value shows a red USWDS error message under the field. Both count in the tree and in the check.
- "Back to <parent>" again at the bottom.

**Field widgets:**
- Dates are text inputs (the schema allows `YYYY`, `YYYY-MM`, dates and date-times).
- Frequency is a `usa-select` with ISO 19115 and Dublin Core optgroups, plus "Other repeating period (R/P…)", which reveals a text input. A value that is not in the list stays selected as "Monthly (not in the list)".
- Multi-value text fields are rows with Move up, Move down and Remove, plus "Add another".
- Concept and Identifier are plain text. A detailed Concept or Identifier object from a file is shown read only and kept.
- **Class-valued fields:** the linked objects as rows (title link, type tag, meta, "Used in N places", problem count; actions Edit, Edit a copy for this one (shared only), Remove from this field). Long lists show the first 25 and link to the By type list. Below them, depending on the field (§5):
  - "Add an existing <class>": a combo box (APG combobox with a listbox popup, not the USWDS combo box, which needs a `<select>` and would hold thousands of options). It shows the first 25 matches A to Z with "Showing 25 of 2,000. Keep typing to narrow down."
  - "or Create new <class>": one button per allowed class (for example "Create new agent", "Create new organization").
  - A single-valued field that is filled shows no add controls: "Holds one … To use a different one, remove this one first."

**By type list** (`#/type/<type>`): heading with count, **New <type>**, a filter, then a table (Name with meta, Used in, Check, Edit, trash icon) sorted A to Z with unnamed objects last and creation order as a tie-breaker. 50 per page with `usa-pagination`. "New" adds a dataset, series or data service to the catalog; any other new object is not linked anywhere until it is picked in a field.

**Check view** (`#/check`): the blue advisory notice; the totals; problems grouped by type (each row links to `#/…?field=`); "Not checked by the schema" for blank values; "Continue to export". There is no "Run check" step and no "out of date" state, because the check always reflects the latest edit.

**Export view** (`#/export`): the problem summary first (warning alert listing objects and fields), the advisory notice, the shared-objects note, the file name, then "Review problems" and "Download anyway" (or "Download catalog"). A real JSON file is downloaded. If links form a loop, an error names the loop and no file is made.

**Confirmation dialog:** a native `<dialog>` styled like the USWDS modal, used only for destructive actions: delete, replace working copy, discard, and clear my data. Focus starts on Cancel and returns to the opener.

## 5. Data rules the mockup follows

- **Working copy:** flat objects `{id, cls, data, extra}`; class-valued fields hold ids. In IndexedDB there is one record per object (#28). An autosave writes only the objects that changed.
- **Import** (one path for everything, #21): parse, refuse non-JSON, refuse a top level that is not a catalog, refuse DCAT-US 1.1 (`conformsTo` names the 1.1 schema). Then walk the JSON using the schema: each object in a class-valued field becomes an object, picking Organization or Agent by `@type` where the field allows both. Unknown properties are kept as "Other properties". A non-object in a class-valued field is kept as is and reported as a problem.
- **Identical objects are not merged** (#20), **except objects with the same `@id`**, which are one object (open question 3). The sample's shared contact and publisher are written with `@id`s, so sharing survives an export and a re-import. The generated large catalog writes its contact out again in every dataset with no `@id`, like the real export, so it loads as 2,000 separate contacts.
- **Export** writes every linked object out in full wherever it is used (#22, ADR 0005), keeps `@id` and extra properties, and stops with a loop error if links form a cycle.
- **Which classes a field may hold** come from each property's `$ref` in the schema (`assets/schema.js`, built by `tools/build-schema.py`). Agent-typed fields also accept an Organization, because an Organization has the one property an Agent requires (`name`) and no class forbids extra properties. Concept and Identifier are strings or objects in the schema; the mockup edits them as text.
- **Which fields offer "pick existing", "create new", or both** cannot come from the schema, so it is a small rule in `assets/store.js` (`linkMode`). It belongs in #19's override file:
  - **Create new only:** the catalog's datasets, series, services, sub-catalogs (`catalog`, `hasPart`) and records; a dataset's `distribution`, `sample` and `metadataDistribution`; and value-like classes (Period of time, Checksum, Address, Relationship, Attribution, Quality measurement, Catalog record).
  - **Pick existing only:** any other field that holds a Dataset, Dataset series or Data service (`servesDataset`, `seriesMember`, `first`, `last`, `source`, `accessService`, …). Those objects belong to the catalog's own lists.
  - **Both:** everything else: contacts, organizations, agents, documents, standards, locations, access, use and CUI restrictions, concept schemes, activities, metrics, and data dictionaries (`describedBy`).
- **The advisory check** (`assets/store.js`, `validate`) is a small hand-written check, not the schema validator. It covers:
  - required properties that are missing (a problem) or blank, such as `""` or `[]` (a "not checked by the schema" note);
  - date patterns;
  - web addresses with a scheme (`format: "iri"`);
  - `hasEmail` against the schema's `mailto:` pattern;
  - frequency against both lists plus `R/P…`;
  - a single-valued class field holding several values.
  It runs on every object at load and on the edited object after each edit.
- **Delete** removes the object from every field that references it, and also deletes the objects that would be left referenced only by deleted objects. The dialog lists both. Undo restores a snapshot of everything the last removal touched.
- **Sorting:** A to Z by display name, case-insensitive with natural numbers, unnamed last, then creation order. This is used in By type lists and combo box options.
- **Display names:** the class's title property (title, `fn`, name, prefLabel, restriction status, …), otherwise "Unnamed <class>".
- **Sample data** (`assets/samples.js`, fictional): the 9-dataset Department of Example Affairs sample with 4 prepared problems (a bad date, "Monthly", an email without `mailto:`, a download URL with no scheme) and one blank required description. OSS Data Help Desk is used in 5 places and the Office of Sample Statistics in 10. The large catalog is generated in the browser from a fixed seed: 2,000 datasets, 9,966 objects, 2.7 MB of JSON, with 49 planted problems.

### Field → class mapping

Generated from `assets/schema.js` by the mockup's own rules. "Holds" lists the classes offered; "Offered" is the link mode.

| Class | Field | Holds | How many | Offered |
|---|---|---|---|---|
| Catalog | `catalog` | Catalog | many | Create new only |
| Catalog | `contactPoint` | Contact | many | Pick existing or create new |
| Catalog | `dataset` | Dataset | many | Create new only |
| Catalog | `datasetSeries` | Dataset series | many | Create new only |
| Catalog | `record` | Catalog record | many | Create new only |
| Catalog | `service` | Data service | many | Create new only |
| Catalog | `themeTaxonomy` | Concept scheme | many | Pick existing or create new |
| Catalog | `conformsTo` | Standard | one | Pick existing or create new |
| Catalog | `creator` | Agent or Organization | many | Pick existing or create new |
| Catalog | `hasPart` | Catalog | many | Create new only |
| Catalog | `publisher` | Agent or Organization | one | Pick existing or create new |
| Catalog | `rightsHolder` | Organization | many | Pick existing or create new |
| Catalog | `spatial` | Location | many | Pick existing or create new |
| Catalog | `temporal` | Period of time | many | Create new only |
| Catalog | `homepage` | Document | one | Pick existing or create new |
| Catalog | `qualifiedAttribution` | Attribution | many | Create new only |
| Dataset | `sample` | Distribution | many | Create new only |
| Dataset | `supportedSchema` | Dataset | one | Pick existing only |
| Dataset | `contactPoint` | Contact | many | Pick existing or create new |
| Dataset | `distribution` | Distribution | many | Create new only |
| Dataset | `first` | Dataset | one | Pick existing only |
| Dataset | `hasCurrentVersion` | Dataset | one | Pick existing only |
| Dataset | `hasVersion` | Dataset | many | Pick existing only |
| Dataset | `landingPage` | Document | one | Pick existing or create new |
| Dataset | `previousVersion` | Dataset | one | Pick existing only |
| Dataset | `qualifiedRelation` | Relationship | many | Create new only |
| Dataset | `describedBy` | Distribution | one | Pick existing or create new |
| Dataset | `metadataDistribution` | Distribution | many | Create new only |
| Dataset | `conformsTo` | Standard | many | Pick existing or create new |
| Dataset | `contributor` | Agent or Organization | many | Pick existing or create new |
| Dataset | `creator` | Agent or Organization | one | Pick existing or create new |
| Dataset | `hasPart` | Dataset | many | Pick existing only |
| Dataset | `publisher` | Organization | one | Pick existing or create new |
| Dataset | `replaces` | Dataset | many | Pick existing only |
| Dataset | `accessRestriction` | Access restriction | many | Pick existing or create new |
| Dataset | `cuiRestriction` | CUI restriction | one | Pick existing or create new |
| Dataset | `useRestriction` | Use restriction | many | Pick existing or create new |
| Dataset | `rightsHolder` | Organization | many | Pick existing or create new |
| Dataset | `source` | Dataset | many | Pick existing only |
| Dataset | `spatial` | Location | many | Pick existing or create new |
| Dataset | `temporal` | Period of time | many | Create new only |
| Dataset | `hasQualityMeasurement` | Quality measurement | many | Create new only |
| Dataset | `page` | Document | many | Pick existing or create new |
| Dataset | `qualifiedAttribution` | Attribution | many | Create new only |
| Dataset | `wasAttributedTo` | Agent or Organization | many | Pick existing or create new |
| Dataset | `wasGeneratedBy` | Activity | many | Pick existing or create new |
| Dataset | `wasUsedBy` | Activity | many | Pick existing or create new |
| Dataset series | `contactPoint` | Contact | many | Pick existing or create new |
| Dataset series | `first` | Dataset | one | Pick existing only |
| Dataset series | `last` | Dataset | one | Pick existing only |
| Dataset series | `seriesMember` | Dataset | many | Pick existing only |
| Dataset series | `publisher` | Agent or Organization | one | Pick existing or create new |
| Dataset series | `spatial` | Location | many | Pick existing or create new |
| Dataset series | `temporal` | Period of time | many | Create new only |
| Data service | `contactPoint` | Contact | many | Pick existing or create new |
| Data service | `servesDataset` | Dataset | many | Pick existing only |
| Data service | `conformsTo` | Standard | many | Pick existing or create new |
| Data service | `creator` | Agent or Organization | many | Pick existing or create new |
| Data service | `publisher` | Agent or Organization | one | Pick existing or create new |
| Data service | `accessRestriction` | Access restriction | many | Pick existing or create new |
| Data service | `cuiRestriction` | CUI restriction | one | Pick existing or create new |
| Data service | `useRestriction` | Use restriction | many | Pick existing or create new |
| Data service | `rightsHolder` | Organization | many | Pick existing or create new |
| Data service | `spatial` | Location | many | Pick existing or create new |
| Data service | `temporal` | Period of time | many | Create new only |
| Data service | `hasQualityMeasurement` | Quality measurement | many | Create new only |
| Data service | `qualifiedAttribution` | Attribution | many | Create new only |
| Data service | `wasUsedBy` | Activity | many | Pick existing or create new |
| Distribution | `accessService` | Data service | many | Pick existing only |
| Distribution | `accessRestriction` | Access restriction | many | Pick existing or create new |
| Distribution | `cuiRestriction` | CUI restriction | one | Pick existing or create new |
| Distribution | `describedBy` | Distribution | one | Pick existing or create new |
| Distribution | `useRestriction` | Use restriction | many | Pick existing or create new |
| Distribution | `conformsTo` | Standard | many | Pick existing or create new |
| Distribution | `hasQualityMeasurement` | Quality measurement | many | Create new only |
| Distribution | `page` | Document | many | Pick existing or create new |
| Distribution | `checksum` | Checksum | one | Create new only |
| Contact | `address` | Address | many | Create new only |
| Organization | `subOrganizationOf` | Organization | many | Pick existing or create new |
| Document | `creator` | Contact | many | Pick existing or create new |
| Document | `conformsTo` | Standard | many | Pick existing or create new |
| Document | `corporateCreator` | Organization | many | Pick existing or create new |
| Document | `publisher` | Organization | many | Pick existing or create new |
| Standard | `inScheme` | Concept scheme | one | Pick existing or create new |
| Location | `inScheme` | Concept scheme | one | Pick existing or create new |
| Attribution | `agent` | Agent or Organization | one | Pick existing or create new |
| Quality measurement | `isMeasurementOf` | Metric | one | Pick existing or create new |

## 6. Content decisions

The exact wording is in the pages. The rules behind it:
- **Advisory disclaimer** on Check, Export, Help and the footer. It says "not the official Data.gov validator", names the schema commit, and says passing does not mean Data.gov will accept the file (#9, #27, #32). The team liked it; keep it.
- **Wording:** "problems", not "errors". Never say "Valid", "Approved" or "Draft". A new object is "Unnamed distribution"; one with nothing filled in is "empty".
- **Save status** is small and quiet: Saving…, Saved <time>, Not saved. No toasts.
- **Removal and delete** messages are slim success alerts with an Undo button that never hide themselves (WCAG 2.2.1, #26).
- **Feedback** warns not to paste catalog content. Nothing is attached (#32).

## 7. What the sub-agents debated (first round), and what the huddle changed

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

Superseded by the huddle:
- **Select or create in a single-level dialog:** replaced by the inline combo box and the replace-the-pane form.
- **Load summary as a state of the Overview:** there is no Overview. The summary is a success alert at the top of the editor after loading.
- **Export as a page:** it is a view on the editor page.
- **Check results with "out of date":** the check reruns on every edit.
- **"Show next 50" tree item:** it is now 400 per batch, because the real tree renders 2,000 rows quickly. It is still a treeitem, not a button.
- **Restore page:** it is a "Continue where you left off?" box on the start page.
- **Second-tab lock** (`in-use.html`): replaced by a "changed in another tab, reload" notice, because deep links open new tabs (open question 6).

## Open questions

1. **Import from a URL (#21):** fetching a file from the browser conflicts with #15 ("no catalog content leaves the browser" is about content, but the CSP in #16 forbids *any* network connection) and with CORS on agency servers. Options: allow `connect-src` for imports only; fetch through a proxy (but there is no server in the alpha); or drop it. The mockup shows the card but makes no request.
2. **Working set (huddle idea):** let the user pick the handful of datasets they are editing and show only those. Undecided. Measure first (#29).
3. **Identical objects (#20):** the mockup treats objects with the same `@id` as one object. Is that right, and should loading also "simplify" repeated contacts with no `@id`? James hoped IndexedDB would, but #20 says never merge.
4. **Lazy loading (huddle idea, #29):** load only part of a very large catalog from IndexedDB and more on search or filter. Undecided. The mockup loads everything; 2,000 datasets open in about 0.5 s.
5. **Limits for very large catalogs (huddle idea):** lower limits for the public alpha, or advice to split very large catalogs.
6. **Two tabs (#28 vs deep links):** #28 says a second tab must not open the copy for editing, but the huddle wants links to open in new tabs. The mockup lets both tabs open; when one saves, the other is told to reload. Last write wins per object.
7. **An empty Distribution is valid.** DCAT-US 3.0 requires no Distribution fields, so a new "Unnamed distribution" has no problem marker. The mockup marks it "empty" instead. Should the editor flag it (for example, no download or access URL)? That would go beyond the schema.
8. **Link modes (§5)** are the mockup's judgment. Check them with the team, especially pick only for `accessService` and `servesDataset`, and both for restrictions and data dictionaries. They need a home in #19's override file.
9. **Agent vs Organization:** Agent-typed fields offer both, because an Organization satisfies the Agent schema. Confirm with the dcat-us maintainers.
10. **Loops on export:** links such as Distribution › access service › serves dataset can loop back. Because DCAT-US 3.0 JSON writes linked objects in full, a loop can't be written and export stops. Should cross references to catalog members (datasets, services, series) be written as `@id`-only references instead? That would fail the schema's required fields.
11. **Router (#16):** TanStack Router or React Router, hash or `pushState`. The mockup uses hash routes, which need no server rewrites (#31).
12. **Undo (#26):** not discussed in the huddle. The mockup keeps undo of the last removal or delete, as #26 asks.
13. **Feedback by email:** which address? GitHub needs an account (#32).
14. **Hosting:** if a non-.gov host (GitHub Pages) is chosen, drop the gov banner (#31).
15. **Validator API vs the browser check** (#9 comment by sanason): calling the public validator would send catalog content off the device. The huddle kept the in-browser advisory check.
16. **Location geometry (GeoJSON):** the mockup shows `bbox`, `centroid` and `geometry` as text areas, which is close to a raw JSON editor for one field. Is that acceptable, or should geometry be read only?
17. **Treeview pattern (#30):** the mockup uses a nested ARIA tree with `aria-level`, built from the data on each change. axe now passes on every view. Manual screen-reader testing is still needed.

## Future (not in the alpha)

From the huddle; don't build these yet:
- **What changed since load:** list or mark everything changed since the catalog was opened (needs a load-time snapshot).
- **Review and commit versions:** batch the autosaved changes, review them, and commit them as a new version of the catalog. This is easier once there is a server database.
- **Logged-in users and sharing:** catalogs shared with users or with other catalogs (sub-agency catalogs nested in an agency catalog), an editor role, and collaborative editing, along the lines of Touchpoints.
- **Publish from inventory:** harvest directly from inventory, with the catalog published at a public URL.
