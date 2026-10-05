---
title: "Onboard agencies by importing published DCAT-US 3.0 data.json rather than migrating from CKAN"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Deployment and Infrastructure"
nist_controls: ["CM-3", "SI-10", "SI-12", "CP-9", "CM-4", "CM-7", "SA-8"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "accept"
---

# Onboard agencies by importing published DCAT-US 3.0 data.json rather than migrating from CKAN

## Context and Problem Statement

Inventory v1 holds agency metadata in CKAN's database as DCAT-US 1.1 datasets. v2
uses a different data model ([ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md))
and a different metadata version (DCAT-US 3.0). We must decide whether to build a
migration from the v1 CKAN database into v2, or have agencies re-establish their
catalogs in v2 by importing a DCAT-US 3.0 file, and whether v2 converts 1.1 input.

### Decided requirements

Answered by the product owner, 2026-10-05:

- **No cutover.** Organizations and sub-organizations move to v2 on their own
  timeline. The **target** is to retire v1 before 2027-09-30. It is a target, not a
  commitment: it is confirmed or moved once a development timeline exists, and
  retirement is preceded by a notice period.
- **Agencies do the move; Data.gov staff do not migrate anyone's data.** Any
  organization or sub-organization can export from v1 and create its catalog in v2.
  Users who can reach v1 within an agency decide among themselves who imports and
  owns the canonical version. Sub-organizations and their parent coordinate sharing
  and permissions themselves, and Data.gov can be consulted on best practice.
- **Inventory is the authoring system of record, never a publishing relay.** The
  canonical catalog is authored in Inventory and exported back to the agency's IT
  department to publish online and be harvested by data.gov. Re-import exists for
  retries and corrections.
- **Abandoned and unused organizations are not carried forward.** That is a feature:
  a fresh start that keeps junk from perpetuating. An organization whose v1 export
  does not work is treated as unused, since none has raised it.
- **A final snapshot** of v1 is taken before shutdown (see
  [Snapshot and shutdown](#snapshot-and-shutdown)).
- **No reconciliation on the Data.gov side.** Comparing the imported catalog against
  v1 is the importing user's review.

## Decision Drivers

- **Metadata is public and exportable.** Each organization can produce a catalog
  without access to the v1 database.
- **A database migration would bridge a model change and a schema-version change at
  once**, and would have to reproduce CKAN's `package_extras` conventions, the exact
  thing v2 exists to escape.
- **Import produces reuse.** Merging identical objects during import gives the shared
  structure v2 wants.
- **v1 stays available while agencies move**; nothing is deleted by this decision.
- **1.1 to 3.0 is not a lossless mapping.** Some 3.0 constructs (`DataService`,
  `Concept` vocabularies, structured `Location`) have no 1.1 source and need human
  authoring regardless of approach.
- **Conversion is not Inventory-specific**, and each organization does it once.

## Considered Options

1. **Import from a 3.0 file.** The agency produces the 3.0 file outside Inventory 2.0.
2. **Import 1.1 and convert inside v2.** Rejected: v2 would carry the 1.1 schemas, a
   second validation path, and a dependency on upstream converter code, for an
   operation performed once per organization.
3. **Database migration from CKAN.** Rejected: far costlier than import, and it
   would bypass the review gate.

## Decision Outcome

Chosen option: **Option 1.** **v2 imports DCAT-US 3.0 only and does not convert 1.1.**
This is a permanent scope decision, not a deferral; reversing it needs a new
decision, not quiet reinterpretation.

| Route to a 3.0 file | Who runs it | Caveat |
|---|---|---|
| v1's `/organization/{id}/dcat-v3.json` | Agency users, while v1 runs | Stale fork of the converter and a degraded validator, so output may be lossier |
| Upstream `convert_dcat_1_1_to_3_0.py` as a CLI | Agency, out-of-band | Not a v2 component; someone must run it |
| The agency regenerates `data.json` as 3.0 from its own system | Agency | Only for agencies that author outside Inventory |

Gaps in the v1 export's fidelity are accepted, and the agency reviews the draft.

## Import behavior

Import always decomposes into a **fresh** object set in `draft`. It never diffs
against or merges into existing objects.

### Invalid objects are ingested and flagged

Import does not reject a file for schema errors. Only a file that cannot be parsed
(not valid JSON, or no recognizable DCAT class) is refused. Each object is validated
against DCAT-US 3.0 and given a **validation status** of valid or invalid, with its
errors from the upstream error summarizer. Invalid objects are kept, shown as invalid
in the UI, and **cannot be set `live`**, so they are never exported as they stand.

This is a validation status, **not a second lifecycle state.** ADR 0005 requires
exactly one authoritative `state` field (`draft` or `live`), and an object can be a
`draft` and invalid at once. Because the export walk selects only `state = 'live'`,
the gate needs no export-side change. An object that references an invalid object is
itself not exportable as it stands. Validity is recomputed when the object is edited
and when the pinned schema changes.

### Convergence of identical objects

During decompose, **completely identical objects are merged into one shared object**,
and the import summary reports how many were merged.

- **Eligible:** any object other than a `Dataset`. In practice this means
  `Organization`, `Kind`, `Concept`, `Location`, and `Distribution`. `Dataset`s are
  never merged; they carry unique identifiers from v1, so the question does not arise.
- **Equality is exact, with no normalization.** Values are taken as-is: no trimming
  and no case-folding. Two objects are identical only if all their properties are
  equal, with JSON key order ignored and array order preserved. Objects are compared
  from the leaves up, so a parent whose children were merged can itself match.
- **Scope:** within the incoming file only, never against objects already in
  Inventory.
- **Similar-but-not-identical objects are not highlighted at import.** A tool that
  finds near-duplicates is useful to every user at any time, not just on import, so it
  is future work and belongs in the editor.

Merged objects carry the usual shared-object consequences: the UI shows reference
counts and offers copy-on-write before an edit changes every referrer (ADR 0005).

### Re-import replaces by build-then-swap

Re-import over an existing catalog decomposes into a **new** object set and then
transfers the catalog identity to it atomically. The incoming file is authoritative in
full; nothing from the previous object set is preserved. Build-then-swap gives:

- **Atomicity.** A failure cannot leave a catalog deleted and unreplaced.
- **No serving gap.** The old object set keeps answering
  `GET /catalog/{id}/dcat-v3.json` until the swap commits.
- **The `draft` review gate survives.** The new set stays in `draft` until a human
  approves the swap.

There is one decompose implementation: build-then-swap is the new-catalog path plus an
identity transfer.

#### What the catalog identity carries across a swap

Because the `catalog` row survives, so does everything referencing it:

- **`catalog_permission` grants**, including catalog-principal and transitive grants
  ([ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md)). Re-import does not
  re-run first-`admin` bootstrap.
- **Inbound `catalog_link` edges.** A catalog embedding this one still embeds it.
- **The export URL**, which `harvest.data.gov` is intended to consume long term.

**Outbound `catalog_link` edges are part of the replaced content**, so the acyclicity
check on `catalog_link` writes must be **re-run at swap time**. Otherwise a rebuilt
catalog can close a loop, which is a denial-of-service against the export walk.

### Snapshot and shutdown

Before v1 is shut down, a **final snapshot** is taken: a database backup and a
**DCAT-US 3.0 archive** of v1's organizations, for the case where one needs to be
revised in v2.

- **Storage:** the DCAT-US 3.0 export goes to v1's existing S3 bucket, which is kept for
  **7 years**. The archive file is **provided to an agency on request**.
- **No read-only period.** Changes made on the final day of use may be lost; this is
  accepted.
- **No per-organization completion gate.** Retirement is by date after the notice
  period, not by every organization finishing. v1's `dcat-v3.json` endpoint ends with
  v1, so there is no second gate.
- **Organizations whose v1 export fails** have no 3.0 archive; the database backup
  covers them.

### What is not migrated

- **User accounts.** Accounts are created just-in-time on first Login.gov
  authentication ([ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md)).
- **Version history.** v2's audit trail begins at import.
- **Draft datasets.** Anything not in the exported file is not imported. Agencies with
  unpublished drafts in v1 must re-enter them.
- **Uploaded data files.** The file carries `accessURL` and `downloadURL` strings, not
  bytes. An agency whose v1 files were hosted by Inventory must upload them to its v2
  catalog and repoint the `downloadURL`. Existing v2 hosted files are untouched by a
  swap, because nothing links them to the replaced objects
  ([ADR 0012](0012-catalog-scoped-hosted-files.md)).
- **`config/data/inventory_publishers.csv`** is not carried into v2
  ([ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md#no-publisher-registry-or-seed-data)).

### Positive Consequences

- No CKAN database reader, dual-write, or reconciliation tooling to build and discard.
- Onboarding and migration are the same code path, exercised continuously.
- Import produces `draft`, forcing human review before anything is published.
- Invalid data is visible and fixable in the editor, not lost at the door.
- Agencies get a chance to clean up metadata, and abandoned organizations are not
  perpetuated.
- v2 carries no 1.1 code, schemas, or second validation path (CM-7).

### Negative Consequences

- **Version history does not survive** in v2. It is kept only in the v1 snapshot.
- **Onboarding depends on work v2 neither owns nor schedules.** An agency that cannot
  produce a 3.0 file has no path, and v2 cannot unblock it. Producing it is the
  agency's job.
- **Work is pushed onto agency staff**, who must review the draft and author new 3.0
  fields. This is coordination, not engineering, effort.
- **Anything in v1 but not in the exported file is silently absent**, and the import
  cannot report what it never saw. The importing user compares counts.
- **Conversion is imperfect, and v2 cannot see how.** It sees only the 3.0 result.
- **Two users in one agency can each import their own copy.** v2 has no tenant to
  prevent it; agencies coordinate among themselves.
- **Invalid objects are stored.** They are rendered with output escaping like any
  other untrusted data.

### Compliance Consequences

- **SI-10 (Input Validation)** — import is an untrusted-input boundary. The file is
  parsed defensively, with size limits, and fetched through the egress proxy when a URL
  is given. Every object is validated against **3.0 only**, with `jsonschema` pinned
  explicitly (v1 leaves it unpinned and silently falls back to Draft 4). Validation
  gates `live`, not ingest: no invalid object reaches an export.
- **SI-12 (Retention)** — v1's history exists only in the snapshot, retained 7 years.
  The retention period should be confirmed with the records officer.
- **CP-9 (System Backup)** — the final snapshot (database backup plus DCAT-US 3.0
  archive) is the backup for decommissioning.
- **AU-2, AU-3, AU-10** — a swap is a single audit event recording the source, the
  `_external/dcat-us` submodule commit, the outgoing and incoming object counts, and
  the approving actor.
- **CM-3 (Configuration Change Control)** — each import records the submodule commit
  that validated it ([ADR 0010](0010-depend-on-upstream-dcat-us-code.md)). Conversion
  happens outside v2 at an unrecorded version, so an imported catalog is reproducible
  against v2's validator but not against whatever converted it. If that matters, the
  importing user can record the converter version with the source.
- **CM-4 (Impact Analysis)** — the import summary reports counts, merges, and invalid
  objects. Reconciliation against v1 is the user's review, with no Data.gov-side check.
- **CM-7 (Least Functionality)** — v2 loads no 1.1 schemas, runs no transforms, and
  has no conversion endpoint.
- **Risk treatment is `accept`.** Accepted: loss of v1 edit history in v2 (the metadata
  is public and the snapshot is kept), and that agencies can produce valid 3.0 files
  out-of-band. If the latter proves false, revisit the no-conversion decision.

## Blockers before acceptance

None.

## Action items

Work to schedule, not blockers. Track each as an issue.

- **Take the final v1 snapshot** (database backup and DCAT-US 3.0 archive) before
  shutdown, and record its location and owner.
- **Confirm the archive's storage.** Verify that v1's S3 bucket is private, since v1
  served files publicly and the database backup is not public data (it holds user
  emails, edit history, and drafts). Keep the backup in a separate private location.
  Confirm the bucket's service instance and space outlive v1's decommissioning.
- **Confirm the 7-year retention** with the records officer, with the same
  conversation as [ADR 0012](0012-catalog-scoped-hosted-files.md)'s.
- **Plan the notice period** and confirm or move the 2027-09-30 target once a
  development timeline exists.

## Links

- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — import/export from a current DCAT-US 3.0 catalog
- [DCAT-US 3.0 migration guide](https://resources.data.gov/resources/dcat-us-3-migration/) and [M-25-05 crosswalk](https://resources.data.gov/resources/dcat-us-3-crosswalk/)
- [GSA/dcat-us 1.1→3.0 conversion script](https://github.com/GSA/dcat-us/blob/main/jsonschema/convert_dcat_1_1_to_3_0.py) and [`transforms.py`](https://github.com/GSA/dcat-us/blob/main/jsonschema/transforms.py) — run **out-of-band**; **not** part of v2 ([`architecture.md` §3](../architecture.md#v2-does-not-convert-dcat-us-11))
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) — why user accounts need no migration
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the object model import decomposes into
- [ADR 0010](0010-depend-on-upstream-dcat-us-code.md) — how v2 depends on upstream 3.0 validation code
- [ADR 0012](0012-catalog-scoped-hosted-files.md) — makes hosted files independent of metadata, which is why a swap cannot affect them
- `ckanext/datagov_inventory/dcat/dcat_converter.py` — v1's stale fork of the upstream converter; **not** the source for v2
- `ckanext/datagov_inventory/plugin.py:345-407` — v1 `generate_dcat_v3` export, one supported route to a 3.0 file
- NIST SP 800-53 Rev 5.2 — CM-3, CM-4, CM-7, SI-10, SI-12, CP-9, SA-8
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
