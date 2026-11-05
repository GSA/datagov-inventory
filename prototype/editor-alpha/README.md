# Inventory editor alpha: clickable mockups

**Prototype only.** This is not the editor itself and nothing here is built or deployed.

These are static, clickable mockups for the browser-only DCAT-US 3.0 editor alpha ([GSA/datagov-inventory#15](https://github.com/GSA/datagov-inventory/issues/15)). They are built with plain HTML, CSS and JS and the U.S. Web Design System 3.14.0, which is vendored in `vendor/uswds/`, so they work offline. There is no build step and no backend. Nothing is really read, saved or sent.

## Run it

From this folder:

```sh
./run.sh
```

Then open http://localhost:8000/. It runs `python3 -m http.server` and needs no installs. To use another port, run `PORT=9000 ./run.sh`. Without the script, `python3 -m http.server 8000` from this folder does the same. Opening `index.html` straight from disk mostly works too, but a local server is more reliable.

Start at `index.html`, the screen map. It links to every screen and every state. Most screens also have a dashed **"Mockup only"** box at the bottom for switching states. Neither the screen map nor those boxes are part of the product.

## Screens

| File | Screen |
|---|---|
| `index.html` | Screen map (mockup only) |
| `start.html` | Start: data notice, then open a file, paste JSON, or start a blank catalog. States include file too large, not JSON, no DCAT class, data.json 1.1 refused, the replace-working-copy dialog, and "cleared". |
| `paste.html` | Paste JSON |
| `restore.html` | Continue where you left off? (restore, discard, or download first) |
| `in-use.html` | Editor is open in another tab |
| `workspace.html` | **Overview / dashboard (the hub).** States: just loaded (load summary), check out of date, storage unavailable, Clear my data dialog, large catalog (3,214 datasets), no catalog open. |
| `editor/catalog.html` | Editor: tree plus catalog form. States: blank catalog, after deleting a dataset, storage unavailable. |
| `editor/list.html` | Editor: all datasets as a table. The large variant has pagination and a tree that shows 50 more at a time. |
| `editor/dataset.html` | Editor: dataset form. States: select-existing dialog, create-new dialog, nested create (breadcrumb in the same dialog), after "Edit a copy for this one", after removing a link (undo). |
| `editor/dataset-errors.html` | Editor: dataset with advisory-check problems shown next to its fields |
| `editor/distribution.html` | Editor: distribution (no required fields; a web address problem) |
| `editor/dataservice.html` | Editor: data service |
| `editor/series.html` | Editor: dataset series |
| `editor/contact.html` | Editor: shared contact used in 5 places. States: delete-shared dialog, after delete with undo. `?from=d5` adds "Edit a copy for this one". |
| `editor/contact-bridge.html` | Editor: contact with an email problem |
| `editor/organization.html` | Editor: organization used in 10 places |
| `editor/object.html` | Editor: generic form for any other class (an unused Location), with delete |
| `check.html` | Check results (advisory). States: not run, running, out of date, no problems. |
| `export.html` | Export. States: no problems, building, downloaded, loop error. |
| `help.html` | Help: about the alpha, what's not in it, where your data lives, the check, known limits, keyboard, custom parts |
| `feedback.html` | Give feedback, with a sensitive-data warning |
| `404.html` | Not found |

## Flows to click through

1. **First visit, open a file:** Start → **Open file** (fake progress) → Overview with load summary → **Open in editor** → pick a dataset in the tree.
2. **Blank catalog:** Start → **Start a blank catalog** → fill in Title.
3. **Returning user:** `restore.html` → **Restore working copy** → Overview.
4. **Reuse or create a contact:** Dataset → **Add contact point: select existing or create new** → **Create a new contact** → **Create a new address** (the dialog content is replaced and a breadcrumb appears; no second dialog) → **Add address** → **Create and add**.
5. **Shared contact:** Dataset → contact row **Open** → "Used in 5 places" → **Edit a copy for this one**.
6. **Remove and undo:** Dataset contact row → **Remove from this field** → **Undo**. Then the contact's **Delete** → "Delete from 5 places" → Undo.
7. **Check and fix:** **Check** → results → a problem link → the field error on the dataset.
8. **Export:** **Export** → problem summary → **Download anyway** → confirmation.
9. **Large catalog:** `workspace.html?state=large` → **Browse datasets** → in the tree, **Show 50 more datasets**.
10. **Clear my data:** footer link → confirm → Start, with a "cleared" message.

Things to try:
- **The tree:** it works with the keyboard (arrows, Home and End, typing a letter, Enter). The filter, the "By type" view, and the narrow-screen disclosure button all work.
- **Fake autosave:** typing in any field flips the status bar to "Saving…" and then "Saved", and editing a title updates the tree label.
- **Check this object:** toggles the prepared problem messages on and off.

## Folder contents

- `SPEC.md`: the merged spec. It covers personas, flows, the route map, components per screen, data rules, the sub-agent debate and open questions, each tied to its source issue.
- `analysis/`: the sub-agents' raw write-ups from rounds 1–3.
- `assets/mock.js`: all the mock interactions:
  - `?state=` switching
  - dialogs and panel swaps
  - fake save and fake progress
  - error toggling
  - the tree keyboard model
  - the filter
  - multi-value rows
- `assets/app.css`: the few styles USWDS doesn't provide: the tree, the two-pane layout, linked-object and multi-value rows, and the mockup-only chrome.
- `run.sh`: the one-command local server.
- `vendor/uswds/`: USWDS 3.14.0 `dist` (css, js, fonts, img), taken from the `@uswds/uswds` npm tarball (sha512 integrity verified).

The pages were written by a small Python generator that is not shipped, so the HTML has a lot of repeated markup. Edit the HTML directly. The schema-driven forms take their labels, help text and required/recommended/optional levels from the DCAT-US 3.0 schema (GSA/dcat-us @ 4996591).

All data is fictional (Department of Example Affairs, example.gov).

## Checks run on these mockups

- **Link crawl:** a headless Chrome crawl of every link (273 page and state URLs) found no broken links and no JS errors.
- **axe (WCAG 2.1 A/AA)** on every page. The only remaining finding is `label-content-name-mismatch` on expanded tree nodes. It comes from the nested ARIA treeview pattern: child items add visible text to the parent's name. It is listed as open question 15 for #30.
- **Interactions:** dialogs, panel swaps, tree keys, the filter, the view switch, errors, rows, progress and the mobile tree were all scripted and checked.

## Open questions

See `SPEC.md` §8 for the full list (15). The main ones:

1. Should data.json 1.1 files be refused explicitly? (#20)
2. How should "select existing" handle thousands of identical-looking contacts after a load? (#25)
3. Who owns the override file for field grouping, promoted fields and multi-line text boxes? (#19)
4. The `iri` format check is needed for web-address problems. (#27)
5. Can Agent-typed publisher fields pick Organizations? (#25)
6. What are the size limits? (#29)
7. Can a second tab take over editing? (#28)
8. What is the feedback email address? (#32)
9. Is the host .gov, so the gov banner stays? (#31)
10. Browser check vs calling the validator API from the browser. (#9 comment)
11. Is the datasets table page in alpha scope?
12. Should unlinked objects get their own tree group?
13. How should the treeview handle the axe label-in-name finding? (#30)
