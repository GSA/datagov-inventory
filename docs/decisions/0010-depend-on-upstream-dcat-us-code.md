---
title: "Validate DCAT-US 3.0 through the Data.gov validator API and consume only the schema definitions from the pinned GSA/dcat-us submodule"
status: "proposed"
date: "2026-09-24"
decision_makers: ["Data.gov engineering team"]
category: "Dependency and Component Boundary"
nist_controls: ["SR-3", "SR-4", "SC-7", "CM-2", "CM-3", "CM-8", "SI-10", "SA-8"]
impact_level: "moderate"
ato_relevance: "yes-boundary"
risk_treatment: "mitigate"
---

# Validate DCAT-US 3.0 through the Data.gov validator API and consume only the schema definitions from the pinned GSA/dcat-us submodule

## Context and Problem Statement

[ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md),
[ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md), and
[ADR 0008](0008-onboard-via-data-json-reimport.md) all depend on DCAT-US 3.0
validation and on legible error reporting. This record first proposed importing that
code from the `_external/dcat-us` git submodule behind an adapter module. That has been
replaced.

Data.gov is building a **public DCAT-US 3.0 validator API**: JSON Schema validation
plus **warnings**, the semantic checks that pure schema validation cannot express.
The platform already has the pieces in separate places (the public validator at
`harvest.data.gov/validate/`, and the harvester's own error humanizer and
`dcat_warnings.py`), and error reporting alone exists in four copies. The API is
the consolidation.

Inventory still needs one thing from `GSA/dcat-us` directly: the **3.0 schema
definitions**, to build editor forms with the right help and description text.

### `GSA/dcat-us` is inside the boundary

`GSA/dcat-us` is **not a third-party or upstream dependency**. The Data.gov team
and GSA own and maintain it, under the same access, review, and change controls as
the rest of the Data.gov platform. It is therefore a **first-party, in-boundary
component**, and Inventory consumes it the way it consumes its own source, not the
way it consumes an external supplier's package. Earlier drafts of this record
treated it as external code, and that framing is withdrawn. The rest of this
record follows from that definition:

- Supply-chain concerns about *who wrote* the code (SR-3, SR-4) do not apply to
  `GSA/dcat-us` itself. They still apply to any third-party packages it depends on,
  which Inventory does not install because it executes none of its code.
- The submodule is pinned for **reproducibility and version agreement with the
  validator API**, not because the source is untrusted.
- The decision below to validate through the API does not rest on trust. It rests on
  the engineering reasons in the decision drivers.

### Decided requirements

Answered by the product owner, 2026-10-05:

- **Validation is the Data.gov validator API.** Inventory does not run its own
  validator and does not execute any `GSA/dcat-us` code: no validation script, no
  error summarizer, and no conversion or transform scripts.
- **From `GSA/dcat-us`, Inventory takes the schema definitions only**, to generate
  forms and their help text.
- **Warnings are surfaced alongside errors.**
- **The API is Data.gov's own.** The team owns it and accepts the risk of it being
  down. It sits in the same network as Inventory, has no storage or access to
  anything else, and does not store requests or responses. Sending a catalog to it is
  no different in exposure from the catalog moving between browser and server.

## Decision Drivers

- **One shared validator and message format** across Inventory, the harvester, and
  the public validator, so agency publishers see the same result everywhere. This
  avoids Inventory becoming a fifth copy of the error reporter.
- **Executing the submodule's code is an engineering problem, not a trust problem.**
  `GSA/dcat-us` is in-boundary and first-party, so provenance is not the concern. The
  submodule is unpackaged (`package-mode = false`, no tags), script-shaped, and
  declares a Python floor (3.13) above v2's (3.12). Calling an API removes all of that.
- **Warnings, not only errors.** The harvester's semantic warnings have no
  Inventory equivalent, and the API carries them.
- **A single owner for validation fixes.** A bug is fixed once, in the API.
- **Schema definitions are inert data.** Reading them is the lowest-risk way to
  generate forms and keep field descriptions sourced from the schema.

## Considered Options

1. **Call the Data.gov validator API; take only schema definitions from the
   submodule.**
2. **Import the pinned submodule's validator and error summarizer behind one adapter
   module** (this record's previous choice). Rejected: an awkward coupling (the
   summarizer lives in the conversion CLI), import-time statements that run
   regardless, an unreconciled Python floor, manual scanning of submodule
   dependencies, and no warnings.
3. **Vendor or fork the validation code into this repository.** Rejected: it is the
   mechanism that produced the drift in v1 and the harvester.
4. **Write Inventory's own validation.** Rejected for the same reason, and because it
   would duplicate the API.

## Decision Outcome

Chosen option: **Option 1.** Inventory sends DCAT-US 3.0 content to the validator API
and shows the result; it owns no validation logic.

### What Inventory requires of the API

The API is not built yet, and Data.gov builds it, so these are requirements for it
that Inventory's validation features depend on:

- **Validate a whole catalog and a fragment of one class.** Import flags each object
  ([ADR 0008](0008-onboard-via-data-json-reimport.md)), and the editor validates one
  object at a time ([ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md)). A
  3,000-dataset catalog may be tens of MB, so a batch or streaming form is needed.
- **A structured response** that separates **errors** (blocking) from **warnings**
  (informational), each with a path to the offending value and a readable message.
- **Versions in every response:** the validator version and the schema version used.
- **No retention of submitted payloads**, which holds by design: the API has no storage.
- **Rate limits, if any, that fit Inventory's single egress address**, since all of
  Inventory's calls come through the cloud.gov egress proxy.
