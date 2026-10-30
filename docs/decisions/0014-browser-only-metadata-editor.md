---
title: "Build phase 1 as an anonymous browser-only metadata editor"
status: "proposed"
date: "2026-10-30"
decision_makers: ["Data.gov engineering team"]
category: "Input Validation and Output Handling"
nist_controls: ["SI-10", "SI-15", "SC-18", "CM-2", "CM-3", "SA-8", "SA-15", "SR-3"]
impact_level: "moderate"
ato_relevance: "yes-boundary"
risk_treatment: "mitigate"
---

# Build phase 1 as an anonymous browser-only metadata editor

## Context and Problem Statement

Inventory's first deliverable is now an anonymous tool for creating, ingesting,
editing, validating, and exporting DCAT-US 3.0 catalogs. It must run without an
application backend while preserving a clean path to the authenticated,
collaborative phase 2 service. This supersedes ADR 0002's proposed hybrid of
server-rendered Flask pages and one React editor route.

## Decision Drivers

- Phase 1 must not require accounts, server persistence, or an application API.
- Catalog work must survive reloads and browser restarts.
- Reusable DCAT objects need stable identity and ordered relationships.
- The alpha must measure browser performance with catalogs containing at least
  3,000 datasets and publish the supported limit established by those results.
- Section 508 and WCAG 2.1 AA apply to the complete application.
- Forms and help text must be generated from the pinned DCAT-US 3.0 schemas.
- The Data.gov validator API remains the one authoritative validation service.
- Storage and UI details must not leak into the DCAT graph algorithms so phase 2
  can reuse their behavior and test fixtures.

## Considered Options

1. **A React/TypeScript browser application using IndexedDB**, with a pure DCAT
   domain library and storage behind a repository interface.
2. **One nested JSON document per catalog.** Simpler persistence, but small edits
   clone and rewrite the complete catalog and object reuse has no independent
   storage identity.
3. **The Flask/React hybrid in ADR 0002.** Rejected for phase 1 because it adds a
   backend while the product requirement is browser-only editing.
4. **Session-memory-only editing.** Rejected because refresh or browser restart
   would destroy work.

## Decision Outcome

Chosen option: **Option 1**. Phase 1 is a static React/TypeScript application
using USWDS components and IndexedDB. There is no Inventory application backend.

### Application boundaries

```text
React + USWDS user interface
        |
Editor application services
        |
Pure TypeScript DCAT domain library
  ingest | graph edits | assemble | export reporting
        |
CatalogRepository interface
        |
IndexedDB implementation
```

The domain library imports neither React nor IndexedDB. It operates on complete
in-memory graph snapshots. The repository layer owns IndexedDB transactions and
mapping records to and from that graph.

`CatalogRepository` is the persistence seam between editor services and catalog
storage. Its contract covers listing catalogs, loading a consistent graph
snapshot, and creating, saving, or deleting a graph with an expected revision.
In phase 1, `IndexedDbCatalogRepository` implements that contract over the
separate object stores below and owns local transactions, revisions, quota
errors, and storage migrations. In phase 2, an API-backed or coordinating
implementation can expose the same graph shape while handling authenticated HTTP
requests, server revisions, conflicts, and network failures. This abstraction
does not define synchronization, authorization, or server trust: the phase 2
backend still independently authorizes and validates every submitted graph, and
the UI must distinguish a local save from an authoritative server save.

Complete graph snapshots are a phase 1 storage and export strategy, not a
permanent requirement of every `CatalogRepository` implementation. Phase 1 may
publish measured limits for import bytes, object and reference counts, nesting
depth, individual values, and assembled export size. Inputs over those limits
fail early with a clear explanation rather than exhausting browser memory or
blocking the main thread.

Phase 2 must support the full range of catalogs held by current Inventory users,
including catalogs that exceed phase 1 browser limits. Its repository boundary
may therefore split into granular query and command interfaces: cursor-paginated
object summaries, filtered search, on-demand object and reference details, and
revision-checked graph operations. The browser lazily loads and virtualizes only
the current working set and uses IndexedDB as a bounded cache, not a required
complete mirror. Whole-catalog import, integrity checks, assembly, validation,
and export move to the authoritative backend and may run as tracked asynchronous
jobs when measured catalog sizes require it. Stable IDs, graph semantics, and
edit operations are the compatibility commitments between phases; complete
browser materialization is not.

### IndexedDB records

IndexedDB stores separate records rather than one complete catalog document:

| Object store | Key and required indexes | Purpose |
|---|---|---|
| `catalogs` | key `id` | Root object ID, schema version, local revision, timestamps |
| `metadataObjects` | key `id`; index `catalogId` | DCAT class and own scalar properties |
| `objectReferences` | key `id`; indexes `parentObjectId`, `childObjectId`, and `[parentObjectId, property, ordinal]` | Ordered nesting and reuse edges |
| `catalogLinks` | key `id`; indexes `parentCatalogId`, `childCatalogId`, and `[parentCatalogId, ordinal]` | Embedded-catalog identity edges |

