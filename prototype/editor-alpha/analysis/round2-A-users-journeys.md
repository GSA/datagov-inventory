# Round 2, analyst A: users and journeys

## 1. Critique

**B (IA and routes)**
- **"Shared, 2,906 uses" cannot happen right after a load.**
  - Loads never merge identical objects (#15, #20), and DCAT-US 3.0 has no way to write a reference (#22).
  - So every object in a newly loaded file is used in exactly 1 place. Shares appear only when the user picks "select existing" (#25).
  - Fix the counts in the tree, on `dataset.html` and on `contact.html` (§3.2).
- **Storage failure is only a state of `data.html`.** #28 means the user must be told *where they are editing*. Add a global `?alert=storage-failed` that `mock.js` can switch on for any editor page.
- **Not in any issue:**
  - "Show only objects with problems": drop it, or label it a proposal.
  - `editor/datasets.html`: keep it, labelled a proposal. It is useful at 3,000+ datasets.
- **Agreed:** the overview page as home, export as its own page, restore and in-use as gate pages, and the dialog states.

**C (data and editing)**
- **Agreed:** the 9-dataset sample, and that a usage count above 1 can only come from links the user made in the editor.
- **Gap: duplicates when selecting an existing object.**
  - A freshly loaded 3,000-dataset file holds about 3,000 separate, identical-looking contacts.
  - The search in #25 would list all of them.
  - Each result needs "Used by: *Dataset X*" so they can be told apart (open question 2).
- **Gap: blank catalog title.** `Catalog.title` is Optional, but the tree label and the export file name (#22) need it.
  - The blank state should focus Title, with the hint "Used to name your exported file".
  - The fallback label is "Untitled catalog".
- **Gap: series members.** D8 and D9 sit only under the series, not in `Catalog.dataset`. The tree filter must still find them.

**D (USWDS, content and accessibility)**
- **Agreed and adopted:**
  - the first-visit notice with no "seen" flag
  - an undo alert that does not auto-hide
  - selection does not follow focus in the tree
  - "Export it before deciding" on the restore page
  - inline progress with a Cancel button
  - the word "problems", not "errors"
- **Nav conflict with B.** Use B's pages: Overview, Editor, Check, Export, Help, plus Feedback. "Your data" goes in the footer and behind the save-status link.
- **Gap: data.json 1.1 files.**
  - A 1.1 file has `dataset[]` items typed `dcat:Dataset`, so decompose may recognise it as DCAT and load it.
  - Schema errors do not refuse a file (#21), so it would load with hundreds of problems. That is the worst outcome for someone expecting 1.1 import.
  - Detect the 1.1 `conformsTo` value and refuse with D's 1.1 wording (open question 1).
- **D's Q7: should Create be blocked when Mandatory fields are missing?** No. Flag the gaps but never block. The check is advisory (#27), and invalid files still load (#21).

## 2. Refined journeys mapped to B's routes

Every page has the frame (gov banner, alpha site alert, header, save status) and a footer with "Clear my data".

| # | Journey | Routes (`?state=`) | Src |
|---|---|---|---|
| J1 | First visit | `start` (notice always shown inline) → `help#your-data` | #32, #28 |
| J2 | Blank catalog | `start` → `editor/catalog?state=blank` (focus on Title; Datasets *not* marked missing, because `dataset: []` passes the schema) → `editor/dataset?state=new` | #21, #24 |
| J3 | Open a file | `start` → `load-file` → `?state=progress` → `workspace?state=loaded` → `editor/catalog`. Failure states: `too-large`, `not-json`, `no-dcat-class`, `dcat-us-1-1`; each says "working copy unchanged" | #21, #20 |
| J4 | Paste JSON | `start` → `load-paste` → same states as J3; the pasted text is kept on error | #21 |
| J5 | Replace the working copy | "Load another" → `load-file` → file parses → `?state=replace-confirm` (Export current copy / Replace / Cancel) → `workspace?state=loaded` | #21 |
| J6 | Return visit | `restore` (Restore / Discard / Export it before deciding) → `workspace`; or `restore?state=discard-confirm` → `start` | #28 |
| J7 | Find a dataset | `editor/catalog`: filter (`?state=filtered`, match count announced), switch to "By class", or at scale `editor/datasets?catalog=large` → `editor/dataset` | #23, #29 |
| J8 | Edit a dataset | `editor/dataset` (Required/Recommended open, Optional in an accordion, Other properties shown for D4) → tree label updates → Saving… then Saved | #24, #28 |
| J9 | Add a distribution | `editor/dataset?state=select` → `?state=create` → focus on the new row → `editor/distribution` | #25 |
| J10 | Contact or publisher | `?state=select` (each result shows "Used by …") → Select, or `?state=create` → `?state=create-nested` (breadcrumb plus Back). Dataset publisher offers Organization only | #25, ADR 0002 |
| J11 | Shared contact | Inline header alert *before* editing: "Used in 5 places. Changes apply to all of them." It adds "Edit a copy for this one" only when reached from a field (`editor/contact?from=d4`) | #25, ADR 0005 |
| J12 | Remove, delete, undo | `editor/dataset?state=remove-link` (Undo alert); `editor/object?state=delete-unused`; `editor/contact?state=delete-shared` → `?state=deleted` (Undo) | #26 |
| J13 | Check and fix | `check?state=running` → `results` (a shared object's problem shown once, "affects 5 places") → `editor/dataset?id=d1&state=errors#modified` → `check?state=stale` → `clean` | #27 |
| J14 | Export | `export?state=has-errors` (Review problems / Download anyway; shared-objects note shown once) → `done`; or `loop-error` | #22, #27 |
| J15 | Clear my data | footer → `data#clear` → confirm (Export first / Clear / Cancel) → `start` with a "cleared" alert | #28 |
| J16 | Storage failure | any editor page with `?alert=storage-failed` (Download catalog); also `data?state=storage-failed` | #28 |
| J17 | Second tab | `in-use` (Try again; no takeover). The leave-page warning is noted on `help` only | #28 |
| J18 | Help and feedback | `help#known-limits`, `about` (out-of-scope list), `feedback` interstitial | #32 |

**Users expecting out-of-scope features** (unchanged from round 1):
- Publish: explained on `about` and `help`.
- data.json 1.1: refused at load with the `dcat-us-1-1` state.
- Login: there is no sign-in control.

## 3. Resolved conflicts

1. **Sample size: two fixtures.**
   - The default is C's detailed 9-dataset catalog, which feeds every form and every problem. That size is realistic, since most catalogs have fewer than 50 datasets (ADR 0002).
   - `?catalog=large` shows 3,214 datasets on `workspace`, in the tree and on `editor/datasets`.
     - It is shown *just loaded*, so about 3,214 separate Kinds, each used once.
     - Rows are JS-generated titles with `aria-setsize=3214`.
     - Any row opens a detailed C object.
   - Counts, including those in D's restore and clear wording, must match the active fixture.
2. **Shared count: 5, and C's premise is right.**
   - The detailed sample is a **restored working copy** (J6). The user earlier linked D4–D7 and S1 to "OSS Data Help Desk", and the OSS organization to 7 places.
   - The links survive restore because #28 stores one object per record. They become copies only on export, including the storage-failure download.
   - Wording: "Delete from 5 places", "affects 5 places", "still used in 4 other places".
3. **First-visit notice: inline on every visit to Start, with no flag** (D; #28 "store nothing outside the working copy"). Start is only reached when there is no working copy, so repeating it costs little.
4. **Load summary: `workspace?state=loaded`, not a separate page** (B). The objects-by-class table is already on `workspace`.
5. **Order for replace-confirm: choose, check size, parse, then confirm.** Bad files are refused with no prompt (#21), and the dialog can name the new file.
6. **Shared edit: an inline alert, not a modal on the first keystroke** (D, WCAG 3.2.2). B's `edit-shared` modal becomes this alert.

## Open questions

1. Should files detected as data.json 1.1 be refused explicitly? This would extend #20.
2. Should select-existing group identical-looking objects, given that loads never merge them?
3. Is `editor/datasets.html` part of alpha scope, or only a proposal?
