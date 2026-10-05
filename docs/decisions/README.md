# Architecture Decision Records

Decision records for the inventory.data.gov v2 re-design, using
[MADR](https://adr.github.io/madr/) format with federal compliance frontmatter
extensions (`nist_controls`, `impact_level`, `ato_relevance`, `risk_treatment`).

ADR numbers are sequential and are never reused, including for superseded
records, to preserve the audit trail.

## Records

| # | Title | Status   | Date       | ATO | NIST controls |
|---|-------|----------|------------|-----|---------------|
| [0001](0001-repository-topology-for-inventory-v2.md) | Build Inventory v2 in a new GSA/datagov-inventory repository | accepted | 2026-09-29 | yes-internal | CM-2, CM-3, CM-9, AC-3, SA-5, SA-8, SR-3, RA-5 |
| [0002](0002-ui-rendering-architecture-for-inventory-v2.md) | Use server-rendered Flask pages with a local-first React editor for Inventory v2 | proposed | 2026-09-21 | yes-internal | SI-10, SI-15, SC-18, AU-2, AU-3, AC-12, SA-8, SA-15, SR-3 |
| [0004](0004-jit-user-provisioning-and-catalog-rbac.md) | Provision user accounts just-in-time on first Login.gov authentication, with authorization held in per-catalog permissions | proposed | 2026-09-21 | yes-internal | AC-2, AC-2(3), AC-3, AC-6, AC-5, AU-2, AU-3, AU-10, IA-8, PS-4 |
| [0005](0005-object-graph-data-model-for-dcat-us-3.md) | Store DCAT-US 3.0 metadata as a versioned object graph in Postgres | proposed | 2026-09-21 | yes-internal | AU-2, AU-3, AU-10, AC-3, SI-10, SI-12, CM-3, SC-28 |
| [0006](0006-quarantine-then-scan-antivirus.md) | Scan uploaded data files with a quarantine-then-scan antivirus service and cap hosted files at 500 MB | proposed | 2026-09-21 | **yes-boundary** | SI-3, SI-3(1), SI-3(2), SI-7, SI-10, SC-7, AC-3, AU-2, AU-3, IR-4, IR-6 |
| [0007](0007-retire-tabular-datastore-api.md) | Retire the tabular DataStore API in Inventory v2 | proposed | 2026-09-21 | **yes-boundary** | CM-7, SA-8, AC-3, SI-10, CM-4 |
| [0008](0008-onboard-via-data-json-reimport.md) | Onboard agencies by re-importing published data.json rather than migrating from CKAN | proposed | 2026-09-21 | yes-internal | CM-3, SI-10, SI-12, CP-9, CM-4, CM-7, SA-8 |
| [0009](0009-terraform-cloudgov-for-infrastructure.md) | Provision cloud.gov infrastructure with GSA-TTS/terraform-cloudgov modules | proposed | 2026-09-21 | **yes-boundary** | CM-2, CM-3, CM-6, CM-8, CM-9, SC-7, SC-12, SC-28, AC-3, AC-5, SA-8, SR-3 |
| [0010](0010-depend-on-upstream-dcat-us-code.md) | Consume DCAT-US validation and error-reporting code from the pinned GSA/dcat-us submodule rather than forking it | proposed | 2026-09-24 | yes-internal | SR-3, SR-4, SR-11, RA-5, CM-2, CM-3, CM-8, SI-10, SA-8 |
| [0011](0011-audit-trail-mechanism.md) | Record the audit trail with PostgreSQL-Audit rather than hand-written audit tables | proposed | 2026-09-28 | yes-internal | AU-2, AU-3, AU-9, AU-10, AU-12, SI-12, SR-3, RA-5, CM-3, SA-8, SA-15 |
| [0012](0012-catalog-scoped-hosted-files.md) | Host data files as catalog-scoped resources with a lifecycle independent of Distribution metadata | proposed | 2026-10-01 | **yes-boundary** | AC-3, AU-2, AU-3, SI-3, SI-3(2), SI-7, SI-10, SI-12, SC-7, CM-3, CM-7, SA-8 |

**By status:** 10 proposed, 1 accepted, 0 deprecated, 0 superseded.

**Boundary-affecting:** ADR 0006 (new in-boundary scanner component and outbound
signature-update flow), ADR 0007 (a brokered data store and a public API endpoint
leave the boundary), ADR 0009 (egress allowlist and container-network policies
become managed boundary controls), and ADR 0012 (an unauthenticated public data
flow serving file content, plus a second S3 service
instance). All four require SSP component-inventory and data-flow diagram updates
and should be reviewed by the ISSO.

## Reading order

For a reviewer coming to this cold, [`docs/architecture.md`](../architecture.md)
first, then the records in numeric order. 0001 is deliberately first because it
determines where every other decision is recorded and built. 0005 is the
technical core — the CKAN data-model mismatch is the reason v2 exists at all.
Read [0011](0011-audit-trail-mechanism.md) directly after 0005: it assumes 0005's
data model and supersedes 0005's hand-written audit tables.
[0012](0012-catalog-scoped-hosted-files.md) is best read after 0006 and 0008: it
decides what a hosted file is, and deliberately decouples it from the metadata
those records describe.

## Controls referenced across all records

`AC-2`, `AC-2(3)`, `AC-3`, `AC-5`, `AC-6`, `AC-12`, `AU-2`, `AU-3`, `AU-9`,
`AU-10`, `AU-12`, `CM-2`, `CM-3`, `CM-4`, `CM-6`, `CM-7`, `CM-8`, `CM-9`, `CP-9`,
`IA-2`, `IA-2(1)`, `IA-2(12)`, `IA-5`, `IA-8`, `IR-4`, `IR-6`, `PS-4`, `RA-5`,
`SA-5`, `SA-8`, `SA-15`, `SC-7`, `SC-8`, `SC-12`, `SC-13`, `SC-17`, `SC-18`,
`SC-28`, `SI-3`, `SI-3(1)`, `SI-3(2)`, `SI-7`, `SI-10`, `SI-12`, `SI-15`, `SR-3`,
`SR-4`, `SR-11`

## Blockers before any record is accepted

Every record mentioned in the following table is `proposed`. These are verification tasks that gate acceptance,
not follow-ups. Each should be a tracked issue (AGENTS.md §15.5).

| ADR | Blocker                                                                                                                                                                                                                                                                                                                                                                  | Type |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------|
| 0002 | Run a time-boxed editor spike: load and edit a 3,000+ dataset catalog in the browser, prototype local storage plus sync and choose the local data format, and prove a USWDS React tree with single-level dialogs meets WCAG 2.1 AA. Recorded outcome gates acceptance. | Design |
| 0002 | Confirm the team can build and maintain a React/TypeScript editor, or name who will. | Organizational |
| 0005 | Decide what `inventory_publishers.csv` becomes now that there is no tenant entity — seed data for reusable DCAT `Organization` objects, whether the department→bureau hierarchy is represented, and global vs. per-catalog seeding. Decide before building the publisher picker.                                                                                         | Design |
| 0006 | Query existing S3 objects for actual file-size distribution to confirm 500 MB is the right cap rather than inheriting ClamAV's defaults.                                                                                                                                                                                                                                 | Data |
| 0007 | Query production access logs and New Relic for `datastore_search`, `datastore_search_sql`, and `/datastore/*` consumers before announcing removal. Required CM-4 impact analysis.                                                                                                                                                                                        | Data |
| 0008 | Records officer determination on whether v1 edit history requires NARA retention; if so, archive the v1 database before decommissioning.                                                                                                                                                                                                                                 | Compliance |
| 0008 | Confirm that import is onboarding-shaped (once per agency plus retries) and that Inventory is never a publishing conduit for metadata authored elsewhere. If it is, destroy-and-rebuild re-import is wrong semantics and merge returns as a requirement.                                                                                                                 | Product |
| 0008 | **Assign an owner for producing each agency's DCAT-US 3.0 file.** v2 imports 3.0 only and every published `data.json` is 1.1, so onboarding has a prerequisite outside Inventory. Decide whether agencies convert themselves or Data.gov staff do it on their behalf, and confirm v1's `dcat-v3.json` output is acceptable given it runs the stale fork behind a degraded validator — or require upstream's converter instead. | Product + organizational |
| 0008 | **Track v1 decommissioning against two gates, not one.** v1 must stay up until every agency has re-imported **and** until no agency still needs its `dcat-v3.json` endpoint for conversion. The per-organization checklist must record both (CP-9).                                                                                                              | Compliance |
| 0008 | Specify how import converges repeated objects onto shared ones — which DCAT classes are eligible for convergence, what equality means for each, and where in the import run the comparison happens. "Import produces reuse automatically" is a stated decision driver, but no record now says how. Decide before building the import path.                               | Design |
| 0010 | Confirm with the `GSA/dcat-us` maintainers and the harvester team that upstream packaging (`package-mode = true`, tags, a relaxed `requires-python`) is an acceptable target, and choose the initial pinned submodule commit. Raise two further items in the same conversation: ask upstream to **extract the error reporter out of `convert_dcat_1_1_to_3_0.py`** (v2 imports it but never converts), and confirm whether upstream regards its converter as a **maintained user-facing tool**, since ADR 0008 now has agencies running it out-of-band. Neither answer blocks starting on the chosen option.                                                                                       | External + design |
| 0011 | Time-boxed spike to execute the behavioural claims this record reads from source: null `transaction_id` on session-bypassing writes, `old_data`/`changed_data` shape for a `properties JSONB` edit, write cost on a 2,000-object import, `GRANT INSERT, SELECT`-only viability, and absence of `SECURITY DEFINER`.                                                       | Design |
| 0011 | Decide whether non-row security events (failed authentication, session establishment and idle termination, authorization denials) need a durable table, or whether structured logs with a defined retention satisfy AU-2 for them.                                                                                                                                       | Compliance |
| 0011 | Decide retention for `activity`. It is append-only and grows without bound.                                                                                                                                                                                                                                                                                              | Compliance |
| 0011 | Confirm the cloud.gov brokered RDS application role may create triggers and functions in the application schema. No `CREATE EXTENSION` is required, which is the usual obstacle.                                                                                                                                                    | Organizational |

## Status lifecycle

```
proposed → accepted → deprecated
                    → superseded (by a newer ADR, which must be named in superseded_by)
```

**Merging these records does not accept them.** Standard MADR practice is to
merge while `proposed`, then flip `status` to `accepted` in a separate follow-up
pull request per record once its blockers clear and its decision makers have
signed off.

`decision_makers` is recorded as the **Data.gov engineering team** on every
record. When a record is accepted, narrowing that to the named individuals who
signed off makes the audit trail more useful — team membership changes over time,
and an assessor reading this in 2028 will want to know who actually decided.

## Provenance

These records and [`../architecture.md`](../architecture.md) were **drafted by an
AI coding agent** (opencode) from the
[Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design)
feature list, the Data.gov wiki, and a read of the v1 codebase at
[`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c).
Factual claims — file paths, line numbers, line counts, configuration values, and
dependency versions — were verified against that commit. The reasoning,
recommendations, and rejected alternatives were **not** verified by anyone and
require human review.

Read them accordingly. Three cautions in particular:

- Several records make recommendations on **product questions** (the editing
  model in ADR 0002, the domain allowlist in ADR 0004, the file-size cap in
  ADR 0006) where an agent has no standing to judge. Those are flagged as
  blockers, not settled.
- The **sizing figures** in `architecture.md` §6 (Postgres plans, scanner memory)
  are proposals, not measurements.

No AI agent is listed in `decision_makers`; accountability for these decisions
rests with the humans who accept them.

## Conventions

- Filename: `NNNN-slugified-title.md`, zero-padded to four digits.
- Required frontmatter: `title`, `status`, `date`, `decision_makers`,
  `category`, `nist_controls`, `impact_level`, `ato_relevance`.
- NIST control IDs use the `XX-N` or `XX-N(N)` form.
- v1 code citations are pinned to a commit, not a branch.
- Update this index when adding a record.
