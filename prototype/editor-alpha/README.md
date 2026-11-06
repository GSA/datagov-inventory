# Inventory editor alpha: clickable mockup

**Prototype only.** This is not the editor itself, and nothing here is built or deployed.

This is a static, clickable mockup of the browser-only DCAT-US 3.0 editor alpha ([GSA/datagov-inventory#15](https://github.com/GSA/datagov-inventory/issues/15)). It is plain HTML, CSS and JavaScript on the U.S. Web Design System 3.14.0 (vendored in `vendor/uswds/`). There is no build step, no React, no backend, and nothing to install, and it works offline.

**Revised 2026-11-06 after the team huddle.** The revision is one editor page with hash routes, no dialogs for select or create, autosave, a working By type view, and real import and export. See `SPEC.md` ("Decisions from the 2026-11-06 huddle") and `analysis/huddle-2026-11-06.md`.

## Run it

From this folder:

```sh
./run.sh
```

Then open http://localhost:8000/. The script runs `python3 -m http.server`, so there is nothing to install. To use another port, run `PORT=9000 ./run.sh`.

1. On the start page, use the dashed **"Mockup only: sample data"** box. **Load the 9-dataset sample** goes through the same import as a file.
2. You land in the editor. Everything works on that sample: editing, creating, linking, deleting, checking and exporting.
3. To see the editor at scale, use **Load a generated catalog with 2,000 datasets**. It is generated in the browser, about the size of the Department of Justice catalog.

The working copy is kept in this browser's IndexedDB, so it survives a reload and opens in new tabs. To start over, use **Clear my data from this browser** in the footer.

Use a local server. Opening the files straight from disk is not supported, because browsers limit IndexedDB on `file://`.

## Screens

| File | Screen |
|---|---|
| `index.html` | **Start.** Import from a file (really read in the browser), paste JSON, import from a web address (mocked: no request is made; the sample loads), or start from scratch. Every path uses the same import. Shows "Continue where you left off?" when a working copy exists, and asks before replacing it. Errors: not JSON, no DCAT-US 3.0 catalog, DCAT-US 1.1 refused, file too large. The mockup box has the samples and example pastes. |
| `editor.html` | **The editor**, one page that switches views by hash route. The tree ("By catalog structure") or "By type" is on the left, and one view is on the right. |
| ↳ `#/`, `#/dataset/<id>/…` | Object form for any class, generated from the schema, with a breadcrumb, a "Linked to … › field" bar, Back, and inline pick or create in class-valued fields |
| ↳ `#/type/<type>` | By type list: A to Z, 50 per page, filter, New, Edit, and a trash icon |
| ↳ `#/check` | Advisory check results, always current |
| ↳ `#/export` | Export: problems first, Review problems, Download anyway (a real file) |
| `help.html` | Help |
| `feedback.html` | Give feedback |
| `404.html` | Not found |
| `screens.html` | Mockup only: page and route map, and flows to click through |

**Removed** in this revision (folded into `index.html` or `editor.html`):
- `workspace.html` (Overview), `check.html`, `export.html`
- `start.html`, `paste.html`, `restore.html`, `in-use.html`
- the 11 `editor/*.html` pages: catalog, list, dataset, dataset-errors, distribution, dataservice, series, contact, contact-bridge, organization, object
- `assets/mock.js`

## Flows to click through

1. **Load:** Start → **Load the 9-dataset sample** → the editor opens with a load summary and "4 problems in 3 objects".
2. **Edit a dataset:** tree → **Grants to Local Partners** → type in Title. The tree label and breadcrumb follow as you type, and the status goes Saving… then Saved.
3. **Create, three levels deep, then back twice:**
   1. **Regional Bridge Condition Ratings** → type something in Description.
   2. Dataset distribution → **Create new distribution**. The form is replaced by "Unnamed distribution", which is linked to the dataset and already selected in the tree.
   3. Type a Title, then Access restriction → **Create new access restriction**. You are now at Catalog › Dataset › Distribution › Access restriction, with a "1 problem" marker.
   4. Fill in Restriction status, then **Back to …** twice. Everything you typed is still there.
4. **Pick an existing object:** **Fleet Vehicle Fuel Use** → Contact point → **Add an existing contact** → type "rosa" → Enter.
5. **Edit a copy:** **Grants to Local Partners** → Contact point → **Edit a copy for this one**.
6. **By type:** **By type** → **Contacts** → the trash icon on OSS Data Help Desk → "referenced in 5 places" → Delete → **Undo**.
7. **Check and export:** the problem chip or **Check catalog** → a problem → the field. Then **Export** → **Review problems** or **Download anyway**.
8. **Deep link:** copy the address of any form and open it in a new tab. The same tree node and form open.
9. **Scale:** Start → **Load a generated catalog with 2,000 datasets** → filter the tree ("recidivism by state") → open a dataset → **Add an existing contact** ("Showing 25 of …").
10. **Broken files still load:** Start → **Paste a broken 3.0 catalog** → **Load pasted JSON**.

## Folder contents

- `SPEC.md`: the spec covers the following, each tied to its source issue:
  - the huddle decisions
  - personas and flows
  - pages and routes
  - the editor layout
  - data rules and the field → class mapping
  - open questions and future work
- `analysis/huddle-2026-11-06.md`: the huddle's decisions, the ideas left undecided, and the **impact on each of epic #15's sub-issues**.
- `analysis/` (other files): the first round's sub-agent write-ups (rounds 1–3). They are kept for history; where they disagree with the huddle, the huddle wins.
- `assets/schema.js`: a trimmed DCAT-US 3.0 schema for the editor. For each property it has the label, help text, requirement level, widget, whether it holds several values, and the classes allowed. It is generated by `tools/build-schema.py` from GSA/dcat-us @ 4996591. To rebuild it: `python3 tools/build-schema.py <dcat-us>/jsonschema/definitions <commit>`.
- `assets/store.js`: the working copy and its logic:
  - import and export
  - IndexedDB autosave, one record per object
  - links, usage and home paths
  - link modes
  - the advisory check
  - delete and undo
- `assets/editor.js`: the editor page:
  - the hash router and the accessibility on route change
  - the tree and By type views
  - the generated forms and the inline combo box
  - autosave status
  - the check and export views
- `assets/start.js`: the start page.
- `assets/samples.js`: the 9-dataset sample and the 2,000-dataset generator, both fictional.
- `assets/frame.js`: the announcer, the confirmation dialog, and Clear my data. It is used on every page.
- `assets/app.css`: the few styles USWDS doesn't provide.
- `run.sh`: the one-command local server.
- `vendor/uswds/`: USWDS 3.14.0 `dist` from the `@uswds/uswds` npm tarball.

The static HTML is hand-editable. Every page repeats the same banner, header and footer, so change those on all pages together.

All data is fictional (Department of Example Affairs and Department of Example Justice, example.gov).

## Checks run on this revision

- **Scripted click-through** (headless Chrome via Playwright, not committed): every flow above, plus these, ended with no JS errors:
  - start-page errors, start from scratch, and the replace confirmation
  - URL import
  - tree keyboard (Home, arrows, Enter)
  - unlinked objects
  - Edit a copy, multi-value reordering, and undo of an unlink and of a delete
  - an exported file re-checked for the new distribution and its access restriction
- **Scale** (generated 2,000 datasets, 9,966 objects, in Chrome on a laptop):
  - load to editor: about 0.5 s
  - reload or deep link: about 0.2 s
  - tree filter: about 0.25 s
  - edit to Saved: about 0.5 s, which is the debounce
  - check: 30 ms
  - export: a 3.6 MB pretty-printed file
- **axe (WCAG 2.1 A/AA)** on the start page, the catalog form, a dataset form, a By type list, check, export, help, feedback, the screen map and 404: no violations.

## Open questions

See `SPEC.md` "Open questions" for the full list (17). The main ones:

1. Import from a URL conflicts with the CSP and "nothing is sent anywhere" (#21, #16).
2. Working set and lazy loading for very large catalogs: undecided; measure first (#29).
3. Should objects that share an `@id` be one object on load, and should repeated contacts be merged (#20)?
4. One-tab lock (#28) vs deep links that open new tabs.
5. A blank Distribution is valid in DCAT-US 3.0. Should the editor flag it anyway?
6. Link modes (create only, pick only, or both) need a home in #19's override file.