Catalog, object, and edge IDs are UUIDs generated by the browser, not IndexedDB
auto-increment keys. Writes that change multiple stores use one read/write
transaction. IndexedDB has no foreign keys or check constraints, so the domain
library verifies roots, scopes, referenced IDs, ordinal integrity, cycles, and
depth bounds before committing a graph-changing operation and again before
export.

The object-store schema is versioned. IndexedDB migrations preserve user data or
fail visibly; the application never silently clears an incompatible database.

### IndexedDB data lifecycle

IndexedDB is persistent browser storage scoped to the application's exact origin
(scheme, host, and port). A catalog normally survives reloads, browser restarts,
and application deployments, but does not automatically move between an alpha
domain, production domain, another browser profile, or another device.

- Catalog creation, graph edits, and deletion commit through atomic transactions.
  An interrupted transaction leaves the last committed local revision intact.
- A working copy is the current mutable local version of a catalog. Phase 1 does
  not maintain parallel branches or competing saved versions of the same catalog;
  this does not by itself prevent the browser from storing more than one distinct
  catalog.
- The UI distinguishes unsaved memory state, **saved locally** in IndexedDB,
  validated metadata, and, in phase 2, an authoritative server save. A local save
  is not a backup, publication, validation result, or audit record.
- On return, the application offers the saved working copy and requires an
  explicit choice to restore or discard it; it never silently restores catalog
  data into the editor.
- Application upgrades increment the IndexedDB schema version and migrate stored
  records in an upgrade transaction. Older open tabs must close or reload when
  notified of a version change. Failed or unknown migrations surface an error and
  never silently delete the database.
- The application monitors storage estimates, requests persistent storage where
  supported, and handles quota failures explicitly. Persistent-storage grants
  reduce eviction risk but do not prevent a user from clearing data.
- Local data can still be lost through site-data clearing, private-browsing
  cleanup, browser policy, storage pressure, profile or device loss, origin
  changes, or a faulty migration. The UI communicates this risk and provides
  regular downloadable backups through the export flow.
- Deleting a local catalog transactionally removes its scoped graph after clear
  confirmation. In phase 2, deleting a local working copy does not implicitly
  delete its server catalog, and server acceptance does not make IndexedDB the
  authoritative copy.

IndexedDB is therefore durable working storage, not archival storage. Until phase
2 introduces server persistence, a downloaded catalog is the user's only
portable recovery copy.

### Creating and ingesting catalogs

- Users can create an empty DCAT-US 3.0 catalog or import a DCAT-US 3.0 JSON file.
- Phase 1 does not accept or convert DCAT-US 1.1.
- Input is treated as untrusted data. Parsing has explicit byte, object-count,
  nesting-depth, and processing-time limits.
- A parseable catalog is decomposed into the structural shape of ADR 0005's object
  graph. Distinct object instances in the input remain distinct in phase 1, even
  when their properties are identical, so loading and exporting does not merge
  content the user did not choose to share. ADR 0008's convergence rule begins
  with authoritative phase 2 onboarding.
- Phase 1 preserves ADR 0005's catalog, object, ordered-reference, and catalog-link
  shape without exposing its `draft`/`live` publication workflow. Workflow state,
  publish, and unpublish begin in phase 2; phase 1 exports the current working
  graph as edited.
- Invalid metadata remains editable and is reported; it is not represented as
  successful authoritative validation.
- Import creates a new local catalog. It does not establish agency ownership,
  server permissions, or an audit record.

Large-file parsing, decomposition, assembly, or validation moves to a Web Worker
if the responsiveness check shows unacceptable main-thread blocking.

### Editing

- One workspace presents catalog navigation, the selected object's form, and
  validation/export status.
- Fields that reference a class support selecting an existing object or creating
  one. Creation uses a single-level dialog with an accessible return path; dialogs
  do not stack.
- Shared objects display their reference count. Editing workflows must make the
  shared impact visible and offer copy-on-write where ADR 0005 requires it.
- UI components invoke domain operations rather than mutating IndexedDB records
  directly.
- Local revisions support dirty-state reporting and stale-tab detection. They are
  not phase 2 audit records or a promise of point-in-time reconstruction.

### Validation

- Pinned DCAT-US 3.0 schema definitions from `GSA/dcat-us` are bundled at build
  time for schema-driven forms and immediate editing guidance.
- The browser calls the public Data.gov validator API directly for authoritative
  errors and warnings. The API must support the deployed origin through CORS and
  must accept non-credentialed requests.
