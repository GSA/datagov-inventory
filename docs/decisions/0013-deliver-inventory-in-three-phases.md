---
title: "Deliver Inventory as a browser editor, collaborative service, then dataset host"
status: "proposed"
date: "2026-10-30"
decision_makers: ["Data.gov engineering team"]
category: "Deployment and Infrastructure"
nist_controls: ["CM-2", "CM-3", "CM-4", "CM-7", "SA-5", "SA-8", "SA-15"]
impact_level: "moderate"
ato_relevance: "yes-boundary"
risk_treatment: "mitigate"
---

# Deliver Inventory as a browser editor, collaborative service, then dataset host

## Context and Problem Statement

The original target architecture combined metadata editing, authenticated
collaboration, and dataset-file hosting in one release. The metadata editor can
deliver value without either backend capability, while collaboration and file
hosting introduce distinct data, security, and operational boundaries. We need
an explicit sequence that allows each capability to be designed and verified
without making later phases a rewrite.

## Decision Drivers

- Agencies need a DCAT-US 3.0 creation and repair tool before Inventory needs to
  become their system of record.
- Anonymous browser-only editing avoids collecting accounts or unpublished
  metadata in the first phase.
- Shared editing requires identity, authorization, authoritative persistence,
  concurrency handling, and auditability as one coherent increment.
- Dataset hosting adds a separate public data flow, object storage, malware
  scanning, incident response, and retention concerns.
- The metadata representation must remain stable across all three phases.
- Each phase must be useful by itself and must not claim controls supplied only
  by a later phase.

## Considered Options

1. **Three phases:** browser-only metadata editor; authenticated collaborative
   service; dataset hosting.
2. **One complete release:** retain the original Flask, Postgres, authentication,
   scanning, and hosting launch scope.
3. **Two phases:** browser editor followed by a backend that adds collaboration
   and dataset hosting together.

## Decision Outcome

Chosen option: **Option 1**, with these capability boundaries:

| Phase | Capabilities | Explicitly not included |
|---|---|---|
| **1: browser metadata editor** | Anonymous DCAT-US 3.0 creation, ingestion, editing, IndexedDB persistence, validation through the Data.gov validator API, and export with success/error reporting | Application backend, accounts, shared editing, authoritative server storage, audit trail, and dataset hosting |
| **2: collaborative metadata service** | Login.gov authentication, authoritative Postgres persistence, catalog permissions, optimistic concurrency, joint editing, agency onboarding, and centralized audit history | Inventory-hosted dataset files |
| **3: dataset hosting** | File upload, quarantine, malware scanning, immutable versions, stable public download URLs, withdrawal, and download auditing | Tabular DataStore query functionality |

Phase 2 "joint editing" means that multiple authorized users can work on the
same server catalog. The initial concurrency model remains optimistic concurrency
with stale-write rejection; this decision does not introduce real-time presence,
operational transformation, or CRDTs.

The logical metadata object graph from ADR 0005 spans all phases. Phase 1 stores
it in separate IndexedDB records. Phase 2 stores the authoritative graph in
Postgres and treats the browser copy as local working state. Phase 3 adds hosted
files outside that graph, as ADR 0012 already requires.

### Phase applicability of existing decisions

| ADR | Applicability |
|---|---|
| 0001 | All phases |
| 0002 | Superseded by ADR 0014 |
| 0004 | Phase 2 onward |
| 0005 | All phases |
| 0006 | Phase 3 |
| 0007 | All phases |
| 0008 | Phase 2 onboarding and migration |
| 0009 | Phase 2 backend infrastructure; phase 3 hosting infrastructure |
| 0010 | All phases |
| 0011 | Phase 2 onward |
| 0012 | Phase 3 |

### Positive Consequences

- The first usable release has no Inventory application database, identity store,
  or uploaded files, and no server-side retention of unpublished metadata. Drafts
  cross the boundary only when users explicitly invoke the validator API.
- Authentication and collaboration can be assessed independently from malware
  scanning and public file delivery.
- Phase 3 cannot delay delivery of metadata authoring and collaboration.
- Stable object identifiers and graph semantics provide a deliberate migration
  path instead of requiring a second editor implementation.

### Negative Consequences

- Some architecture exists as a planned target for longer before it is deployed.
- Phase 1 local data is not centrally backed up, shared, or auditable.
- Phase 2 users must continue to host dataset files elsewhere until phase 3.
- Documentation and tests must state which phase supplies each capability and
  control to avoid overstating the deployed system.

### Compliance Consequences

- **CM-2 / CM-3 / CM-4:** each phase establishes a separately reviewable baseline
  and requires impact analysis before expanding the boundary.
- **CM-7:** phases 1 and 2 do not expose file-hosting or DataStore surfaces before
  those capabilities are required.
- **SA-5:** architecture, runbooks, and the SSP must describe the deployed phase,
  not the final target as though it were already operating.
- **SA-8 / SA-15:** security controls are introduced with the capability they
  protect: authorization and audit in phase 2, scanning and file isolation in
  phase 3.

## Links

- [ADR 0014](0014-browser-only-metadata-editor.md) - phase 1 architecture
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) - shared logical metadata model
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) - phase 2 identity and authorization
- [ADR 0006](0006-quarantine-then-scan-antivirus.md) and [ADR 0012](0012-catalog-scoped-hosted-files.md) - phase 3 dataset hosting
- [`docs/architecture.md`](../architecture.md) - phased system architecture
- NIST SP 800-53 Rev 5.2 - CM-2, CM-3, CM-4, CM-7, SA-5, SA-8, SA-15
