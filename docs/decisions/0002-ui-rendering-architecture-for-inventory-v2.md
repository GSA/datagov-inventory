---
title: "Use server-rendered Flask pages with a local-first React editor for Inventory v2"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Input Validation and Output Handling"
nist_controls: ["SI-10", "SI-15", "SC-18", "AU-2", "AU-3", "AC-12", "SA-8", "SA-15", "SR-3"]
impact_level: "moderate"
ato_relevance: "yes-internal"
risk_treatment: "mitigate"
---

# Use server-rendered Flask pages with a local-first React editor for Inventory v2

> **Status note:** This record is `proposed`. The product questions are now
> answered (see [Decided requirements](#decided-requirements)), which **reverses
> this record's earlier recommendation** of server-rendered Jinja and HTMX for the
> editor. The direction below is a proposal that must be proven by a
> [spike](#blockers-before-acceptance) before it is accepted.

## Context and Problem Statement

Inventory v2 replaces the CKAN 2.11.5 implementation with a custom application
whose central feature is DCAT-US 3.0 catalog authoring "by class and re-use": a
model of nested, independently reusable objects (`Dataset`, `DatasetSeries`,
`DataService`, `Distribution`, `Kind`, `Organization`, `Concept`, `Location`). We
must decide how the authoring UI is built and where catalog state lives.

An earlier framing of this decision was wrong. The v1 pain-point list cites both
"UI revamp/rewrite required to be 508 compliant" and "custom React app data entry
form... will need complete re-write for 3.0", which invites the inference that
React caused the accessibility problem. It did not. [USWDS](https://designsystem.digital.gov/)
is CSS plus vanilla JS with a mature React binding
([`@trussworks/react-uswds`](https://github.com/trussworks/react-uswds)); USWDS
adoption and rendering architecture are independent choices. The v1 form needed a
rewrite because it hard-coded DCAT-US 1.1 field structure into components.

### Decided requirements

Answered by the product owner, 2026-10-05:

- **Unified editor.** One catalog workspace. Sub-objects are selectable, and every
  field that takes a class offers *select existing* or *create new*, where create
  opens a dialog containing the form for that class.
- **Local-first.** The catalog is small enough to hold in the browser, and is
  synced back to the database.
- **Scale and concurrency.** In v1, one catalog has over 3,000 datasets (its export
  currently fails, so it may be unused), two have over 1,000, and most of the ~150
  have fewer than 50. Each catalog is edited mostly by one user or a very small
  group, so concurrent edits to the same object are rare.
- **Anonymous browser-only editing** is scheduled for 2.1, with no backend storage.

## Decision Drivers

- **One validator (SI-10).** Validation, with warnings, is the shared Data.gov
  validator API ([ADR 0010](0010-depend-on-upstream-dcat-us-code.md)). A second
  implementation in the browser would drift, and drift in a validator reaches
  agencies as bad exports.
- **One schema interpreter.** Field descriptions come from the schema, so a
  DCAT-US point release is a submodule bump plus a change in one place.
- **Section 508 / WCAG 2.1 AA** is the top-stated v1 pain point and a statutory
  obligation.
- **The editing model is highly interactive**: a catalog tree, a detail pane,
  select-or-create at every reference, and a live preview.
- **Local-first and 2.1 anonymous editing** need the client to hold and render
  catalog state without a server round trip per interaction.
- **Session timeout (AC-12)** and **locally held draft metadata** on shared
  government machines interact.
- **Output sanitization (SI-15, SC-18)** and **supply chain (SR-3)**: any client
  application adds a JavaScript dependency tree to review.
- **Platform consistency (SA-8, SA-15).** `catalog.data.gov` is Flask + Jinja +
  USWDS + HTMX with `pa11y-ci` and `axe-playwright-python` in CI; the team's
  skills and on-call practice are Python and Flask.

## Considered Options

1. **Server-rendered Jinja + USWDS + HTMX throughout**, with small JavaScript
   islands (this record's earlier choice). HTMX is hypermedia: the server is the
   source of truth and the client holds no model. That fits dialog-based CRUD but
   not the requirements above. It cannot render from a local store without bespoke
   JavaScript that is a client state layer in all but name; editing one shared
   `Kind` must update the tree, detail pane, and preview together, which couples
   the server to the page layout; and unsaved multi-object state, dirty tracking,
   and undo end up in client code anyway.
2. **Full single-page application** (React + `@trussworks/react-uswds`) for every
   page. Rejected: it carries the SPA's build chain and accessibility burden to
   pages that do not need it (login, catalog lists, export, file management).
3. **Hybrid: server-rendered Flask pages, with a local-first React editor mounted
   on one route.** The editor is the only SPA. Everything else stays Jinja + USWDS
   + HTMX.
4. **Stateless HTMX round trip** for anonymous editing, where the browser holds
   the catalog and the server renders and stores nothing. Rejected: anonymous
   draft metadata would transit the server, contradicting the promise of
   browser-only storage and requiring log and APM exclusion and an ATO boundary
   review. HTMX adds little there because the state is client JavaScript anyway.

The backend language is a separate question. **It stays Python**: the graph library is
Python and the team runs Flask services. A TypeScript full stack would allow shared client and
server logic, at the cost of reimplementing the upstream integration and
abandoning the team's operating model.

## Decision Outcome

Proposed option: **Option 3, the hybrid**, because the unified, local-first editor
needs a client application, while the rest of Inventory does not, and keeping the
SPA to one route confines its build chain and accessibility audit to one screen.

Commitments, which are part of the decision and not implementation detail:

- **Scope boundary.** The React application owns the catalog editing route only.
  Login, the catalog list, export, hosted-file management (including
  upload-status polling, per [ADR 0012](0012-catalog-scoped-hosted-files.md)), and
  administration are Jinja + USWDS + HTMX. The editor is mounted in a Flask page.
- **API-first.** All DCAT logic lives in a Python library with no web-framework
  dependency (validate, decompose and assemble the object graph, schema to
  form-model). It is exposed through a stateless APIFlask API:
  `POST /api/validate`, `POST /api/export`, `GET /api/schema/{class}/form`
  returning the form model as **JSON**, plus object CRUD and sync endpoints for the
  editor. There is no `POST /api/convert`
  ([`architecture.md` §3](../architecture.md#v2-does-not-convert-dcat-us-11)).
- **Validation is the shared Data.gov validator API**, called by the server, which is authoritative. Client checks are advisory only.
- **Local store with sync.** The editor works against a copy in browser storage and
  syncs to the database. The proposed default is **per-object version numbers with
  optimistic concurrency**: a stale write is rejected and the user is asked to
  reload. Conflicts are rare for these usage patterns, so a merge UI is not
  proposed.
- **Large catalogs.** The tree is virtualized or lazily loaded. A 3,000-dataset
  catalog is on the order of tens of MB (an estimate to measure), which browser
  storage handles; the cost is rendering, not storage.
- **Dialogs are single-level.** *Create new* from inside a dialog replaces the
  dialog's content, with a breadcrumb or back control, rather than stacking modals.
  Nested modals are a known focus-management failure under WCAG, and the USWDS
  modal is not designed for them.
- **Anonymous editing in 2.1** is the same editor with sync disabled. How it
  validates without storing data is decided at 2.1. The likely path is calling the
  Data.gov validator API from the browser, which needs its cross-origin policy to
  allow it; otherwise the request goes through the Inventory server, so the draft
  data transits it and needs a boundary review.

### Conditions that reverse this decision

Fall back to server-persisted editing (Option 1) if the spike shows that:

- a 3,000-dataset catalog cannot be loaded and edited responsively in the browser, or
- the editor's tree and dialog cannot meet WCAG 2.1 AA with a reasonable effort.

Local-first would then be dropped as a requirement.

### Positive Consequences

- The editor fits its interaction model, and local-first and 2.1 anonymous editing
  come from the same code.
- One shared validator, and one schema interpreter in Python.
- Accessibility work is confined to one SPA screen; every other page begins as
  native HTML.
- Tooling, CI, and operations for non-editor pages are shared with `datagov-catalog`.
- Work survives the AC-12 idle timeout because the working copy is local.

### Negative Consequences

- **A second front-end stack** for the team: Node build, TypeScript or JavaScript,
  and npm dependency review.
- **The API grows** from validate and export to full object CRUD and sync, with CSRF
  protection for the JSON API.
- **Where the graph logic runs is unresolved.** The client either stores nested
  DCAT JSON and syncs it, or stores graph objects and needs decompose and assemble
  in JavaScript as well. The spike must choose; the second risks duplicating the
  library.
- **Locally held draft metadata** persists in the browser on shared machines, is
  per-browser, and is lost if site data is cleared. Draft recovery must be explicit
  on return, so a stale local copy cannot overwrite a newer saved version.
- **In-progress local edits are not auditable.** The audit trail covers saved
  versions only.
- **Platform consistency is reduced** for the editor route.

### Compliance Consequences

- **SI-10** — one shared validator, called by the server, which is authoritative; client checks advisory.
- **SI-15 / SC-18** — React escapes by default, and `dangerouslySetInnerHTML` is
  banned; a Content-Security-Policy applies; all JavaScript is first-party or
  reviewed and pinned.
- **SR-3** — committed lockfile, dependency audit in CI, reviewed upgrades.
- **AU-2 / AU-3** — saved versions are audited through
  [ADR 0011](0011-audit-trail-mechanism.md); local in-progress edits are not.
- **AC-12** — the 900-second idle timeout is retained. The policy for the local
  copy on logout and on idle timeout must be set; the proposal is to purge it on
  explicit logout and keep it across idle timeout.
- **Section 508 / WCAG 2.1 AA** — `pa11y-ci` and `axe` as blocking CI gates on every
  page including the editor, plus manual keyboard and screen-reader testing of
  the editor. This decision does not by itself establish conformance.
- **ATO.** `yes-internal` for the MVP. Revisit if anonymous 2.1 editing sends data
  through the server.

## Blockers before acceptance

1. **Run the editor spike and record its outcome.** Time-boxed, covering:
   (a) load and edit a catalog of 3,000+ datasets in the browser responsively;
   (b) a local-store plus sync prototype that chooses the local data format and
   confirms where decompose and assemble run; (c) a USWDS React tree plus
   single-level dialog meeting WCAG 2.1 AA under `axe` and manual screen-reader
   testing.
2. **Confirm the team can build and maintain a React/TypeScript editor**, or name
   who will. The team's experience is Python and Flask, and this choice adds a
   front-end stack.

## Links

- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — v2 feature list and user/data management model
- [DCAT-US 3.0](https://github.com/GSA/data.gov/wiki/DCAT-US-3.0) and [GSA/dcat-us](https://github.com/GSA/dcat-us) — schema and `_external/dcat-us` submodule source
- [ADR 0010](0010-depend-on-upstream-dcat-us-code.md) — validation is the shared Data.gov validator API
- [GSA/datagov-catalog](https://github.com/GSA/datagov-catalog) — sibling Flask + Jinja + USWDS + HTMX application
- [USWDS](https://designsystem.digital.gov/) and [`@trussworks/react-uswds`](https://github.com/trussworks/react-uswds) — design system and its React binding
- NIST SP 800-53 Rev 5.2 — SI-10, SI-15, SC-18, AU-2, AU-3, AC-12, SA-8, SA-15, SR-3
- Section 508 / WCAG 2.1 AA — [Section 508 standards](https://www.section508.gov/)
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing.