- The interface tells users that validation sends their working catalog to the
  Data.gov service. Inventory does not validate on every keystroke.
- If the API is unavailable, editing and local saving continue, but the
  application does not report successful validation or successful validated
  export.
- The API response's schema and validator versions appear in the export report.

### Export with reporting

Export first loads the catalog, objects, references, and links in a consistent
read-only transaction and builds indexed in-memory maps. It then:

1. Walks from `catalog.rootObjectId`.
2. Copies each object's own scalar properties.
3. Traverses references in property and ordinal order.
4. Detects missing objects, invalid scope, cycles, and excessive depth.
5. Assembles nested DCAT-US 3.0 JSON.
6. Sends the assembled catalog to the validator API.
7. Produces structured errors and warnings with object/property paths.

A successful export downloads `data.json` and a report. An unsuccessful export
does not label the catalog valid; the user can download the error report and may
download an explicitly labeled invalid file for diagnosis. Blob downloads are
created locally and require no server.

### Accessibility and performance gates

- USWDS is the visual and interaction baseline.
- Automated axe checks block regressions, supplemented by manual keyboard and
  screen-reader testing. Automated tests alone do not establish conformance.
- Tree rendering is virtualized or lazy where measurements require it.
- A responsiveness check ingests, edits, persists, reloads, validates, and exports
  representative catalogs through at least 3,000 datasets. The results establish
  and document the alpha's supported size and action-latency budgets. Failure at
  3,000 datasets sets a smaller disclosed phase 1 limit; it does not reverse this
  architecture decision. Accessibility remains required at the supported limit.

### Phase 2 seam

Phase 2 adds an API-backed repository or synchronization layer behind the same
domain and repository boundaries. Client-generated IDs and graph semantics remain
stable. The server treats every browser graph as untrusted, independently
authenticates and authorizes the user, validates integrity and metadata, applies
optimistic concurrency, and records audit history. Phase 1 does not implement a
sync queue, CRDT, server protocol, or authentication in anticipation of phase 2.

React ownership of the complete phase 1 application is not a commitment to a
pure client-rendered phase 2 or phase 3. The metadata editor remains React, while
authenticated administration and other non-editor pages may use server rendering
if that better fits the selected backend and accessibility needs. The later-phase
rendering decision is intentionally deferred.

### Positive Consequences

- Phase 1 can be deployed as static assets with no account or metadata database.
- Drafts remain in the user's browser except when explicitly sent for validation.
- Separate object records support targeted edits, reuse lookups, and future
  incremental synchronization.
- The DCAT algorithms are testable without a browser UI or database.

### Negative Consequences

- IndexedDB data is tied to one browser profile and can be lost through site-data
  clearing, private browsing, quota eviction, or device loss. The UI must explain
  this and encourage downloaded backups.
- Browser storage cannot enforce security or relational integrity against its
  user; phase 1 checks are correctness controls only.
- Direct API validation depends on CORS, network availability, request limits,
  and the validator's ability to process large catalogs.
- React, TypeScript, IndexedDB, and their dependency chain add skills and
  supply-chain obligations.

### Compliance Consequences

- **SI-10:** imported files and stored graph records are untrusted; bounded parsing,
  graph integrity checks, and authoritative API validation fail visibly.
- **SI-15 / SC-18:** render metadata as text; do not use unsanitized HTML; enforce
  a restrictive Content Security Policy and pin first-party build assets.
- **SR-3:** commit a lockfile, pin direct dependencies, scan dependencies in CI,
  and review upgrades.
- **CM-2 / CM-3:** pin the schema commit and record application, schema, and
  validator versions in export reports.
- **SA-8 / SA-15:** accessibility, performance, import-boundary, and graph
  integrity tests are release gates.
- Phase 1 has no centralized AU-2/AU-3 audit trail. Local revisions and export
  reports must not be represented as one.

## Blockers before acceptance

1. Verify the validator API contract, CORS policy, request-size limits, structured
   paths, and version reporting from the deployed phase 1 origin.
2. Confirm the team can maintain the React/TypeScript/IndexedDB application or
   identify who will.

## Links

- [ADR 0013](0013-deliver-inventory-in-three-phases.md) - phased delivery
- [ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md) - superseded hybrid proposal
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) - shared object graph
- [ADR 0008](0008-onboard-via-data-json-reimport.md) - DCAT-US 3.0 import behavior and phase 2 onboarding
- [ADR 0010](0010-depend-on-upstream-dcat-us-code.md) - schemas and validator API
- [USWDS](https://designsystem.digital.gov/) and [Section 508](https://www.section508.gov/)
- NIST SP 800-53 Rev 5.2 - SI-10, SI-15, SC-18, CM-2, CM-3, SA-8, SA-15, SR-3
