---
title: "Consume DCAT-US conversion and validation code from the pinned GSA/dcat-us submodule rather than forking it"
status: "proposed"
date: "2026-09-24"
decision_makers: ["Data.gov engineering team"]
category: "Dependency and Supply Chain"
nist_controls: ["SR-3", "SR-4", "SR-11", "RA-5", "CM-2", "CM-3", "CM-8", "SI-10", "SA-8"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "mitigate"
---

# Consume DCAT-US conversion and validation code from the pinned GSA/dcat-us submodule rather than forking it

## Context and Problem Statement

ADRs 0002, 0005, and 0008 all depend on DCAT-US 1.1 → 3.0 conversion and
validation code. That code already exists in
[`GSA/dcat-us`](https://github.com/GSA/dcat-us/tree/main/jsonschema) — the same
repository that hosts the DCAT-US schemas, already vendored by v1 and
`datagov-harvester` as the `_external/dcat-us` git submodule. But upstream does
not publish it as a package: `jsonschema/pyproject.toml` declares
`[tool.poetry] package-mode = false`, and the repository has no tags and no
releases. We must decide **how v2 depends on that code**, given that it cannot
currently be installed or version-pinned by any normal Python mechanism.

## Decision Drivers

- **The code is upstream, and v1's copy is a stale fork of it.** Upstream
  `jsonschema/` holds `transforms.py` (499 lines),
  `convert_dcat_1_1_to_3_0.py` (558 lines), `v1.1_definitions/` (5 schema files
  with no other published home), and 719 lines of tests. v1's
  `ckanext/datagov_inventory/dcat/` is a July-2026 fork that has since drifted:
  it is missing `transform_theme`, the bare-string wrap in `transform_language`,
  and all `isPartOf` → `DatasetSeries` promotion (`build_dataset_series`, ~95
  lines, with self-reference and nested-series guards). Its five vendored
  `v1.1_definitions/*.json` files are byte-identical to upstream's, and its error
  summarizer is upstream's, differing only in line wrapping and docstrings.
- **Forking is the failure mode already in evidence, twice.** v1 forked upstream
  and drifted. `datagov-harvester` independently vendors its own copy of the 1.1
  schemas and its own ~250-line error humanizer. A third fork is a predictable
  third drift (SR-3).
- **Executing vendored code is a different risk posture from reading vendored
  data (SR-3, RA-5).** v1's and the harvester's `.gitmodules` both track
  `branch = main`. Reading inert JSON schemas from an unpinned submodule is
  tolerable; *executing* upstream Python from one means every upstream commit is
  an unreviewed code change inside a FISMA-boundary application, invisible to
  Dependabot and Snyk, which scan declared dependencies rather than submodule
  contents.
- **Validation is a compliance control, so its version must be known (SI-10,
  CM-3).** ADR 0008 requires each import to record the schema version that
  validated it. Once the submodule supplies conversion *code* as well as schemas,
  that recorded commit identifies the validator's behaviour too — which is only
  meaningful if the commit is pinned.
- **Upstream is not packaged today, and v2 does not control when it will be.**
  `package-mode = false`, no tags, no releases, and script-shaped modules
  (`import transforms`, `SCRIPT_DIR / "v1.1_definitions"`). v2 cannot wait on an
  upstream packaging change it does not own.
- **Python floor mismatch.** Upstream declares `requires-python = ">=3.13,<4.0"`;
  v2 targets Python 3.12 ([`architecture.md` §3](../architecture.md#3-technology-choices)).
  No 3.13-only syntax is actually used, so this is a declaration to reconcile
  rather than a code barrier — but it must be reconciled before any install-based
  option is viable.
- **Only part of the work is upstream's.** Graph decompose/assemble (ADR 0005),
  schema → form-model generation (ADR 0002), and export-run orchestration are
  Inventory-specific and belong in this repository regardless of how the upstream
  dependency is structured.

## Considered Options

1. **Import from the pinned submodule as-is.** Keep `_external/dcat-us`, pin it
   to a reviewed commit, and import upstream's modules through a thin adapter
   module in `dcat/`.
2. **Make upstream installable, then depend on it normally.** PR `GSA/dcat-us` to
   set `package-mode = true`, add a package directory, relax `requires-python`,
   and cut tags; then declare it as a pinned dependency.
3. **Vendor a copy into `datagov-inventory`.** Copy upstream's modules into this
   repository and maintain them here.
4. **A third shared repository** (e.g. `GSA/datagov-dcat`) extracted from
   upstream and consumed by both Inventory and the harvester.

## Decision Outcome

Chosen option: **Option 1 now, with Option 2 as the declared target**, because
the code is already on disk via the submodule and needs no new infrastructure to
use, while Option 2 requires upstream coordination whose timing v2 does not
control.

Concretely:

- `_external/dcat-us` is **pinned to a specific reviewed commit**, not
  `branch = main`. Advancing the pin is a reviewed pull request like any other
  dependency bump.
- All upstream imports pass through **one adapter module** in `dcat/` — the only
  file that knows upstream's file layout or manipulates `sys.path`. Switching to
  Option 2 is then a change in one file, not a migration.
- v2 **does not copy or patch** upstream modules. A needed fix is a pull request
  to `GSA/dcat-us`. If an upstream fix is blocked and v2 cannot wait, the
  divergence is recorded in the adapter module with a link to the upstream PR,
  never as a silent edit.
- v2 owns only what upstream does not: graph decompose/assemble, schema →
  form-model generation, and export-run orchestration.

Option 3 is rejected outright: it is precisely the mechanism that produced the
drift in v1 and in the harvester, and doing it a third time knowingly would be
worse than the first two, which were at least accidental.

Option 4 is rejected as solving the wrong problem. The code's natural home is the
repository that already hosts the schemas it validates against; a fourth
repository adds a release process and a coordination point without removing
either fork that already exists.

### Positive Consequences

- Inventory and the harvester converge on one implementation instead of adding a
  third, and both benefit from upstream fixes.
- v2 gets capabilities v1's fork lacks on day one — notably `transform_theme` and
  `isPartOf` → `DatasetSeries` promotion, which
  [ADR 0008](0008-onboard-via-data-json-reimport.md)'s import path needs.
- No extraction work sits on v2's critical path. The dependency already exists;
  what remains is a pin and an adapter.
- Bugs found by Inventory are fixed for the harvester and for the public
  validator at `harvest.data.gov/validate/` too, because they are fixed upstream.
- The submodule commit becomes a single, honest version identifier for both
  schema and validator behaviour, satisfying ADR 0008's reproducibility
  requirement.
- Deleting v1's `dcat/v1.1_definitions/` (byte-identical to upstream's) and the
  harvester's third copy becomes an obvious, safe cleanup.

### Negative Consequences

- **v2 couples to upstream's file layout**, which is script-shaped and carries no
  API stability promise. The adapter module confines the blast radius but does not
  eliminate it; an upstream reorganization breaks one file in v2.
- **A `sys.path` shim or equivalent is required** to import modules from a
  non-package directory. This is mildly unidiomatic and needs a comment
  explaining why it exists.
- **Dependency scanners do not see submodule code.** Snyk and Dependabot will not
  flag a CVE in upstream's transitive dependencies as reached through the
  submodule; upstream's own `pyproject.toml` dependencies must be mirrored into
  v2's lock file and reviewed manually (RA-5).
- **Advancing the pin is manual work** with no automated notification that
  upstream has moved. A periodic check is needed, or the pin silently ages.
- **Upstream release cadence is outside v2's control.** If a fix Inventory needs
  stalls upstream, v2 waits or accepts a documented divergence — the very thing
  this decision is designed to avoid.
- **The Python floor stays unreconciled** until Option 2 is pursued. Importing
  from the submodule sidesteps `requires-python`, which means the mismatch
  persists as latent debt rather than being resolved.

### Compliance Consequences

- **SR-3 (Supply Chain Controls)** — pinning the submodule to a reviewed commit
  is the control. This decision makes explicit that `_external/dcat-us` is a
  **code** dependency, not only a data dependency, and must be treated as such in
  change review.
- **SR-4 (Provenance), SR-11 (Component Authenticity)** — provenance is the
  upstream commit SHA recorded by the submodule pin. Every artifact produced by
  conversion or validation is attributable to an exact upstream revision.
- **RA-5 (Vulnerability Monitoring)** — a gap requiring compensation: automated
  scanners do not inspect submodule contents. Upstream's declared dependencies
  (`jsonschema[format]`, `curl-cffi`, `langcodes`, `click`) must appear in v2's
  own lock file so they are scanned, and the pin must be reviewed on a defined
  cadence.
- **CM-2 (Baseline Configuration), CM-8 (Component Inventory)** — the submodule
  commit is part of v2's configuration baseline and the upstream code is a
  component in the inventory, not an invisible implementation detail.
- **CM-3 (Configuration Change Control)** — advancing the pin is a reviewed
  change. This is what distinguishes the chosen option from the `branch = main`
  tracking that v1 and the harvester use today.
- **SI-10 (Input Validation)** — the validator's identity and version are known
  and recorded per import. Relatedly, `jsonschema` must be **pinned explicitly**
  in v2: v1 leaves it unpinned, so `ckanext-datajson`'s `~=2.4.0` constraint wins
  in production and validation silently degrades to Draft 4 — fewer checks, no
  `const`, 26 of 87 format constraints — with no log line saying so. A validation
  control that fails open is worse than one that fails closed.
- **ATO implications** — no change to the authorization boundary: upstream code is
  already vendored and executes inside the existing boundary. The SSP's component
  inventory should name the upstream dependency and its pinned commit.

## Blocker before acceptance

**Confirm the approach with the `GSA/dcat-us` maintainers and the harvester team,
and choose the initial pinned commit.** Specifically: whether upstream will accept
Option 2 (packaging and tagging) as the eventual target, and whether the harvester
team intends to converge on the same mechanism. Neither answer blocks starting on
Option 1, which is why this is not on v2's critical path — but both change the
timeline for Option 2.

## Not in scope: consolidating the error reporters

The platform has **four** error-reporting implementations wrapping one validation
call:

| Where | What |
|---|---|
| `GSA/dcat-us` `convert_dcat_1_1_to_3_0.py:38-190` | `summarize_error`, `find_meaningful_errors`, `extract_schema_name`, `format_path` — the origin |
| `GSA/dcat-us` `test_json_schema.py` | A second copy; upstream marks it `# TODO duplicated code` |
| `GSA/inventory-app` `dcat/validator.py:42-185` | v1's fork of the first |
| `GSA/datagov-harvester` `general_utils.py` | An independent ~250-line humanizer emitting a different message shape, plus `dcat_warnings.py` (701 lines) of semantic warnings with no Inventory equivalent |

The drift that reaches agency publishers is between the harvester's public
validator and Inventory's export report, and it is entirely in error *reporting*
rather than in the validation call. **That consolidation belongs upstream**, where
two of the four copies already live, and it is not Inventory's to own or to
schedule. Consuming upstream per this decision means v2 inherits any later
consolidation without re-work, which is why it does not gate v2.

## Links

- [`GSA/dcat-us` `jsonschema/`](https://github.com/GSA/dcat-us/tree/main/jsonschema) — the dependency: schemas, `transforms.py`, `convert_dcat_1_1_to_3_0.py`, `v1.1_definitions/`
- [`transforms.py`](https://github.com/GSA/dcat-us/blob/main/jsonschema/transforms.py) · [`convert_dcat_1_1_to_3_0.py`](https://github.com/GSA/dcat-us/blob/main/jsonschema/convert_dcat_1_1_to_3_0.py)
- [ADR 0001](0001-repository-topology-for-inventory-v2.md) — deferred this question; its original framing is corrected here
- [ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md) — why the authoritative validator stays Python and is not reimplemented in JavaScript
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the graph layer v2 owns; records the schema version per object
- [ADR 0008](0008-onboard-via-data-json-reimport.md) — the import path that needs upstream's `DatasetSeries` promotion, and the per-import schema-commit record
- [`docs/architecture.md` §1](../architecture.md#the-conversion-code-already-exists--upstream-not-in-v1) and [§8](../architecture.md#8-code-organization) — the same finding in narrative form
- [GSA/datagov-harvester](https://github.com/GSA/datagov-harvester) — the other consumer; vendors its own 1.1 schemas and its own error humanizer
- NIST SP 800-53 Rev 5.2 — SR-3, SR-4, SR-11, RA-5, CM-2, CM-3, CM-8, SI-10, SA-8
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
- **Upstream code citations** refer to `GSA/dcat-us@e966eee8` (2026-09-24), the upstream HEAD at the time of writing.
