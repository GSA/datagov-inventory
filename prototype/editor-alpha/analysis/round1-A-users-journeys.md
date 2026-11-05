# Round 1 — Analyst A: Users and journeys

Scope: who uses the browser-only DCAT-US 3.0 editor alpha (#15) and the end-to-end journeys the
clickable mockups must cover. Each journey is a list of **screens/states** (named `S-…`) that the IA
analyst can map to routes or to in-page states (dialogs, alerts). Sources: epic #15, sub-issues
#20-#32, ADR 0002 "Decided requirements" and "Decision Outcome", ADR 0005, architecture.md §5.4/§5.5.

## 1. Users

| User | Who | Goals in the alpha | Design implications |
|---|---|---|---|
| **Agency data manager / steward** (primary) | Owns an agency catalog. Most of the ~150 catalogs have fewer than 50 datasets; two have 1,000+ and one has 3,000+ (ADR 0002). | Load the agency's 3.0 file, find and fix datasets, check it, download a clean file. They will onboard to v2 with a 3.0 file they supply themselves (arch §5.5). | Fast find in a big tree (#23, #29), a check summary that links to problems (#27), export always possible (#27). |
| **Metadata publisher / occasional contributor** | Program staff who add or update a few datasets or distributions. Has little knowledge of the schema. | Fill in correct fields without reading the standard (#24). Reuse the agency's existing contact points and publisher (#25). | Help text, required markers, allowed-value lists (#24). "Select existing" offered before "create new" (#25). |
| **First-time evaluator** | Agency staff trying it out, the Data.gov team, the ISSO, usability testers. | Understand what it is and is not, try a blank catalog, give feedback (#32). | Alpha banner, first-visit notice, help page with known limits, feedback with a sensitive-data warning (#32). |
| **Keyboard-only and screen-reader users** | Any of the above. | Complete load, open, edit, create new, check and export (#30). | ARIA tree with arrow keys (#23). Single-level dialog with predictable focus (#25). Errors shown in text and announced, not by colour alone (#23, #27). Confirmations and export results announced (#22, #26). |
| **Users on shared or managed government machines** | Use Chrome or Edge in a managed browser on a modest laptop (#29). | Leave no catalog data behind (AC-12, SC-28). Cope when storage is blocked, for example in a private window. | A visible "Clear my data from this browser" control (#28). A storage-failure path that offers a download (#28). Text saying the copy is per browser and per device and is not backed up (#28, #32). |

**Mockup data:** a fictional "Department of Example Affairs / Office of Sample Statistics" catalog
(#17, #32: synthetic data only). It needs enough datasets to make search and filtering meaningful
(for example the tree shows "Datasets (3,214)"). It needs one contact point (a `Kind`) shared by 40+
datasets, one publisher `Organization` shared widely, and a few datasets with seeded schema errors.

## 2. Journeys (screens/states)

Global chrome on every screen: USWDS gov banner, **alpha banner** (#32), header with links to Help
and Feedback (#32), and a **save status** reading "Saved", "Saving…" or "Not saved" (#28).
Editor screens also carry Check, Export and "Clear my data" (#27, #22, #28).

**J1 First visit** (#32, #28)
1. `S-Start`: an empty start page with three actions: **Open a file**, **Paste JSON**, **Start a blank catalog** (#21).
2. `S-FirstVisitNotice` is shown over or before S-Start. It says the catalog stays in this browser, is never sent anywhere, is not backed up, and can be cleared from the editor (#32). The user dismisses it with "I understand". Link: "Learn more" → `S-Help#storage`.
3. The notice is not shown on later visits. A Help link to the same text stays available.

**J2 Start a blank catalog** (#21)
1. `S-Start` → **Start a blank catalog**.
2. `S-Editor` (Catalog selected) shows a tree with a single "Untitled catalog" node and the Catalog form in the detail pane. The required "Datasets" field is shown as missing (#24, #26). Status: "Saved".
3. The user fills in the title, then uses "Add dataset" → J7.

**J3 Open a DCAT-US 3.0 file** (#21)
1. `S-Start` → **Open a file**. The user chooses a file or drags it onto the drop zone. Copy says "Read in your browser, never uploaded".
2. `S-Loading` shows a progress bar (file name, percent). The page stays usable and the user can cancel (#21).
3. `S-LoadSummary`: "Loaded *agency-catalog.json*". It shows a table of objects by class (Catalog 1, Dataset 3,214, Distribution 9,870, Kind 112, …). If the file has schema errors it adds a note: "This file loaded with problems; run Check to see them" (#21: files with schema errors still load). Action: **Open editor**.
4. → `S-Editor`.

**Failure branches**
- **Too large:** `S-Start` with an error alert: "This file is 212 MB. The limit is 50 MB." Nothing is parsed (#21). The limit is named in the message.
- **Invalid JSON or no DCAT class:** `S-Start` with an error alert: "This file is not valid JSON (line 1,204)" or "No DCAT-US Catalog or Dataset found". The working copy is unchanged (#20, #21).
- **Too deep:** an error alert like the size error (#20).
- **data.json 1.1 detected** (when `conformsTo` is the 1.1 schema): a specific message that the alpha opens DCAT-US 3.0 only, with a link to Help on how to get a 3.0 file (#15 out of scope, arch §5.5).

**J4 Paste JSON** (#21)
1. `S-Start` → **Paste JSON** opens `S-PasteJSON`: a labelled textarea and a **Load** button.
2. The same steps as J3 follow: progress → summary → editor. Errors appear inline above the textarea and the pasted text is kept.

**J5 Replace the working copy** (#21)
1. From `S-Editor` the user picks "Open another catalog" → `S-Start` (load mode).
2. Before parsing, `S-ConfirmReplace` (dialog) says: "Replace your working copy? *Example Affairs catalog* (edited 10 minutes ago) will be removed from this browser. Export it first if you need it." Buttons: **Export first** (→ J17), **Replace**, **Cancel** (#21, #15: only one working copy).

**J6 Returning user: restore or discard** (#28)
1. Opening the app with a saved copy → `S-RestorePrompt`. It shows the catalog title, the time it was last saved and the object counts. Buttons: **Restore** and **Discard**. Nothing is restored silently (#28). This prompt is scanned by axe (#30).
2. Restore → `S-Loading` (the same load path as J3, #21) → `S-Editor`.
3. Discard → `S-ConfirmDiscard` ("This deletes it from this browser. Export first?") → `S-Start` with the status "No working copy".

**J7 Browse and find a dataset in a big catalog** (#23, #20 comment, #29)
1. `S-Editor` has the tree on the left and the detail pane on the right. The top-level tree nodes are the catalog, its datasets, its series and its services (#23).
2. A **view toggle** switches between "Catalog structure" and "By type" (a flat list per class) (#20 comment). It is useful for finding all `Kind`s or `Organization`s.
3. `S-Editor-filtered`: the user types in the filter box (for example "water"). The tree shows only matching objects plus their parents, and a live region announces "12 matches" (#23).
4. The user moves through the tree with the arrow keys and selects with Enter (#23). Nodes with problems carry a text badge such as "2 errors" (#23).
5. The detail pane shows the dataset (→ J8).

**J8 Edit a dataset** (#24)
1. `S-Editor` (Dataset selected) shows the form grouped Mandatory → Recommended → Optional. Mandatory fields are Title, Description, Identifier and Contact point (DCAT-US 3.0 digest). Each field has help text from the schema (#19, #24).
2. The user edits the title. The tree label updates immediately and the status goes Saving… → Saved (#24, #28).
3. In a multi-value field (Keywords) the user can add, remove and move items up or down (#24).
4. In an allowed-values field, a select offers the allowed values (#24).
5. Properties the schema does not know appear in an "Other properties (read-only)" section that is kept on export (#24).

**J9 Add a distribution** (#25, #24)
1. Dataset form → "Distributions" field → **Add distribution**.
2. `S-SelectOrCreate` (dialog, Distribution) offers search over existing distributions and a **Create new** button.
3. **Create new** → `S-Dialog-CreateForm` (Distribution form: Title, Access URL, Download URL, Media type, …) → **Add to dataset**.
4. The dialog closes, focus returns to the "Add distribution" button, the new row shows in the field, and the tree shows the new child (#25).

**J10 Contact point or publisher: select existing vs create new, including nested create** (#25, ADR 0002)
1. Dataset form → Contact point → **Change** or **Choose** → `S-SelectOrCreate` (Kind). The user searches "data desk". Results show the name, the email and "Used by 47 datasets" (#25).
2. **Select** links the existing object. The dialog closes and focus returns to the field.
3. Alternatively **Create new contact** → `S-Dialog-CreateForm` (Kind: Name, Email `mailto:` …).
4. Nested case: the user creates a Publisher (`Organization`), and its "Sub-organization of" field → **Create new organization**. The dialog **replaces its content** and shows a breadcrumb "New publisher › New parent organization" with a **Back** control. No second modal opens (#25, ADR 0002 "Dialogs are single-level").
5. Save the inner object → back to the outer form with the field filled in → save → close. Focus returns to where the user started (#25).

**J11 Edit a shared object** (#25, ADR 0005)
1. The user selects a contact point in the tree or the form. `S-Editor` (Kind selected) shows "Used in 47 places" with an expandable list of links (#25).
2. The user starts typing in a field. If they opened the contact from a dataset's field, `S-SharedEditPrompt` asks: **Edit for all 47** or **Edit a copy for this one** (it creates a copy and repoints only this dataset) (#25).
3. Choosing "copy" shows a success alert: "Created a copy for *Groundwater Levels 2024*. The other 46 places are unchanged." The tree now shows the copy.

**J12 Remove a link vs delete an object, and undo** (#26)
1. Remove a link: the contact row in a dataset form → **Remove from this field**. Only that link is removed. If the field is required, it now shows as missing. An alert offers **Undo** (#26).
2. Delete an unused object: Kind detail ("Used in 0 places") → **Delete** → a short confirm → the object disappears from the tree.
3. Delete a shared object: **Delete** → `S-ConfirmDelete` lists the 47 places and says it will be removed from all of them → confirm (#26).
4. Undo: a persistent "Undo last removal" in the alert and the editor toolbar. It is session only, one step of removal only (#26). The confirm and the undo result are announced and focus returns sensibly (#26).

**J13 Run the advisory check and fix errors** (#27, #32)
1. Toolbar → **Check catalog** → `S-Checking` shows progress, and editing stays possible (#27).
2. `S-CheckResults` has an advisory heading: "Advisory check against DCAT-US 3.0 schema (GSA/dcat-us @ 4996591). This is not the official Data.gov validator." Errors are grouped by class with counts, and each object is a link (#27).
3. Clicking a link → `S-Editor` with that object selected. A summary of errors sits at the top of the form and each message sits next to its field, written in readable words ("Contact point › Email: must start with mailto:"). The messages use an icon and text, not colour alone (#27).
4. The user fixes the field. The result goes stale and rechecks, and the tree badge clears (#27).
5. Single-object check: **Check this object** in the detail pane (#27).

**J14 Export** (#22, #27)
1. Toolbar → **Export** → `S-ExportDialog`.
2. If there are errors, the summary is shown first: "This file did not pass the advisory check (14 errors in 9 objects)". There are links to the results and the user can still download (#27).
3. Shared-object note, shown once: "47 objects are used in more than one place. DCAT-US 3.0 has no references, so each use is written out in full. Re-opening this file will show them as separate copies" (#22, ADR 0005).
4. File name: `example-affairs-catalog-2026-11-05.json` (#22). **Download** → a success alert that is announced (#22).
5. Error branch: `S-ExportError` for a loop or a graph that is too deep. It names the objects involved and no file is produced (#22).

**J15 Clear my data** (#28)
1. Header or footer → **Clear my data from this browser** → `S-ConfirmClear` ("Export first?" offered) → `S-Start` with the alert "Your working copy was deleted from this browser" and the status "No working copy".

**J16 Storage failure** (#28)
1. Any edit while storage is full, blocked or in a private window → the status shows "Not saved" and a sticky error alert reads: "Your changes can't be saved in this browser. Download a copy now so you don't lose work." Button: **Download catalog** (#28).

**J17 Second tab** (#28)
1. Opening the app in a second tab → `S-SecondTab`, a blocking page: "This catalog is open in another tab. Close this tab or switch to the other tab." No editor is shown (#28).
2. Leaving with unsaved changes triggers the browser's own leave-page warning. The mockup can only describe this, for example in a note on the Help page (#28).

**J18 Help and feedback** (#32)
1. `S-Help` covers known limits: DCAT-US 3.0 JSON only, one working copy, the supported catalog size (#29), the browsers tested, what the advisory check means, and where the data lives (#28, #32).
2. **Feedback** → `S-Feedback` (an interstitial): "Don't paste catalog contents or sensitive data. Nothing from your catalog is attached." Then a link to the GitHub issue form or mail (#32).

## 3. Out of scope, and how the mockups should handle users who expect it

| Expected flow | Status | Mockup handling |
|---|---|---|
| Publish / unpublish, draft vs live | E12 (#15) | No Publish button. Help explains: "The alpha does not publish. Export the file and submit it as you do today." |
| Import data.json (DCAT-US 1.1) or JSON-LD | Out (#15, ADR 0008) | Specific load error plus Help text about converting to 3.0 (J3). |
| Login, accounts, sharing, roles | E02/E03 (#15) | No sign-in. Help says "No account needed; nothing leaves your browser." |
| Official Data.gov validator | E12 (#15, #27) | The word "advisory" appears wherever the check is mentioned (J13). |
| Live JSON preview | E13 (#15) | Not shown. Export is the only way to see the JSON. |
| Several catalogs at once, a catalog list | Out (#15) | Replace-confirm (J5). Help names the one-copy limit. |
| Server backup, sync, recovery | E04 (#15, #28) | Storage notice and Help: "not backed up; export to keep your work". |
| Upload or host files | E07 (#15) | Download URL is a plain text field. No upload control. |
| Merge duplicate objects on load | Out (#15, #20) | Not shown. Identical contacts in a file appear as separate objects. |
| Full undo/redo | Out (#26) | Only "Undo last removal". |

## Open questions

1. Should the mockup offer "Try with a sample catalog" on `S-Start`? It helps evaluators, but #21 lists only file, paste and blank.
2. What is the exact size limit, and the supported catalog size? The mockup needs placeholder numbers until #21 and #29 set them.
3. Shared-object edit (J11): should the copy-or-all prompt appear when the user opens the shared object from the tree too (where there is no "this one"), or only when they reach it from a referring field?
4. Does the second-tab warning (J17) offer "Take over editing here", or only block?
5. Does undo (#26) persist across a reload? Wording says "same session". Should undo also cover "Remove from this field", or only deletes?
6. Default tree view: "Catalog structure" or "By type" (#20 comment)?
7. Does the first-visit notice block until acknowledged (a modal) or sit inline as a dismissible alert?
