---
title: "Onboard agencies by re-importing published data.json rather than migrating from CKAN"
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

Inventory v1 holds agency metadata in CKAN's database as DCAT-US 1.1 datasets.
v2 uses a different data model (ADR 0005) and a different metadata version
(DCAT-US 3.0). We must decide whether to build a migration path from the v1
CKAN database into v2, or have agencies re-establish their catalogs in v2 by
importing their published `data.json`. If we choose the latter option, we must
then further decide whether to support import+conversion from a v1.1 `data.json` or
only support import from v3.0 `data.json`.


## Decision Drivers

- **Every agency's metadata is already published and publicly reachable.** The
  entire purpose of Inventory is to generate a `data.json` that the agency hosts
  at `agency.gov/data.json`. The migration source is therefore public, canonical,
  and available without any access to the v1 database. *Amended: public and
  canonical, but **1.1**, so it is no longer directly importable — see the
  amendment below.*
- ~~**A 1.1 → 3.0 converter already exists upstream and is well tested.**~~
  **Withdrawn as a driver for this decision.** The converter does exist and is
  well tested — [`GSA/dcat-us`](https://github.com/GSA/dcat-us/tree/main/jsonschema)'s
  `transforms.py` (499 lines) and `convert_dcat_1_1_to_3_0.py` (558 lines), backed
  by 719 lines of tests — but **v2 does not run it.** It is an out-of-band CLI an
  agency or Data.gov staff may use to produce a 3.0 file *before* import. "The
  migration tool is largely written" is therefore no longer an argument for this
  option; it is an argument that the agency's prerequisite is achievable. The
  distinction matters because the work moves from v2's critical path to someone
  else's.
- **A database-level migration would have to bridge both a model change and a
  schema-version change simultaneously**, and would need to reproduce CKAN's
  `package_extras` conventions — the exact thing v2 exists to escape. *This driver
  is unaffected, and it is now the strongest one remaining.*
- **Import produces reuse automatically.** The import code merges repeated contact
  points and publishers into shared objects. Import is not a lossy shortcut; it
  is the mechanism that produces the desired structure.
- **v1 remains available during transition.** Nothing is deleted by this
  decision; v1 continues serving until agencies have re-established in v2.
  *Amended: v1 is now also one of only two routes to a 3.0 file, which couples its
  lifetime to onboarding a second way — see the amendment below.*
- **1.1 → 3.0 is not a lossless mechanical mapping.** Some 3.0 constructs
  (`DataService`, `Concept` vocabularies, structured `Location`) have no 1.1
  source and require human authoring regardless of migration approach.
  `DatasetSeries` is the exception worth naming: 1.1's `isPartOf` ("Collection",
  a bare identifier string) *is* a source for it, and upstream's converter
  promotes those relationships — so series structure can survive conversion where
  the others do not, **provided the agency converts with upstream's converter
  rather than v1's stale fork.** Lossiness is now the agency's problem to manage,
  not something v2 can report on. That is a weaker position, not a neutral one.

## Considered Options

1. **Import from v3.0 `data.json`.** Agencies import their public DCAT-US 3.0 catalog into Inventory 2.0; conversion from
  v1.1 to 3.0 must be handled by the agency outside Inventory 2.0. Agencies that use Inventory 1.0 can export to DCAT 3.0
  from within Inventory 1.0, agencies that don't can run upstream's `convert_dcat_1_1_to_3_0.py` CLI out-of-band.
2. **Import from v1.1 `data.json`.** Agencies import their public DCAT-US 1.1 catalog into Inventory 2.0; the existing converter
   produces a 3.0 catalog in `draft` state for review before going `live`.
3. **Database migration from CKAN.** Read the v1 CKAN database directly,
   convert packages and extras to v2 objects, and populate v2.

## Decision Outcome

Chosen option: **Option 1 — re-import from published 3.0 `data.json`**.

Option 3 is rejected because import is radically cheaper than a database migration, and still produces the right structure.

