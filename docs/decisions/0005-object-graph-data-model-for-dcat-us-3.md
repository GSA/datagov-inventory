---
title: "Store DCAT-US 3.0 metadata as a versioned object graph in Postgres"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Data Handling"
nist_controls: ["AU-2", "AU-3", "AU-10", "AC-3", "SI-10", "SI-12", "CM-3", "SC-28"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "mitigate"
---

# Store DCAT-US 3.0 metadata as a versioned object graph in Postgres

## Context and Problem Statement

The stated reason for leaving CKAN is that *"the CKAN metadata model is not very
compatible with the nested object classifications of DCAT-US 3.0."* DCAT-US 3.0
introduces `DatasetSeries`, `DataService`, `CatalogRecord`,
`Concept`/`ConceptScheme`, and `Location`; promotes `contactPoint` from a single
vCard to one or more `Kind` objects; and allows catalogs to embed other
catalogs. CKAN's flat package-plus-extras model cannot express this without
encoding structure into string keys. v2 must choose a storage model, and because
the data model *is* the reason for the rewrite, this decision carries more weight
than the framework choice.

The model must also support requirements that the storage layer determines:
per-object `draft`/`live` state excluded from export, class/object reuse across
datasets, version history with editor attribution, and catalog-to-catalog
sharing.

## Decision Drivers

- **Reuse is a first-class requirement, not an optimization.** The wiki: *"The
  classes and objects will be able to be created/defined for re-use by metadata
  providers... This will keep agencies consistent within their catalogs."* A
  shared `Kind` or `Organization` must have independent identity.
- **Versioning with editor attribution is required.** *"We will maintain
  historical object tracking along with user edit information. All changes will
  be available for auditability"* (AU-2, AU-3, AU-10).
- **Draft state is per object, not per catalog.** *"Classes/objects in `draft`
  state are not exported in the catalog."*
- **The v1 visibility model is a documented mess and must not be reproduced.**
  The current wiki describes three overlapping concepts — CKAN `private`,
  DCAT `accessLevel`, and Inventory publishing status — that interact
  confusingly, with resources publicly visible while datasets are not
  (GSA/data.gov#2095). v2 needs exactly one authoritative state field.
- **The authoritative validator operates on assembled JSON.** The upstream
  `GSA/dcat-us` validator validates a complete nested catalog against
  `Catalog.json`. Storage must round-trip losslessly to that shape (SI-10).
- **Schema evolution must be cheap.** DCAT-US 3.0 point releases should be a
  `_external/dcat-us` submodule bump, not a migration.
- **Import must produce reuse automatically.** Agencies onboard by importing a
  flat `data.json` (ADR 0008); reuse should emerge from import rather than
  requiring manual deduplication.
- **Scale is modest.** Inventory holds thousands of datasets per organization,
  not `catalog.data.gov`'s 515,000 — so normalization costs are affordable and
  search does not require a dedicated engine.

## Considered Options

1. **Hybrid object graph.** A `metadata_object` table with `dcat_class`, `state`,
   and a `JSONB metadata_properties` holding only that object's *own scalar* properties.
   Nesting and reuse are edges in an `object_reference` table
   (`parent_object_id`, `child_object_id`, `property`, `ordinal`).
2. **Document store.** One `JSONB` column per catalog holding the entire nested
   document; validate on write.
3. **Fully normalized relational schema.** A table per DCAT class with typed
   columns and foreign keys.
4. **Triplestore / RDF.** Model DCAT-US natively as RDF in a graph database.

## Decision Outcome

Chosen option: **Option 1 — hybrid object graph**, because it is the only option
in which independent object identity (required for reuse, per-object draft state,
and per-object version history) and cheap schema evolution are both true at once.

Option 2 cannot give an embedded `Kind` its own identity, `state`, or version
history without inventing addressing conventions inside the document — which is
CKAN's mistake in a new costume. Option 3 makes every schema point release a
migration, directly contradicting the submodule-bump requirement. Option 4 is
the most semantically faithful option and is genuinely defensible, but it
introduces an unfamiliar datastore, no cloud.gov brokered service, and a
SPARQL-shaped operational skill gap for a system whose interchange format is
JSON Schema, not RDF — the fidelity is not worth the platform cost here.

### Shape

```
catalog(id, root_object_id → metadata_object UNIQUE, created_by, created_at)
    identity + authorization anchor only; survives re-import unchanged

catalog           ── root_object_id ──▶ metadata_object (dcat_class='Catalog')
catalog           ── catalog_link ──▶ catalog            (embedded catalogs, live only)
catalog           ── catalog_permission ──▶ user_account | catalog   (read | edit | admin)
catalog           ── scopes ──▶ metadata_object          (catalog_id on every object)
user_account      ── created ──▶ catalog                 (creator; not a tenant boundary)

metadata_object(id, catalog_id, dcat_class, state, metadata_properties JSONB,
                search_vector tsvector)
object_reference(parent_object_id, child_object_id, property, ordinal)
```

Top-level catalog membership is `object_reference` from the root object with
`property = 'dcat:dataset' | 'dcat:service' | 'dcat:datasetSeries'`.

**Hosted files are deliberately absent from this shape.**
[ADR 0012](0012-catalog-scoped-hosted-files.md) makes a hosted file a
catalog-scoped resource — `hosted_file` / `hosted_file_version`, scoped by
`catalog_id`, referencing no `metadata_object` — and **it is not part of the
object graph and should not be added to it.** A `Distribution` holds only a
`downloadURL` string, exactly as it does for an agency-hosted file, so the graph
has no file-shaped node and no edge kind for one.

Three properties do the work, each mapping to a stated requirement:

- **`object_reference` is the reuse mechanism.** One `Kind` row referenced by
  fifty datasets. Export is a recursive walk that assembles nested JSON; import
  is the inverse. `ordinal` preserves JSON array order — DCAT-US properties are
  ordered arrays and SQL rows are not, so without it the round-trip property
  asserted below is false for any object with two or more children.
- **`state` on `metadata_object`** makes "drafts are not exported" a
  `WHERE state = 'live'` predicate on the export walk — one authoritative field,
  replacing the v1 three-way confusion.
- **`catalog` holds identity, a `Catalog`-class `metadata_object` holds content.**
  The authorization anchor and the export URL are permanent; the DCAT properties
  are replaceable. Separating them makes ADR 0008's re-import swap a single
  pointer write.

Search uses Postgres full-text search (`tsvector` + GIN) on
`metadata_object.search_vector`. **OpenSearch is explicitly not adopted**;
`catalog.data.gov` needs it at 515k datasets, Inventory does not.

### Catalog identity is separate from Catalog content

`Catalog` is a DCAT-US 3.0 class and it makes sense to treat it like all other `metadata_object` types.

At the same time, the `catalog` type genuinely does carry non-DCAT
responsibilities: it is the `catalog_permission` anchor, the export URL, and the
identity that [ADR 0008](0008-onboard-via-data-json-reimport.md) requires to
survive a re-import.

**Those are two different lifetimes, so they are two different rows.**

| Row | Holds                                                                                            | Lifetime |
|---|--------------------------------------------------------------------------------------------------|---|
| `catalog` | `id`, `root_object_id`, `created_by`, `created_at`                                               | Permanent |
| `metadata_object` where `dcat_class = 'Catalog'` | DCAT scalars in `metadata_properties`; top-level membership as outbound `object_reference` edges | Replaced wholesale by re-import |

#### `catalog_link` is its own table

Embedded catalogs are **not** folded into `object_reference`. An embedding edge
must reference the *identity* of the embedded catalog, because
[ADR 0008](0008-onboard-via-data-json-reimport.md#what-the-catalog-identity-carries-across-a-swap)
guarantees inbound embedding survives a re-import of the embedded catalog. An
edge pointing at that catalog's root *object* would dangle the moment its
`root_object_id` moved — breaking the guarantee that is the main reason identity
transfer was chosen over creating a new catalog.

So `catalog_link(parent_catalog_id, child_catalog_id, ordinal)` references
`catalog(id)`, and the export walk has two edge kinds by design. The uniformity
gain is available for membership and not for embedding; taking it only where it is
sound is the point.

This also means cycle handling keeps both mechanisms already specified in this
record: write-time acyclicity on `catalog_link`, and a depth bound on the
`object_reference` walk.

#### The walk re-authorizes at every catalog boundary

`AC-3` below states that "every query is scoped by `catalog_id`." A walk crossing
a `catalog_link` **leaves that scope by construction**, so scope-plus-permission
is no longer sufficient on its own.

**Requirement:** when the walk enters an embedded catalog, it re-checks
`catalog_permission` for that catalog — including transitive grants — before
emitting any of its content. Having `catalog_link` as a separate table helps
here, since the crossing is a visible seam in the code rather than an
indistinguishable graph edge. This is an explicit requirement with its own test,
not an emergent property.

#### Two schema constraints, both required

- **`UNIQUE` on `catalog.root_object_id`.** Without it, two catalogs can share a
  root object and the identity/content separation collapses.
- **The foreign keys are mutually circular** — `catalog.root_object_id` →
  `metadata_object.id` and `metadata_object.catalog_id` → `catalog.id`. One side
  must be `DEFERRABLE INITIALLY DEFERRED`, or nullable and set immediately after
  insert within the same transaction. This is DDL friction to handle in the
  Alembic baseline, not a design problem, but it will not work if written naively.

### Positive Consequences

- Every DCAT-US 3.0 class is representable, including ones with no CKAN analogue
  (`Catalog`, `DatasetSeries`, `DataService`, `CatalogRecord`, `ConceptScheme`).
- Adding or changing a class is a submodule bump plus form-model regeneration —
  no DDL migration, because class-specific fields live in `metadata_properties`.
- Catalog-to-catalog sharing is native: `catalog_permission` accepts either a
  user or a catalog as principal. Since that feature is MVP scope, the model
  carries it from the first release rather than requiring a later schema change.
- **No tenant entity.** v1's CKAN agency/bureau organization is not carried
  forward: agency silos are not a first-class concept in v2, so the isolation
  boundary is the catalog and nothing is inherited from an enclosing container.
  `user_account ── created ──▶ catalog` is provenance for audit, not ownership,
  and conveys no privilege. See
  [`architecture.md` §4](../architecture.md#there-is-no-agencybureau-tenant-entity).
- One Postgres service. With the DataStore retired (ADR 0007) and Redis dropped,
  v2 has a single stateful backing service where v1 had three.

### Negative Consequences

- **Export requires a recursive graph walk**, which is more code than
  `SELECT metadata_properties` and is the highest-risk correctness surface in the system.
  Mitigations: assembly lives in the pure-Python library with property-based
  round-trip tests (assemble∘decompose ≡ identity), and every export is
  validated against `Catalog.json` before delivery.
  **The stated property covers one direction only.** `assemble ∘ decompose`
  (JSON → graph → JSON) is identity; `decompose ∘ assemble` (graph → JSON → graph)
  is **not**, because DCAT-US 3.0 has no reference form and in-run convergence
  merges objects whose scalars coincide. Two deliberately-distinct `Organization`
  rows survive export as indistinguishable inlined copies and re-import as one.
  This is inherent, not a defect to fix — but the test suite must not claim a
  round-trip property it does not have, and the loss should be stated in the UI
  where users can see it before they re-import.
- **Cycles are possible** — embedded catalogs and `object_reference` edges can
  both form loops. The walk needs cycle detection with a depth bound, and
  `catalog_link` needs an acyclicity check on write. A cycle discovered only at
  export time is a denial-of-service against the export path. **This is MVP work,
  not deferrable:** catalog-to-catalog sharing is MVP scope (see
  [`architecture.md` §4](../architecture.md#catalog-to-catalog-sharing-is-mvp-scope)),
  so embedded catalogs — and therefore the cycle risk — exist from the first
  release.
- **`JSONB metadata_properties` is schemaless at the database layer**, so the database will
  not catch a malformed properties object; validation is entirely an application
  responsibility (SI-10). This is deliberate — it is what buys cheap schema
  evolution — but it means validator coverage is load-bearing.
- **Shared objects create shared blast radius.** Editing a `Kind` used by 50
  datasets changes all 50. The UI must show reference counts before editing, and
  copy-on-write must be offered. Without this, reuse becomes a footgun.
- **The export walk traverses two kinds of edge**, `object_reference` within a
  catalog and `catalog_link` between catalogs. Membership is uniform; embedding is not. The walk
  therefore has a mode switch, and that switch is where catalog-boundary
  re-authorization must happen.
- **The `catalog` ⟷ `metadata_object` foreign keys are mutually circular**, so the
  Alembic baseline needs a deferrable constraint or a nullable pointer set
  post-insert. Minor, but it fails if written naively.
- More joins than a document store. Acceptable at this scale; mitigated by
  indexes on `object_reference(parent_object_id)` and
  `metadata_object(catalog_id, dcat_class, state)`.

### Compliance Consequences

- **AC-3 (Access Enforcement)** — every query is scoped by `catalog_id` and
  checked against `catalog_permission`. **Object identifiers must not be
  treated as authorization**; a direct-object-reference check is required on
  every object route, since reusable objects are addressable independently of
  the catalog a user reached them through. This is the model's main new access
  risk and must be an explicit test case.
  Because catalog-to-catalog sharing is MVP scope, authorization resolution must
  handle a **catalog** principal and **transitive** grants through embedded
  catalogs from the first release — not only the direct user-to-catalog case.
  Transitive resolution is the harder half and needs its own test coverage.
  **The `catalog_id` scope is not sufficient on its own during the export walk**,
  which crosses catalog boundaries via `catalog_link` by design; the walk must
  re-authorize on entering an embedded catalog (see
  [the amendment above](#the-walk-re-authorizes-at-every-catalog-boundary)).
- **SI-10 (Input Validation)** — all imports and exports validated against
  DCAT-US JSON Schema (Draft 2020-12) by the single Python validator.
- **CM-3 (Configuration Change Control)** — schema version (`_external/dcat-us`
  submodule commit) should be recorded on `export_run` so an export is
  reproducible against the schema that validated it.
- **SC-28 (Protection at Rest)** — encryption at rest provided by the cloud.gov
  RDS brokered service. No field-level encryption: DCAT metadata is public open
  data by definition and contains no PII beyond publicly published contact
  points.

### Open question: what becomes of the publishers reference data?

[config/data/inventory_publishers.csv](https://github.com/GSA/inventory-app/blob/main/config/data/inventory_publishers.csv) (~270 rows encoding a department → bureau
hierarchy) was v1's organization registry. With no tenant entity in v2 it is no
longer structural data, and its only remaining candidate purpose is **seed data
for reusable DCAT `Organization` objects** so that agency staff select a canonical
publisher instead of typing one.

That is a convenience feature and it is not designed. Open sub-questions: whether
the department → bureau hierarchy is represented at all (DCAT-US 3.0 has no
required parent/child relation between `Organization` objects); whether seeded
objects are global or copied per catalog; and whether the existing
`update_publishers.yml` workflow still has anything to update. **Decide before
building the publisher picker, not after.**

## Links

- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design)
- [DCAT-US 3.0](https://github.com/GSA/data.gov/wiki/DCAT-US-3.0) and [DCAT-US 1.1 vs 3.0](https://github.com/GSA/data.gov/wiki/DCAT-US-1.1-vs-3.0) — structural differences driving this model
- [DCAT-US 3.0 Catalog class](https://resources.data.gov/standards/catalog/dcat-us-3/catalog/#catalog) — embedded-catalog semantics
- [GSA/data.gov#2095](https://github.com/GSA/data.gov/issues/2095) — the v1 visibility confusion this model replaces
- [ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md) — consumes the schema→form model
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) — `catalog_permission` semantics
- [ADR 0008](0008-onboard-via-data-json-reimport.md) — import path that produces the shared-object structure
- [ADR 0012](0012-catalog-scoped-hosted-files.md) — hosted files as a catalog-scoped resource **outside** this object graph; shares this record's orphan-definition question
- [`GSA/dcat-us` `jsonschema/`](https://github.com/GSA/dcat-us/tree/main/jsonschema) — the upstream 3.0 validator and error summarizer v2 consumes; `ckanext/datagov_inventory/dcat/` is a stale fork of it, not a source ([`architecture.md` §8](../architecture.md#consume-upstream-own-only-the-graph-layer))
- NIST SP 800-53 Rev 5.2 — AU-2, AU-3, AU-10, AC-3, SI-10, SI-12, CM-3, SC-28
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
