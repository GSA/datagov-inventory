# Shared brief for the analysis sub-agents

Goal: clickable, static USWDS mockups (plain HTML/CSS/JS, no backend) of the
"datagov-inventory editor alpha" described in GSA/datagov-inventory epic #15.
The app lets a data manager load / create, browse, edit, check and export a
DCAT-US 3.0 catalog entirely in their own browser.

Source material (local copies the analysts were given; do NOT call GitHub write APIs). Paths are relative to
the analysts' scratch folder: issue text from GitHub, ADRs and architecture.md from this repo's docs/, and the
schema from GSA/dcat-us jsonschema/definitions:
- issue-15.md            the epic (#15): goal, success criteria, scope, out-of-scope
- all.md                 all 19 sub-issues (#8, #9, #16-#32) with bodies and comments
- docs/0002-ui-rendering-architecture-for-inventory-v2.md   ADR 0002 (editor model)
- docs/0005-object-graph-data-model-for-dcat-us-3.md         ADR 0005 (object graph, shared objects)
- docs/0010-depend-on-upstream-dcat-us-code.md               ADR 0010 (schema/validator)
- docs/architecture.md   v2 architecture (see §4 data model, §5.2 export, §5.4 import)
- dcat-us-3.0-digest.md  digest of every DCAT-US 3.0 class: properties, requirementLevel
                                    (Mandatory/Recommended/Optional), schema-required, type/ref
- schema/*.json          the raw DCAT-US 3.0 JSON Schema definitions (GSA/dcat-us @ 4996591, 2026-10-07)

Key constraints from the epic (do not contradict without flagging it):
- Browser-only alpha: no login, no server, no publish, no draft/live states, no data.json 1.1 import,
  DCAT-US 3.0 JSON only, one working copy at a time, no live JSON preview (E13).
- Validation is ADVISORY (browser JSON Schema check), never "official Data.gov validator".
- Working copy is kept in IndexedDB: saved/saving/not-saved status, restore-or-discard prompt, "Clear my data".
- Tree + detail pane editor; select-existing-or-create-new for class-valued fields; single-level dialogs only
  (breadcrumb/back inside the dialog, never stacked modals); usage counts and "edit a copy for this one";
  safe removal with confirmation listing affected places; undo last removal.
- Alpha banner on every page, first-visit "your data stays in this browser" notice, help page with known limits,
  feedback link that warns against pasting sensitive data.
- Section 508 / WCAG 2.1 AA; keyboard-operable tree; errors not colour-only.

The mockups are a single static folder of HTML pages, each a "screen" (a URL/route). Every page must be
linked so everything can be clicked through. JS only for mock interactions. Fake but realistic data:
a synthetic sample agency catalog (do NOT use a real agency's real data; a fictional agency is best,
e.g. "Department of Example Affairs" / "Office of Sample Statistics").

Tie each requirement you state to its source issue number (e.g. "(#25)") or ADR.
Write your findings as Markdown to the file named in your instructions. Be concrete and concise
(aim for 600-1200 words). End with a short "Open questions" list.