Option 2 is rejected for reasons described in [Amendment: v2 does not convert 1.1, so producing 3.0 is the agency's prerequisite](#amendment-v2-does-not-convert-11-so-producing-30-is-the-agencys-prerequisite)


### Amendment: v2 does not convert 1.1, so producing 3.0 is the agency's prerequisite

**Inventory v2 imports DCAT-US 3.0 only. It does not convert 1.1 input.** The
conversion step this record originally placed inside the import path is removed
from v2's scope entirely.

This is a **permanent scope decision, not a deferral.** Framing it as "deferred"
would understate the user impact and postpone the conversation with affected
agencies — the same reasoning [ADR 0007](0007-retire-tabular-datastore-api.md)
applies to the DataStore. If the decision is reversed later, this record should be
amended again or superseded, not quietly reinterpreted.

#### What this costs, stated plainly

**Every agency's published `data.json` is 1.1 today.** At the time of writing,
therefore, **no agency can onboard from its published file as-is** — which is the
exact scenario this record's title describes. Onboarding gains a prerequisite that
Inventory cannot satisfy on the agency's behalf:

| Route to a 3.0 file | Who runs it | Caveat |
|---|---|---|
| v1's `/organization/{id}/dcat-v3.json` | Agency or Data.gov staff, while v1 runs | Stale fork, degraded validator, lossier output |
| Upstream `convert_dcat_1_1_to_3_0.py` as a CLI | Agency or Data.gov staff, out-of-band | Not a v2 component; requires someone to run and understand it |
| The agency regenerates `data.json` as 3.0 from its own system | Agency | Only available to agencies that author outside Inventory |

Three consequences follow, and none of them is a simplification:

- **An agency that cannot reach 3.0 has no onboarding path, and v2 cannot unblock
  it.** Previously the conversion was v2's to run and therefore v2's to fix; now it
  is a dependency on work v2 neither owns nor schedules.
- **v1's useful life is extended for a second, independent reason.** The CP-9 note
  below already gates v1 decommissioning on completed re-import. v1 is now *also*
  one of only two realistic conversion routes, so shutting it down removes a
  capability agencies may still need. **These two gates must be tracked
  separately** — "every agency has re-imported" no longer implies "nobody needs v1's
  converter any more."
- **v2 can no longer report on conversion quality.** The dual-side (1.1 in, 3.0
  out) validation this record relied on becomes single-side 3.0 validation. v2 sees
  only the result, so it cannot tell an agency *what the conversion lost* — only
  whether what arrived is valid 3.0.

#### What holds this together

**v2 validates 3.0 on ingest**, so a bad conversion — including one from v1's stale
fork — fails loudly at import rather than silently entering the catalog. That is
the mitigation for all three routes above, and it is why the quality gap is a
coordination problem rather than a correctness one.

#### Why this is nonetheless the right trade

The conversion code was never Inventory-specific. Hosting it meant v2 carried the
1.1 schemas, a second validation path, and a code dependency on an upstream
converter module, in service of an operation each agency performs **once**. A
once-per-agency transformation does not need to live in the application's
boundary; it needs to be available to the people performing it, and it already is.

What v2 keeps is the part that is genuinely its own: 3.0 validation, graph
decomposition, and the `draft` review gate.

### Amendment: import never merges — re-import replaces by build-then-swap

The record above describes initial onboarding and leaves the shape of a *second*
import into an already-populated catalog undefined.

**Import always decomposes into a fresh object set. It never diffs against, or
merges into, existing objects.** Two cases:

| Case | Behavior |
|---|---|
| Import into a new catalog | Decompose into a new object set in `draft`; this is the onboarding path described above |
| Re-import over an existing catalog | Decompose into a **new** object set, then transfer the catalog identity to it atomically — *build-then-swap* |

Re-import is therefore destroy-and-rebuild, not update. The incoming file is
authoritative in full; nothing is preserved from the previous object set.

**Why build-then-swap rather than delete-then-import:**

- **Atomicity.** A failure part-way through cannot leave a live catalog deleted
  and unreplaced.
- **No serving gap.** The previous object set keeps answering
  `GET /catalog/{id}/dcat-v3.json` until the swap commits, so
  `harvest.data.gov` never observes an empty catalog
  ([`architecture.md` §2](../architecture.md#2-container-view)).
- **The `draft` review gate survives.** Import produces `draft` so a human
  reviews before anything is published. Mutating a `live` catalog in place would
  force a choice between reverting it to `draft` — removing it from exports until
  re-reviewed — and publishing unreviewed content. Build-then-swap keeps the new
  object set in `draft` for review and swaps only on approval.

Note that build-then-swap *is* the new-catalog path plus an identity transfer, so
there is one decompose implementation, not two.

#### What the catalog identity carries across a swap

Because the `catalog` row survives, so does everything referencing it:

- **`catalog_permission` grants**, including catalog-principal and transitive
  grants ([ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md)). Re-import
  does not re-run the unresolved first-`admin` bootstrap.
- **Inbound `catalog_link` edges.** A catalog embedding this one still embeds it.
  This is the main reason identity transfer is preferable to creating a new
  catalog, since catalog-to-catalog embedding is MVP scope
  ([`architecture.md` §4](../architecture.md#catalog-to-catalog-sharing-is-mvp-scope)).
- **The export URL**, which `harvest.data.gov` is intended to consume long term.

**Outbound `catalog_link` edges are part of the replaced content**, so the
acyclicity check specified on `catalog_link` writes must be **re-run at swap
time**: a rebuilt catalog can close a loop that the previous object set did not.
Swapping without that check is the one way this design can introduce a cycle, and
a cycle is a denial-of-service against the export walk.

#### Open question: is Inventory ever a publishing conduit?

This amendment assumes import is **onboarding-shaped** — roughly once per agency,
plus retries — because in v2 Inventory *generates* `data.json` rather than relaying
it. An agency that maintains metadata in its own system does not need Inventory at
all; it hosts its own file and `harvest.data.gov` harvests it.

**If that assumption is wrong** — if an agency is expected to author elsewhere and
re-publish through Inventory on a schedule — then destroy-and-rebuild is the wrong
semantics, because each cycle discards curation and audit history, and merge
returns as a requirement. Confirm the assumption before this record is accepted.

### Compliance consequences of the build-then-swap amendment

- **AU-2, AU-3, AU-10** — a swap must be a single audit event recording the source
  URL, the `_external/dcat-us` submodule commit, the outgoing and incoming object
  counts, and the actor who approved it. Without that, the disappearance of an
  object set is unexplained in the trail.
- **CM-4 (Impact Analysis)** — the per-organization dataset-count reconciliation
  this record already requires applies to each re-import, not only the first,
  since a swap can silently shrink a catalog if the published file has regressed.

### What is not migrated

- **User accounts.** Not needed: ADR 0004 creates accounts just-in-time on first
  Login.gov authentication.
- **Version history.** v1's CKAN revision history is not carried into v2.
  v2's audit trail begins at import. This is the main accepted loss — see below.
- **Draft datasets.** Anything not in the published `data.json` is not imported.
  Agencies with unpublished drafts in v1 must re-enter them.
- **Uploaded data files.** The incoming `data.json` carries `accessURL` /
  `downloadURL` strings, not bytes, so onboarding imports **no** file content. An
  agency whose v1 files were hosted by Inventory must upload them to the v2
  catalog and repoint the `downloadURL`. This is distinct from the swap case
  above, where existing v2 hosted files are untouched because nothing links them
  to the replaced objects.
- **`config/data/inventory_publishers.csv`** (271 lines, ~350 organizations) is
  *reference* data, not migration data. It is **not** a tenant registry in v2 —
  agency/bureau silos are not a first-class concept
  ([`architecture.md` §4](../architecture.md#there-is-no-agencybureau-tenant-entity)) —
  so its only candidate purpose is seeding reusable DCAT `Organization` objects.
  That purpose is not yet designed; see the open question in
  [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md#open-question-what-becomes-of-the-publishers-reference-data).

### Positive Consequences

- No CKAN database reader, no dual-write, no reconciliation tooling to build,
  test, and then throw away.
- The onboarding path and the migration path are the **same** code path, so it is
  exercised continuously by new agencies rather than once at cutover.
- Import produces `draft` state, forcing human review before anything is
  published — a correctness gate a database migration would bypass.
- Agencies get a genuine opportunity to clean up metadata rather than porting
  accumulated problems forward.
- Upstream `convert_dcat_1_1_to_3_0.py`'s existing machine-readable
  `RESULTS:{...}` / `COUNTS:{...}` output makes migration progress measurable per
  organization — **though it is now observed by whoever runs the converter
  out-of-band, not emitted by v2.**
- **v2 carries no 1.1 code, schemas, or second validation path**, so the
  application's input surface is one metadata version rather than two (CM-7).

### Negative Consequences

- **Version history does not survive.** v1's edit history is not carried into
  v2. If historical attribution has a retention obligation, the v1
  database must be preserved separately as an archive — this ADR does not create
  that archive, and someone must decide whether one is required (see below).
- **No agency can onboard from its published file as-is.** Every published
  `data.json` is 1.1, and v2 imports 3.0 only. Producing the 3.0 file is an
  agency-side prerequisite with no owner assigned by this record — the single
  largest cost of the no-conversion amendment.
- **Onboarding now depends on work v2 neither owns nor schedules.** A conversion
  defect, or an agency without the capacity to run a CLI, blocks onboarding with no
  lever available to the Inventory team.
- **Work is pushed onto agency staff**, across ~350 organizations. Each needs
  review of the converted draft and authoring of genuinely new 3.0 fields — **and,
  now, the conversion itself.** This is coordination effort, not engineering
  effort, but it grew.
- **Stale published files produce stale imports.** An agency whose
  `data.json` has not been regenerated recently will import outdated metadata.
- **Anything in v1 but not in the published export is silently absent.** The
  import cannot report what it never saw. Per-organization dataset counts should
  be compared between v1 and the imported result as a reconciliation check.
- **Conversion is imperfect by nature, and v2 can no longer see how.** 1.1 has no
  `DataService`, structured `Location`, or `Concept` vocabularies, so imported
  catalogs will be valid 3.0 but will not exploit all of 3.0's new capabilities
  without human authoring. `DatasetSeries` is partially recovered from 1.1
  `isPartOf` by upstream's converter; nested series are not supported and raise a
  conversion error. **Because conversion happens outside v2, none of this appears
  in an Inventory-side report** — v2 sees only the result.
- **v1 decommissioning is now gated twice**, on completed re-import *and* on no
  agency still needing its `dcat-v3.json` converter. Two gates that must be tracked
  separately.

### Compliance Consequences

- **SI-10 (Input Validation)** — imports validate against **DCAT-US 3.0 only**.
  The dual-side (1.1 in, 3.0 out) validation this record originally specified is
  gone with the conversion step, so there is one validation boundary rather than
  two. The `jsonschema` version must still be **pinned explicitly**: v1 leaves it
  unpinned, so `ckanext-datajson`'s `~=2.4.0` constraint wins in production and
  validation silently degrades to Draft 4, reporting fewer errors than the data
  contains. A validation control that fails open is worse than one that fails
  closed. **3.0-on-ingest validation now carries more weight than before**, because
  it is the only check standing between an out-of-boundary conversion and the
  catalog. Import remains an untrusted-input boundary: imported catalogs come from
  public URLs and must be treated as untrusted data, with URL fetching going
  through the egress proxy and subject to the live-catalog URL scanning the wiki
  already requires.
- **SI-12 (Information Management and Retention)** — **the open question.** v2's
  audit trail begins at import, so v1's history exists only in the v1 database.
  Whether that constitutes a record requiring retention under NARA schedules is
  a question for the records officer, not an engineering judgment. If retention
  is required, the v1 database must be archived before decommissioning, and that
  should be tracked as its own item.
- **CP-9 (System Backup)** — the v1 database must not be decommissioned until
  every agency has completed and verified re-import. A per-organization
  completion checklist gates v1 shutdown. **A second gate now applies:** v1's
  `/organization/{id}/dcat-v3.json` endpoint is one of only two conversion routes,
  so decommissioning also removes a capability agencies may still need. The
  checklist must record, per organization, both that re-import completed and that
  the organization no longer depends on v1 for conversion.
- **CM-3 (Configuration Change Control)** — each import should record the
  `_external/dcat-us` submodule commit used, so an import is reproducible against
  the schema version that validated it (consistent with ADR 0005). That commit now
  identifies the **3.0 schemas and the error summarizer** v2 executes — no longer
  the conversion code, which runs outside v2 at an unrecorded version. **This is a
  provenance gap the amendment introduces:** an imported catalog is reproducible
  against v2's validator but not against whatever converted it. If conversion
  provenance matters, the importing user should be asked to record the converter
  version alongside the source URL. Pinning the submodule remains required rather
  than tracking `branch = main` (see [ADR 0010](0010-depend-on-upstream-dcat-us-code.md)).
- **CM-4 (Impact Analysis)** — the dataset-count reconciliation per organization
  is the impact analysis for this transition and should be recorded.
- **CM-7 (Least Functionality)** — *newly relevant, and the one control the
  amendment strengthens.* v2 does not load the 1.1 schemas, does not run the
  transforms, and has no conversion endpoint. One fewer input format and one fewer
  code path inside the boundary.
- **Risk treatment is `accept`**, not `mitigate`: the accepted risk is loss of
  v1 edit history in v2, accepted because the metadata itself is public and
  canonical elsewhere, and because v1's database can be archived independently
  if a retention obligation is identified. **The amendment adds a second accepted
  risk:** that agencies can and will produce valid 3.0 files out-of-band. If that
  proves false in practice, the no-conversion decision needs revisiting.

## Links

- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — import/export from a current DCAT-US 3.0 catalog
- [DCAT-US 3.0 migration guide](https://resources.data.gov/resources/dcat-us-3-migration/) and [M-25-05 crosswalk](https://resources.data.gov/resources/dcat-us-3-crosswalk/)
- [GSA/dcat-us 1.1→3.0 conversion script](https://github.com/GSA/dcat-us/blob/main/jsonschema/convert_dcat_1_1_to_3_0.py) and [`transforms.py`](https://github.com/GSA/dcat-us/blob/main/jsonschema/transforms.py) — the conversion implementation agencies run **out-of-band**; **not** part of v2 ([`architecture.md` §3](../architecture.md#v2-does-not-convert-dcat-us-11))
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) — why user accounts need no migration
- [ADR 0012](0012-catalog-scoped-hosted-files.md) — makes hosted files catalog-scoped and independent of metadata, which is why a swap cannot affect them
- [ADR 0010](0010-depend-on-upstream-dcat-us-code.md) — how v2 depends on upstream 3.0 validation code, and why v1's fork is not the source
- `ckanext/datagov_inventory/dcat/dcat_converter.py` — v1's stale fork of the upstream converter; **not** the source for v2
- `ckanext/datagov_inventory/plugin.py:345-407` — v1 `generate_dcat_v3` export, now one of two supported routes to a 3.0 file
- `config/data/inventory_publishers.csv` — reference data; role in v2 undecided (see ADR 0005)
- NIST SP 800-53 Rev 5.2 — CM-3, CM-4, CM-7, SI-10, SI-12, CP-9, SA-8
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
