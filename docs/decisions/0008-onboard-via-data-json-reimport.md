---
title: "Onboard agencies by re-importing published data.json rather than migrating from CKAN"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Deployment and Infrastructure"
nist_controls: ["CM-3", "SI-10", "SI-12", "CP-9", "CM-4", "SA-8"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "accept"
---

# Onboard agencies by re-importing published data.json rather than migrating from CKAN

## Context and Problem Statement

Inventory v1 holds agency metadata in CKAN's database as DCAT-US 1.1 datasets.
v2 uses a different data model (ADR 0005) and a different metadata version
(DCAT-US 3.0). We must decide whether to build a migration path from the v1
CKAN database into v2, or have agencies re-establish their catalogs in v2 by
importing their published `data.json`.

## Decision Drivers

- **Every agency's metadata is already published and publicly reachable.** The
  entire purpose of Inventory is to generate a `data.json` that the agency hosts
  at `agency.gov/data.json`. The migration source is therefore public, canonical,
  and available without any access to the v1 database.
- **A 1.1 → 3.0 converter already exists upstream and is well tested.**
  [`GSA/dcat-us`](https://github.com/GSA/dcat-us/tree/main/jsonschema) — the
  repository that hosts the schemas, already vendored here as the
  `_external/dcat-us` submodule — contains `transforms.py` (499 lines, 13
  dataset-level transforms) and `convert_dcat_1_1_to_3_0.py` (558 lines), which is
  *already* a standalone CLI that fetches a remote v1.1 catalog, converts it,
  validates both sides, promotes legacy `isPartOf` relationships into
  catalog-level `DatasetSeries`, and reports counts. It is backed by 719 lines of
  tests. The migration tool is largely written, and it is **not** v1's copy: v1's
  `ckanext/datagov_inventory/dcat/` is a July-2026 fork that has drifted behind
  upstream and lacks the `DatasetSeries` promotion this ADR's import path needs
  ([`architecture.md` §1](../architecture.md#the-conversion-code-already-exists--upstream-not-in-v1)).
- **A database-level migration would have to bridge both a model change and a
  schema-version change simultaneously**, and would need to reproduce CKAN's
  `package_extras` conventions — the exact thing v2 exists to escape.
- **Import produces reuse automatically.** Under ADR 0005, `payload_hash`
  content-addressing means importing a flat catalog converges repeated contact
  points and publishers onto shared objects. Import is not a lossy shortcut; it
  is the mechanism that produces the desired structure.
- **v1 remains available during transition.** Nothing is deleted by this
  decision; v1 continues serving until agencies have re-established in v2.
- **1.1 → 3.0 is not a lossless mechanical mapping.** Some 3.0 constructs
  (`DataService`, `Concept` vocabularies, structured `Location`) have no 1.1
  source and require human authoring regardless of migration approach.
  `DatasetSeries` is the exception worth naming: 1.1's `isPartOf` ("Collection",
  a bare identifier string) *is* a source for it, and upstream's converter
  already promotes those relationships — so series structure survives import
  where the others do not.

## Considered Options

1. **Re-import from published `data.json`.** Agencies (or Data.gov staff on their
   behalf) import the agency's public DCAT-US 1.1 catalog; the existing converter
   produces a 3.0 catalog in `draft` state for review before going `live`.
2. **Database migration from CKAN.** Read the v1 CKAN database directly,
   convert packages and extras to v2 objects, and populate v2.
3. **Export/import via the v1 DCAT-US 3.0 export.** Use v1's existing
   `/organization/<id>/dcat-v3.json` endpoint as the source rather than the
   agency's published 1.1 file.
4. **Dual-run with synchronization** during a transition window.

## Decision Outcome

Chosen option: **Option 1 — re-import from published `data.json`**, because the
source data is already public and canonical, the conversion tooling already
exists and is tested, and the import path produces the shared-object structure
v2 wants rather than faithfully reproducing the CKAN structure v2 is abandoning.

Option 3 deserves note as a close variant and a useful fallback: v1's
`generate_dcat_v3` view (`plugin.py:345-407`) already emits a 3.0 catalog per
organization, which would skip the conversion step entirely. It is not chosen as
the primary path because it requires v1 to be running and reachable at migration
time, whereas the agency's published file does not — but it is the right tool for
any organization whose published `data.json` is stale or unreachable.

**If Option 3 is used, its output must be re-validated on import rather than
trusted.** That endpoint runs v1's stale fork of the converter, and in production
v1 validates with a silently degraded Draft 4 validator (`jsonschema` is unpinned;
`ckanext-datajson`'s `~=2.4.0` constraint wins, and `referencing` is unusable
because `rpds-py` is absent from the freeze). A catalog that endpoint reports as
clean is not known to be valid 3.0.

Option 4 is rejected: synchronizing two different data models across two metadata
versions is substantial engineering for a transition that needs no continuity
guarantee.

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

#### What a swap destroys

Both of these are limitations to state, not problems to solve here:

1. **Curation is discarded.** This record requires human review of the converted
   draft plus authoring of genuinely new 3.0 fields — `DataService`, structured
   `Location`, `Concept` vocabularies — that have no 1.1 source. A re-import wipes
   all of it, because the incoming `data.json` cannot contain it. Re-import is
   appropriate for a retry during onboarding and is **not an update mechanism** for
   a curated catalog. The UI must say so before the user commits, not after.
2. **`object_version` history for the replaced objects.** The version trail is
   declared append-only and hangs off `metadata_object`, so deleting those rows
   either cascades the history away or leaves it dangling. This collides with
   AU-2/AU-3/AU-10.

#### Open question: is Inventory ever a publishing conduit?

This amendment assumes import is **onboarding-shaped** — roughly once per agency,
plus retries — because in v2 Inventory *generates* `data.json` rather than relaying
it. An agency that maintains metadata in its own system does not need Inventory at
all; it hosts its own file and `harvest.data.gov` harvests it.

**If that assumption is wrong** — if an agency is expected to author elsewhere and
re-publish through Inventory on a schedule — then destroy-and-rebuild is the wrong
semantics, because each cycle discards curation and audit history, and merge
returns as a requirement. Confirm the assumption before this record is accepted.

### Compliance consequences of the amendment

- **AU-2, AU-3, AU-10** — a swap must be a single audit event recording the source
  URL, the `_external/dcat-us` submodule commit, the outgoing and incoming object
  counts, and the actor who approved it. Without that, the disappearance of an
  object set is unexplained in the trail.
- **CM-4 (Impact Analysis)** — the per-organization dataset-count reconciliation
  this record already requires applies to each re-import, not only the first,
  since a swap can silently shrink a catalog if the published file has regressed.
- **SI-12** — see the `object_version` question above.

### Notable consequence: agencies can rehearse before v2 exists

Because the input is the agency's own public file and upstream's
`convert_dcat_1_1_to_3_0.py` is already a CLI with a `--dry-run` flag, an agency
(or Data.gov staff) can convert and validate a catalog today and see essentially
the error report v2 would produce. This turns migration risk into a pre-launch
activity rather than a launch-day surprise, and it gives the conversion code
real-world exercise before it is on the critical path.

Two caveats on "the exact error report": v2 will add its own graph-decomposition
errors on top of upstream's validation output, and the rehearsal must be run
against upstream's copy — **not** v1's `dcat_converter.py`, which is a stale fork
that omits `transform_theme` and `DatasetSeries` promotion and will therefore
report differently.

### What is not migrated

- **User accounts.** Not needed: ADR 0004 creates accounts just-in-time on first
  Login.gov authentication.
- **Version history.** v1's CKAN revision history is not carried into
  `object_version`. v2's audit trail begins at import. This is the main accepted
  loss — see below.
- **Draft datasets.** Anything not in the published `data.json` is not imported.
  Agencies with unpublished drafts in v1 must re-enter them or use the Option 3
  fallback (v1 has an "Export Drafts" capability at
  `templates/organization/read.html:9`, which makes this recoverable).
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
  organization.

### Negative Consequences

- **Version history does not survive.** v1's edit history is not carried into
  `object_version`. If historical attribution has a retention obligation, the v1
  database must be preserved separately as an archive — this ADR does not create
  that archive, and someone must decide whether one is required (see below).
- **Work is pushed onto agency staff**, across ~350 organizations. Each needs
  review of the converted draft and authoring of genuinely new 3.0 fields.
  This is coordination effort, not engineering effort, but it is not free.
- **Stale published files produce stale imports.** An agency whose
  `data.json` has not been regenerated recently will import outdated metadata.
  Mitigated by the Option 3 fallback.
- **Anything in v1 but not in the published export is silently absent.** The
  import cannot report what it never saw. Per-organization dataset counts should
  be compared between v1 and the imported result as a reconciliation check.
- **Conversion is imperfect by nature.** 1.1 has no `DataService`, structured
  `Location`, or `Concept` vocabularies, so imported catalogs will be valid 3.0
  but will not exploit all of 3.0's new capabilities without human authoring.
  `DatasetSeries` is partially recovered from 1.1 `isPartOf` by upstream's
  converter; nested series are not supported and raise a conversion error.

### Compliance Consequences

- **SI-10 (Input Validation)** — imports validate against DCAT-US 1.1 on input
  and 3.0 on output, using upstream's dual-validation path in
  `convert_dcat_1_1_to_3_0.py`. The `jsonschema` version must be **pinned
  explicitly**: v1 leaves it unpinned, so `ckanext-datajson`'s `~=2.4.0`
  constraint wins in production and validation silently degrades to Draft 4,
  reporting fewer errors than the data contains. A validation control that fails
  open is worse than one that fails closed. Import is also an untrusted-input
  boundary: imported catalogs come from public URLs and must be treated as
  untrusted data, with URL fetching going through the egress proxy and subject to
  the live-catalog URL scanning the wiki already requires.
- **SI-12 (Information Management and Retention)** — **the open question.** v2's
  audit trail begins at import, so v1's history exists only in the v1 database.
  Whether that constitutes a record requiring retention under NARA schedules is
  a question for the records officer, not an engineering judgment. If retention
  is required, the v1 database must be archived before decommissioning, and that
  should be tracked as its own item.
- **CP-9 (System Backup)** — the v1 database must not be decommissioned until
  every agency has completed and verified re-import. A per-organization
  completion checklist gates v1 shutdown.
- **CM-3 (Configuration Change Control)** — each import should record the
  `_external/dcat-us` submodule commit used, so an import is reproducible against
  the schema version that validated it (consistent with ADR 0005). This commit now
  identifies the **conversion code** as well as the schemas, which is a further
  reason the submodule must be pinned rather than tracking `branch = main`
  (see [ADR 0010](0010-depend-on-upstream-dcat-us-code.md)).
- **CM-4 (Impact Analysis)** — the dataset-count reconciliation per organization
  is the impact analysis for this transition and should be recorded.
- **Risk treatment is `accept`**, not `mitigate`: the accepted risk is loss of
  v1 edit history in v2, accepted because the metadata itself is public and
  canonical elsewhere, and because v1's database can be archived independently
  if a retention obligation is identified.

## Links

- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — import/export from a current DCAT-US 3.0 catalog
- [DCAT-US 3.0 migration guide](https://resources.data.gov/resources/dcat-us-3-migration/) and [M-25-05 crosswalk](https://resources.data.gov/resources/dcat-us-3-crosswalk/)
- [GSA/dcat-us 1.1→3.0 conversion script](https://github.com/GSA/dcat-us/blob/main/jsonschema/convert_dcat_1_1_to_3_0.py) and [`transforms.py`](https://github.com/GSA/dcat-us/blob/main/jsonschema/transforms.py) — **the implementation this ADR depends on**, already vendored as `_external/dcat-us`
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — `payload_hash` content-addressing that makes import produce reuse
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) — why user accounts need no migration
- [ADR 0010](0010-depend-on-upstream-dcat-us-code.md) — how v2 depends on that upstream code, and why v1's fork is not the source
- `ckanext/datagov_inventory/dcat/dcat_converter.py` — v1's stale fork of the upstream converter; **not** the source for v2
- `ckanext/datagov_inventory/plugin.py:345-407` — v1 `generate_dcat_v3` export, the Option 3 fallback
- `config/data/inventory_publishers.csv` — reference data; role in v2 undecided (see ADR 0005)
- NIST SP 800-53 Rev 5.2 — CM-3, CM-4, SI-10, SI-12, CP-9, SA-8
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
