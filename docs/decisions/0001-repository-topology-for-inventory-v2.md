---
title: "Build Inventory v2 in a new GSA/datagov-inventory repository"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Deployment and Infrastructure"
nist_controls: ["CM-2", "CM-3", "CM-9", "AC-3", "SA-5", "SA-8", "SR-3", "RA-5"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "mitigate"
---

# Build Inventory v2 in a new GSA/datagov-inventory repository

## Context and Problem Statement

Inventory v2 removes CKAN entirely (see ADRs 0002–0008). We must decide whether
v2 is developed in the existing [`GSA/inventory-app`](https://github.com/GSA/inventory-app)
repository or in a new one, because that choice determines where the v2
architecture documentation and decision records live — and therefore where the
team reviews them.

`GSA/inventory-app` is structurally a **CKAN extension repository**: a
`ckanext/` package layout, a `setup.py` declaring a CKAN plugin entry point
(`datagov_inventory=ckanext.datagov_inventory.plugin:Datagov_IauthfunctionsPlugin`),
`config/ckan.ini`, and a `.profile` that bootstraps CKAN. None of that structure
survives in v2.

This record is numbered 0001 because it is logically prior to every other v2
decision: it determines where those decisions are recorded and reviewed.

## Decision Drivers

- **v1 and v2 must run concurrently.** [ADR 0008](0008-onboard-via-data-json-reimport.md)
  establishes that there is no migration path — agencies re-import their
  published `data.json` — so v1 stays in production until every agency has
  completed and verified re-import. Both codebases must be independently
  deployable and independently patchable for months.
- **Platform precedent is unambiguous.** `catalog.data.gov` and
  `harvest.data.gov` each left CKAN in 2025 into *new* repositories
  ([`GSA/datagov-catalog`](https://github.com/GSA/datagov-catalog),
  [`GSA/datagov-harvester`](https://github.com/GSA/datagov-harvester)), and the
  legacy CKAN catalog still runs separately as `catalog-old.data.gov` through
  fall 2026. This is the third instance of a pattern the team has executed twice.
- **Documentation must not mislead (SA-5).** An architecture document describing
  a Flask application, sitting in a repository whose every structural signal says
  CKAN, actively misinforms anyone who opens `GSA/inventory-app`.
- **Tooling conflicts are real, not cosmetic.** v1 is Python 3.10 with a
  `requirements.in.txt` → `pip freeze` cycle, flake8, and Cypress. v2 is
  Python 3.12 with Poetry, ruff/black/isort, and Playwright. Co-hosting means two
  dependency managers, two lint configurations, and two test runners in one CI
  pipeline, with Snyk and Dependabot scanning both (SR-3, RA-5).
- **Git history should be legible.** A repository whose history shows a Flask app
  grown inside a CKAN extension, followed by mass deletion of the extension, is
  harder to audit than two repositories with coherent histories (CM-3).

## Considered Options

1. **New repository `GSA/datagov-inventory`.** v2 developed there; v1 remains in
   `GSA/inventory-app` in maintenance until decommissioned.
2. **In-place rewrite in `GSA/inventory-app`.** Add the Flask application
   alongside the CKAN extension; delete CKAN when v2 reaches parity.
3. **New repository with v1 history preserved**, e.g. a fork or a
   history-preserving copy, so v2 begins with v1's commit history.
4. **Monorepo** containing v1, v2, and the shared DCAT-US library.

## Decision Outcome

Chosen option: **Option 1 — a new repository, `GSA/datagov-inventory`**, because
v1 and v2 must run and be patched concurrently for months, v2 shares no
structural code with v1, and this repeats a pattern the team has already executed
successfully twice on this platform.

The name follows the `datagov-` convention noted in the new-repository checklist
and used by the two sibling applications. `inventory-app-v2` is rejected — the
"v2" would be wrong within a year.

Option 3 is rejected because v1's history documents a CKAN extension; carrying it
into v2 makes `git log` and `git blame` misleading rather than useful. v1's
history remains fully available in `GSA/inventory-app`, which is not going away.
Option 4 is rejected as a larger change to team workflow than this decision
should carry, and it contradicts the established per-application repository
pattern.

### Positive Consequences

- v1 and v2 are independently deployable, patchable, and scannable. A v1 security
  patch cannot be blocked by v2's CI, and vice versa.
- Each repository has one dependency manager, one lint configuration, one test
  runner, and one Python version.
- v2's history starts clean; `git log` and `git blame` are meaningful from the
  first commit.
- v1's decommissioning becomes archiving a repository rather than a large
  deletion commit in a live one.
- v2 can adopt the new-repository checklist controls from day one — protected
  `main`, required reviews, dismiss-stale-approvals, required status checks,
  team-based permissions (CM-9, CM-3, AC-3) — rather than inheriting v1's
  configuration.
- Documentation and decision records sit with the code they describe (SA-5).

### Negative Consequences

- **Repository provisioning is organizational work on the critical path for
  code**. Requires GSA org placement, protected `main`, four team permission grants,
  `LICENSE`/`CONTRIBUTING`/`README`, CI/CD, and Snyk.
- Two repositories to configure, monitor, and keep in dependency-scanning scope
  during the transition.

### Compliance Consequences

- **CM-2 (Baseline Configuration)** — v2 establishes its own baseline rather than
  inheriting v1's CKAN-era configuration.
- **CM-3 (Configuration Change Control)** — separate change control per
  application; team-based permissions per the checklist.
- **CM-9 (Configuration Management Plan)** — the new repository must satisfy the
  full new-repository checklist (protected `main`, required reviews, dismiss
  stale approvals, required status checks, include administrators) **before it is
  used for production code**. Documentation may land earlier.
- **AC-3 (Access Enforcement)** — repository permissions granted to teams
  (`@tts-admins`, `@data-gov-admin`, `@data-gov-support`, `@data-gov-team`), not
  individuals, per the checklist.
- **SA-5 (System Documentation)** — v2 documentation lives with v2 code. The
  interim placement in `GSA/inventory-app` is a documented, tracked exception.
- **SR-3 (Supply Chain Controls), RA-5 (Vulnerability Monitoring)** — Snyk and
  Dependabot must cover the new repository from creation. Two repositories in
  scope during the transition; v1 remains in scope until decommissioned.
- **ATO implications** — v2 is a new system component requiring its own entry in
  the system inventory. v1 and v2 will both be in the boundary during the
  transition, and v1's removal from the boundary is gated on completion of agency
  re-import ([ADR 0008](0008-onboard-via-data-json-reimport.md)).

## Links

- [Checklist for new repositories](https://github.com/GSA/data.gov/wiki/Checklist-for-new-repositories) — provisioning requirements this decision invokes
- [GSA/datagov-catalog](https://github.com/GSA/datagov-catalog) and [GSA/datagov-harvester](https://github.com/GSA/datagov-harvester) — the precedent being followed
- [catalog.data.gov wiki](https://github.com/GSA/data.gov/wiki/catalog.data.gov) — documents `catalog-old.data.gov` running concurrently through fall 2026
- [GSA/dcat-us](https://github.com/GSA/dcat-us) — schema home **and** the home of `transforms.py` and `convert_dcat_1_1_to_3_0.py`; the dependency, not a candidate destination
- [ADR 0008](0008-onboard-via-data-json-reimport.md) — no migration path, hence concurrent operation
- [ADR 0002](0002-ui-rendering-architecture-for-inventory-v2.md), [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — consumers of the upstream DCAT-US code and owners of the Inventory-specific graph layer
- [`docs/architecture.md`](../architecture.md) §8 — code organization
- NIST SP 800-53 Rev 5.2 — CM-2, CM-3, CM-9, AC-3, SA-5, SA-8, SR-3, RA-5
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