- **A written contract** (an OpenAPI document) that Inventory's tests and client are
  built against.

### Behavior in Inventory

- **Errors block, warnings do not.** An object with errors is `invalid` and cannot be
  set `live` (ADR 0008). Warnings are shown to the author and never gate publishing.
- **When the API is unavailable, publishing fails closed.** The team accepts the
  availability risk, so this is the behavior, not a mitigation to build around. Editing continues, the
  affected objects stay unvalidated, and an object cannot go `live` and a catalog cannot
  be exported until validation succeeds. A validation control that fails open is worse
  than one that fails closed.
- **The validator and schema versions are recorded** on each import and each
  `export_run`, so a result is reproducible against the version that produced it.
- **The API is a fourth egress destination**, added to the egress allowlist
  ([ADR 0009](0009-terraform-cloudgov-for-infrastructure.md)).
- **CI does not call the live API.** Tests validate fixtures directly against the
  schema definitions in the submodule, with `jsonschema` as a **test-only**
  dependency, pinned explicitly to Draft 2020-12. That covers schema errors but not
  warnings or the API's message format, so a periodic contract test against the real
  service covers the difference.

### The schema definitions

- `_external/dcat-us` stays as a git submodule **pinned to a commit the team has
  verified against the API's schema version**, not `branch = main`, and Inventory reads
  only the 3.0 schema definitions from it. It executes none of its code, so there is no
  adapter module, `sys.path` shim, or mirrored dependency list. The pin exists for
  reproducibility and version agreement, since the repository itself is first-party
  and in-boundary.
- **The pinned schema must match the schema the API validates against**, or a form could
  offer fields the API rejects. The API reports its schema version, a contract test
  compares it with the pin, and the two are bumped together.

### Positive Consequences

- One validator and message format across the platform, and Inventory inherits fixes and
  new warnings without a code change.
- The code dependency on the submodule, its packaging problem, the 3.13 versus 3.12 floor, the
  import-time side effects, and the dependency-scanning gap all disappear.
- Warnings come for free.
- Anonymous editing in 2.1 can validate by calling the same API, without running Python
  in the browser ([ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md)).

### Negative Consequences

- **A runtime dependency on a service that does not exist yet.** Inventory's validation
  features wait on its contract and availability.
- **A new outbound data flow** carrying not-yet-public metadata to a Data.gov-owned
  service. It stores nothing, so the exposure is no greater than the catalog crossing
  between browser and server, but the SSP data-flow diagram needs the new flow.
- **Version skew risk** between the pinned schema used for forms and the API's schema.
- **Latency and size.** Validation is a network call, and a large catalog needs a batch
  form.
- **Fail-closed publishing** means an API outage blocks going live and exporting until
  it recovers.

### Compliance Consequences

- **SI-10 (Input Validation)** — validation is one shared service. The version of the
  validator and schema is recorded per import and export.
- **SC-7 (Boundary Protection)** — this adds an outbound flow of draft metadata to a
  Data.gov-owned, storage-free service. TLS is required, and the egress allowlist
  change is a managed boundary control (ADR 0009). The SSP data-flow diagram and
  component inventory need updating, and the ISSO should review.
- **SR-3, SR-4 (Supply Chain, Provenance)** — *scope narrowed.* `GSA/dcat-us` is a
  first-party, in-boundary component owned by the Data.gov and GSA team, so it is
  not treated as an external supplier. The pinned submodule commit still identifies
  the schema definitions for provenance, and the API's reported versions identify the
  validator. Third-party packages that `GSA/dcat-us` depends on are not installed or
  executed by Inventory.
- **CM-2, CM-3, CM-8** — `GSA/dcat-us` is listed in the component inventory as an
  **in-boundary, first-party component** with the Data.gov team as owner. The pin and
  the API contract version are part of the configuration baseline, and the API is a
  component in the inventory. Changes to the schema definitions are governed by that
  repository's own change controls, and Inventory adopts them by bumping the pin.
- **ATO.** `yes-boundary`, because of the new data flow to the validator API and
  because the SSP component inventory gains `GSA/dcat-us` as an in-boundary component.

## Blockers before acceptance

None.

## Requirements for completion

Work that must finish before validation features ship, not before acceptance.

- **Write the API contract** against the requirements above. Until the API exists,
  tests validate against the schema definitions directly.
- **Update the SSP** data-flow diagram and component inventory for the new flow, and
  record `GSA/dcat-us` as an in-boundary, first-party component. The in-boundary
  claim rests on the repository's access and change controls (restricted write access
  and required review), so cite them in the SSP rather than assert ownership alone.
- **Choose the initial submodule pin** matching the API's schema version.

## Links

- [`GSA/dcat-us`](https://github.com/GSA/dcat-us/tree/main/jsonschema) — the in-boundary, Data.gov/GSA-owned source of the 3.0 schema definitions Inventory reads
- [ADR 0001](0001-repository-topology-for-inventory-v2.md) — deferred this question
- [ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md) — where validation is called from
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the graph layer Inventory owns
- [ADR 0008](0008-onboard-via-data-json-reimport.md) — import flags invalid objects using this validation
- [ADR 0009](0009-terraform-cloudgov-for-infrastructure.md) — the egress allowlist
- [GSA/datagov-harvester](https://github.com/GSA/datagov-harvester) — the other consumer, with its own humanizer and `dcat_warnings.py` today
- NIST SP 800-53 Rev 5.2 — SR-3, SR-4, SC-7, CM-2, CM-3, CM-8, SI-10, SA-8
- **v1 code citations** in earlier versions of this record referred to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time.
