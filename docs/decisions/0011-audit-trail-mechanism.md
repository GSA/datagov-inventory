---
title: "Record the audit trail with PostgreSQL-Audit rather than hand-written audit tables"
status: "proposed"
date: "2026-09-28"
decision_makers: ["Data.gov engineering team"]
category: "Security and Compliance"
nist_controls: ["AU-2", "AU-3", "AU-9", "AU-10", "AU-12", "SI-12", "SR-3", "RA-5", "CM-3", "SA-8", "SA-15"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "mitigate"
---

# Record the audit trail with PostgreSQL-Audit rather than hand-written audit tables

## Context and Problem Statement

### What we mean by auditability

The requirement this record answers — *"we will maintain historical object
tracking along with user edit information. All changes will be available for
auditability"* — is read as an **accountability** requirement, and that reading is
a deliberate choice recorded here rather than an omission.

**Chosen: attribution.** For every change, the history answers *who changed what,
and when*. The controls this record claims are the attribution controls — AU-2
and AU-3 (audit events and their content) and AU-10 (non-repudiation) — and
nothing more.

**Not chosen: reconstruction.** The history does **not** promise the ability to
reproduce a past state of a catalog, diff a catalog between two dates, or revert
to an earlier state.

If the records officer or the product owner determines that point-in-time
reconstruction of a catalog *is* required — for a NARA obligation, a dispute over
what was published on a given date, or a user-facing revert feature — then this
scope decision is wrong. That determination is not an engineering judgment and belongs with the
two retention questions already open on this record and on
[ADR 0008](0008-onboard-via-data-json-reimport.md).

### How to implement auditability

[ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) chose the **hybrid
object graph**: a `metadata_object` table carrying `dcat_class`, `state`, and a
`JSONB metadata_properties` of own-scalar properties, with nesting and reuse held as edges in
`object_reference`, embedding in `catalog_link`, and authorization in
`catalog_permission`.

That data model has a direct consequence for auditing. Because `metadata_properties` holds
scalars only and *structure is edges*, per-object properties versioning cannot see
most of what changes:

| Change | Where it lives                         | Visible to properties versioning? |
|---|----------------------------------------|-----------------------------------|
| Edit a title or description | `metadata_object.metadata_properties`  | Yes                               |
| Attach or detach a reusable object; add, remove, or reorder catalog membership | `object_reference` rows                | **No**                            |
| Embed or un-embed a catalog | `catalog_link` rows                    | **No**                            |
| Publish or unpublish (`draft ⇄ live`) | `metadata_object.state` column         | **No**                            |
| Grant, revoke, or change a permission | `catalog_permission` rows              | **No**                            |
| Replace a catalog's object set by re-import | `catalog.root_object_id` + mass delete | **No**                            |

The first of these matters most: *"entry by class and re-use"* makes **attach an
existing object** the characteristic user action of the product. An audit trail
that covers text edits and misses reuse is not an audit trail of this system.

## Decision Drivers

- **Every gap above is a row mutation.** Edges, state, permissions, and
  membership are all `INSERT`/`UPDATE`/`DELETE` on ordinary tables. A mechanism
  that audits *table changes* covers them all mechanically; a mechanism that
  audits *properties objects* covers none of them.
- **Attribution must be unbypassable, and application-layer discipline is not
  (AU-2, AU-12).** The weakest point of the hand-written design is that nothing
  prevents a view from mutating `object_reference` and writing no event. The
  highest-volume writer is import (ADR 0008), which is exactly where someone
  reaches for `bulk_insert_mappings` — silently ending the audit trail with no
  test failure.
- **Audit records must be intelligible after their subject is gone (AU-3).**
  *"I thought this catalog had a dataset named 'Business Survey' — what happened
  to it?"* must be answerable. If a deletion record does not retain the title, it
  is not.
- **An audit trail is a compliance control, so its integrity matters more than
  its elegance (AU-9).** Append-only must be enforced by database grants, not by
  convention.
- **Scope is attribution, not reconstruction.** A mechanism that imposes
  point-in-time reconstruction contradicts a decision already recorded, and
  drags in machinery (validity intervals, `revert()`) that is not wanted.
- **Auditors read verbs, not diffs.** `operation = 'attach_reference'` is legible;
  `verb='insert', table_name='object_reference'` requires an auditor to
  reconstruct intent from a row diff.
- **Federal supply-chain posture (SR-3, RA-5).** Depending on a third-party
  library for an ATO-relevant control is a real consideration — weighed against
  the equally real risk of hand-maintaining audit code that must not have bugs.
- **Scale is modest.** Thousands of datasets per organization, one Postgres
  instance, SQLAlchemy 2.0 + Alembic + psycopg 3
  ([`architecture.md` §3](../architecture.md#3-technology-choices)).

## Considered Options

1. **Hand-written `change_set` + `audit_event` tables**, written by a repository
   layer that refuses to mutate an edge or a state without a change set. 
2. **SQLAlchemy-Continuum** — 1.7.0, 2026-07-03, BSD-3, `SQLAlchemy>=1.4.53,<2.1`,
   644 stars, 43 contributors, 140 open issues. Shadow `*_version` table per
   versioned table plus a `transaction` table; ORM-level capture via the unit of
   work; supports `revert()` and temporal relationship reflection.
3. **SQLAlchemy-History** — 2.1.6, 2026-08-26, Apache-2.0 AND BSD-3,
   `SQLAlchemy>=2`, 51 stars, 47 contributors, 12 open issues. A maintained fork
   of Continuum, created to support SQLAlchemy 2.x and multiple database
   backends, and to be a smaller surface than Continuum's plugin set.
4. **PostgreSQL-Audit** — 0.18.0, 2026-04-15, BSD-2, `SQLAlchemy>=1.4`, 139 stars,
   12 contributors. Same author as Continuum, written as a reaction to it. A
   **single `activity` table** fed by **plpgsql triggers**, plus a `transaction`
   table carrying the actor.
5. **Postgres `pgaudit` extension** — statement-level logging in the database
   engine, outside the application.
6. **Dead options, listed so they are not revisited:** `versionalchemy` (1.0.0,
   2019-10-03, declares Python 2.7 support, no reverting, no relationship
   queries) and `sqlalchemy-audit` (0.1.0, 2016-12-04). Neither is a candidate.

## Decision Outcome

Chosen option: **Option 4 — PostgreSQL-Audit for row capture, with its
`transaction` table extended to carry the product's own operation vocabulary.**
A small hand-written table is retained only for the events that are genuinely not
row mutations.

Three reasons decide it:

1. **Trigger-based capture cannot be bypassed by application code.** The
   `audit_trigger_row` trigger fires `AFTER INSERT OR UPDATE OR DELETE ... FOR
   EACH ROW`, so a Core `update()`, a `bulk_insert_mappings`, or hand-written SQL
   is captured identically to an ORM write. Options 1–3 all capture at the
   application or ORM layer and are silently bypassable. For the import path this
   is the difference between an audit trail and an aspiration.
2. **Its shape already matches what this system needs.** `activity(id,
   schema_name, table_name, relid, issued_at, native_transaction_id, verb,
   old_data JSONB, changed_data JSONB, transaction_id)` plus `transaction(id,
   native_transaction_id, issued_at, client_addr, actor_id)` is — table for table
   — the `audit_event` + `change_set` pair ADR 0005 specified by hand. Arriving
   independently at the same shape is evidence the shape is right and that
   writing it ourselves is redundant.
3. **It is attribution-shaped, matching ADR 0005's declared scope.** One activity
   log with old/changed data per row mutation. No shadow tables, no validity
   intervals, no `revert()`. Options 2 and 3 are temporal-table designs that
   supply reconstruction whether or not it is wanted, which would contradict a
   decision already recorded.

Option 1 is rejected because it is more code for the same shape, with a weaker
guarantee. Options 2 and 3 are rejected for imposing reconstruction and, for
Continuum specifically, for a `SQLAlchemy<2.1` ceiling against a stack on 2.0 —
survivable now, a migration risk later. Option 5 is rejected **as a substitute**
and recommended **as a complement**: `pgaudit` logs statements, not row-level
before/after values tied to an application actor, so it cannot answer "who
changed this dataset" — but it is the right tool for DBA-level access logging and
should be evaluated separately.

### How the product's vocabulary is preserved

The legitimate objection to a generic row log is legibility: an auditor wants
"Jane attached a contact point," not "a row was inserted into `object_reference`."
PostgreSQL-Audit's `transaction` table is extensible, and its Flask integration
provides an `activity_values(**values)` context manager that merges arbitrary
values into the transaction row. The `transaction` table therefore carries:

| Column | Purpose |
|---|---|
| `actor_id` | The acting `user_account`; populated from `flask_login.current_user` |
| `actor_kind` | `user` \| `system` — scheduled `cf run-task` commands and the scanner have no user |
| `operation` | `edit_object`, `attach_reference`, `detach_reference`, `reorder_references`, `publish`, `unpublish`, `grant_permission`, `revoke_permission`, `import`, `reimport_swap`, `create_catalog`, `embed_catalog` |
| `request_id` | Correlates to the structured logs, so a database record and a log line are one story |

Every write path opens an `activity_values(operation=..., request_id=...)` block.
The semantic layer is thus **columns on the library's transaction table**, not a
parallel table of our own — one mechanism, not two.

### What still needs a hand-written table

Most events assumed to be "not row changes" turn out to be row changes under
ADR 0005's model, and are captured automatically:

| Event | Row mutation that captures it |
|---|---|
| Account created (ADR 0004) | `INSERT user_account` |
| Permission granted / revoked / changed (ADR 0004) | `INSERT`/`UPDATE`/`DELETE catalog_permission` |
| Upload accepted, scan result, deletion on detection (ADR 0006) | `INSERT`/`UPDATE resource_file` |
| Export run started and completed | `INSERT`/`UPDATE export_run` |
| Re-import swap (ADR 0008) | `UPDATE catalog.root_object_id`, one transaction |

The genuine residue is events with **no row behind them**: failed authentication
attempts, session establishment and idle termination, and authorization denials
(an AC-3 rejection changes nothing, which is precisely why it must be recorded).
These are few, and they are security events rather than data-change events. They
remain in the structured logs for the MVP; whether they need a durable table is
listed as a blocker below rather than settled here.

### Positive Consequences

- **Every change the data model puts outside `metadata_properties` is covered, mechanically.**
  Versioning `object_reference`, `catalog_link`, `metadata_object`,
  `catalog_permission`, and `catalog` captures all five of the changes marked
  invisible in [the table above](#how-to-implement-auditability) — reuse and
  membership edges, catalog embedding, `state` transitions, permission changes, and
  the re-import swap — without a line of event-writing code.
- **"What happened to 'Business Survey'?" becomes answerable.** The `DELETE`
  branch of the trigger sets `old_data = row_to_json(OLD.*)::jsonb`, retaining
  the full row — including `metadata_properties`, and therefore the title — after the object
  is gone. A bespoke event table would have to be told to capture the title
  deliberately; here it falls out of the mechanism. This is the clearest concrete
  win.
- **Append-only is compatible with grant-level enforcement.** The trigger only
  ever `INSERT`s into `activity`; nothing updates or deletes it. `GRANT INSERT,
  SELECT` on `activity` and `transaction` with no `UPDATE`/`DELETE` is therefore
  sufficient and not in tension with the library (AU-9).
- **No new infrastructure.** plpgsql triggers on the existing Postgres instance.
  No `CREATE EXTENSION`, so no superuser requirement against cloud.gov's brokered
  RDS.
- **Less code we must not get wrong.** An audit trail with a bug is a failed
  control. A maintained library with 12 contributors and a decade of history is a
  better bet than a bespoke repository layer whose correctness rests on review
  discipline.

### Negative Consequences

- **Actor attribution is still ORM-dependent, so the bypass problem is reduced
  rather than eliminated.** This is the most important limitation and it is not
  obvious from the library's documentation. The trigger resolves the transaction
  by `SELECT id FROM transaction WHERE native_transaction_id = pg_current_xact_id()`,
  and that `transaction` row is inserted by a SQLAlchemy `before_flush` listener.
  A write that bypasses the ORM session therefore **still produces an `activity`
  row — but with a null `transaction_id`, and hence no actor.** Triggers make the
  *data change* unbypassable; they do not make *attribution* unbypassable. A bulk
  import written outside the session would be recorded anonymously. Mitigation:
  the import path must open an explicit transaction context, and **a test must
  assert that no `activity` row exists with a null `transaction_id`** — that
  assertion is the real control, and it is cheap.
- **Versioning can be switched off at runtime.** The trigger is guarded by
  `WHEN (get_setting('postgresql_audit.enable_versioning', 'true')::bool)`, and
  the library exposes a `disable()` helper. Useful for migrations; a hole in an
  audit control (AU-9). The setting must be managed in one place, never set in
  request-handling code, and its use must itself be recorded.
- **Triggers are invisible to application developers (CM-3).** They live in the
  database, not the models. The Alembic baseline must create them; a later
  migration that recreates a table can silently drop them. A test that asserts
  every versioned table carries `audit_trigger_row` is required, not optional.
  This is exactly the "trigger magic" ADR 0005 recoiled from; the judgment here
  is that unbypassable capture is worth the opacity for a compliance control.
- **A `metadata_properties` edit stores the whole properties object, not a key-level diff.** The trigger
  computes `changed_data` by JSONB subtraction at the top level, so `metadata_properties` is a
  single key: any change to it records the entire new properties object. *Which field* changed
  inside a properties object must be derived by comparing `old_data` to `changed_data`
  rather than read directly. Acceptable, but it means the UI cannot show a
  field-level diff for free.
- **Smallest maintainer base of the three candidates** — 12 contributors, one
  primary author. If it were abandoned, the recovery path is that the schema is
  simple and the triggers are ~100 lines of plpgsql we could adopt wholesale;
  that is a real but not trivial exit.
- **Postgres-only.** Irrelevant now (one Postgres instance, by decision), and it
  would matter if that ever changed.
- **Two new transitive dependencies**, `SQLAlchemy-Utils` and the library itself,
  both inside the FISMA boundary and subject to scanning (RA-5).

### Compliance Consequences

- **AU-2, AU-3 (Audit Events, Content)** — *addressed.* Every row mutation on a
  versioned table yields an `activity` row with verb, before/after data,
  timestamp, and transaction. `old_data` retains the full prior row, which is
  what makes records intelligible after their subject is deleted. Coverage now
  includes structural change, not only `metadata_properties` change. The scope is **attribution, not
  reconstruction**, which is a recorded choice
  ([What we mean by auditability](#what-we-mean-by-auditability));
  the SSP should state that scope rather than implying point-in-time recovery.
- **AU-9 (Protection of Audit Information)** — `GRANT INSERT, SELECT` only on
  `activity` and `transaction`; no `UPDATE`, no `DELETE` for the application
  role. The `enable_versioning` setting is the residual risk and must be
  controlled centrally.
- **AU-10 (Non-repudiation)** — `transaction.actor_id` binds a change to a
  `user_account` and thence to a Login.gov subject. This requires that
  `user_account` rows are **never hard-deleted**; see
  [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md), which is amended to
  require soft-delete only.
- **AU-12 (Audit Generation)** — generation is at the database, not the
  application, which is the strongest available placement. The caveat is the
  actor-attribution path above.
- **SI-12 (Retention)** — `activity` is append-only and unbounded.
  Retention is **not decided here** and is a blocker.
- **SR-3, RA-5 (Supply Chain, Vulnerability Monitoring)** — a third-party
  dependency now implements an ATO-relevant control. It must be pinned exactly,
  appear in the SBOM, and be named in the SSP as an audit-mechanism component.
- **ATO implications** — no change to the authorization boundary; no new
  component, no new network flow. The SSP's AU family narrative changes from
  "application writes audit records" to "database triggers generate audit
  records, with actor supplied by the application," and the component inventory
  gains the library at a pinned version.

## Blockers before acceptance

1. **A time-boxed spike, because the behavioural claims in this record are read
   from source and not executed.** It must measure: whether a null
   `transaction_id` is in fact what a session-bypassing write produces; what
   `old_data`/`changed_data` actually contain for a `properties JSONB` edit; write
   cost and `activity` row count for a realistic 2,000-object import; that
   `GRANT INSERT, SELECT`-only works end to end; and that the trigger functions
   are not `SECURITY DEFINER` (none was observed, but this was not verified by
   execution).
2. **Decide whether non-row security events need a durable table** — failed
   authentication, session establishment and termination, authorization denials —
   or whether structured logs with a defined retention satisfy AU-2 for them.
   **The "defined retention" half now has a candidate answer:** logs drain to the
   shared Logstack shipper's S3 archive, whose retention v2 inherits
   ([`architecture.md` §6](../architecture.md#logging-uses-shared-infrastructure-this-repository-does-not-own)).
   Two caveats before that closes this blocker — the inherited retention value must
   actually be written down, and a drain is best-effort, so AU-5 detection of drain
   loss is a prerequisite for relying on logs as the AU-2 record of these events.
3. **Decide retention for `activity`**.
4. **Confirm the cloud.gov brokered RDS role may create triggers and functions**
   in the application schema. No `CREATE EXTENSION` is needed, which is the usual
   obstacle, but trigger creation privilege should be confirmed rather than
   assumed.

## Consequences for other records

- **[ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md)** — permission
  events are captured by versioning `catalog_permission`. Its soft-delete-only
  requirement for `user_account` is load-bearing for AU-10 here.
- **[ADR 0006](0006-quarantine-then-scan-antivirus.md)** — scanner events are
  captured by versioning `resource_file`, with `actor_kind = 'system'`.
- **[ADR 0008](0008-onboard-via-data-json-reimport.md)** — its "swap must be a
  single audit event" requirement is met by one `transaction` with
  `operation = 'reimport_swap'`.

## Links

- [PostgreSQL-Audit](https://github.com/kvesteri/postgresql-audit) — chosen; [PyPI](https://pypi.org/project/PostgreSQL-Audit/)
- [`audit_table_row_level.sql`](https://github.com/kvesteri/postgresql-audit/blob/master/postgresql_audit/templates/audit_table_row_level.sql) and [`create_activity_row_level.sql`](https://github.com/kvesteri/postgresql-audit/blob/master/postgresql_audit/templates/create_activity_row_level.sql) — the trigger definitions this record's claims are read from
- [`postgresql_audit/flask.py`](https://github.com/kvesteri/postgresql-audit/blob/master/postgresql_audit/flask.py) — `activity_values` and `actor_id` population
- [SQLAlchemy-Continuum](https://github.com/sqlalchemy-continuum/sqlalchemy-continuum) — rejected; temporal design, `SQLAlchemy<2.1`
- [SQLAlchemy-History](https://github.com/corridor/sqlalchemy-history) — rejected; temporal design, SQLAlchemy 2.x-native fork of Continuum
- [Audit trigger by 2ndQuadrant](https://github.com/2ndQuadrant/audit-trigger) and [PostgreSQL wiki: Audit trigger](https://wiki.postgresql.org/wiki/Audit_trigger_91plus) — the prior art PostgreSQL-Audit derives from
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the hybrid object graph this record audits, and the attribution-not-reconstruction scope it assumes
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) · [ADR 0006](0006-quarantine-then-scan-antivirus.md) · [ADR 0008](0008-onboard-via-data-json-reimport.md) — the records whose audit-event requirements this mechanism satisfies
- [`docs/architecture.md` §3](../architecture.md#3-technology-choices) and [§4](../architecture.md#auditability) — the stack this must fit and the narrative form of this decision
- NIST SP 800-53 Rev 5.2 — AU-2, AU-3, AU-9, AU-10, AU-12, SI-12, SR-3, RA-5, CM-3, SA-8, SA-15
- **Library metadata** (versions, dates, licences, dependency constraints, stars, contributor counts) was verified against PyPI and the GitHub API on 2026-09-28. **Behavioural claims** were read from the sources linked above and were **not executed**; blocker 1 exists to close that gap.
