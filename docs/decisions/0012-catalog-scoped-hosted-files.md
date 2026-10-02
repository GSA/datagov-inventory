---
title: "Host data files as catalog-scoped resources with a lifecycle independent of Distribution metadata"
status: "proposed"
date: "2026-10-01"
decision_makers: ["Data.gov engineering team"]
category: "Data Handling"
nist_controls: ["AC-3", "AU-2", "AU-3", "SI-3", "SI-3(2)", "SI-7", "SI-10", "SI-12", "SC-7", "CM-3", "CM-7", "SA-8"]
impact_level: "moderate"
ato_relevance: "yes-boundary"
risk_treatment: "mitigate"
---

# Host data files as catalog-scoped resources with a lifecycle independent of Distribution metadata

## Context and Problem Statement

[ADR 0006](0006-quarantine-then-scan-antivirus.md) specifies how an uploaded file
is scanned and where it is stored. It does **not** specify how that file is
addressed over time, nor what it belongs to. This record decides what a hosted file *is*, how it is addressed, and how its
lifecycle relates to the metadata that describes it.

### The requirements this record answers

Stated by the product owner:

| | Requirement |
|---|---|
| **R1** | The data file corresponding to a `live` `Distribution` remains available at a stable (bookmarkable) URL, even when the underlying file is updated. |
| **R2** | The `Distribution` cannot be moved out of `draft` until the first version of the file has been uploaded, scanned successfully, and is available at the stable URL. |
| **R3** | On subsequent updates, the stable URL continues to point at the old version until the new version has passed scanning. |
| **R4** | ~~If the `Distribution` is deleted, the stable URL stops returning a file.~~ **Withdrawn — see below.** |
| **R5** | ~~If the `Distribution` is moved to `draft`, the stable URL stops returning a file. The file remains accessible to the owners of the catalog via links in the Inventory app.~~ **Withdrawn — see below.** |

**R4 and R5 were withdrawn by the product owner** after the analysis in
[Decision Outcome](#decision-outcome): they couple file availability to metadata
state, and that coupling is the source of most of the complexity this record would
otherwise have to carry. They are replaced by **explicit file withdrawal** — an
action on the file, not a side effect of a metadata state change. The second
sentence of R5 (owners can reach the file through the app) is retained in full.

## Decision Drivers

- **A hosted file and an agency-hosted file should be the same kind of thing.** In
  DCAT-US 3.0 a `Distribution` has a `downloadURL` — a URL. When an agency hosts
  its own file, Inventory holds a string. The less Inventory-hosted files differ
  from that, the less special-case logic propagates into export, import,
  validation, and the editor.
- **Re-import must not endanger files.** Any design in which file availability depends on a
  `Distribution` row must reconstruct that dependency on every swap, or silently
  break every published URL.
- **Scan time and publication time are different clocks.** A file is scanned at
  upload, while its `Distribution` is `draft` — possibly for weeks. Any rule that
  equates "scanned" with "publishable" conflates the two.
- **A replacement must not be able to displace a serving file before it is
  scanned.** This is the one hard constraint on the storage shape: two states for
  one logical file.
- **Reuse is the product's characteristic action.**
  [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) makes shared objects
  the central mechanism — "entry by class and re-use." A design in which files are
  the one thing that cannot be reused is inconsistent with that.
- **Retroactive malware recall must stay a query (SI-3(2)).** ADR 0006 records
  `signature_version` per scan so that "a retroactive re-scan after a signature
  update is a query rather than a guess."
- **Unscanned and unreachable must remain the same condition (AC-3)**, for every
  version, including a replacement for an already-public file.
- **Object identifiers are not authorization**
  ([`architecture.md` §4](../architecture.md#4-data-model)). A token in a public
  URL must not become a capability that crosses a catalog boundary.
- **Withdrawal must be deliberate.** Removing something from public view is an
  action with consequences for bookmark holders and downstream consumers; it
  should be requested, not inferred from an unrelated edit.

## Considered Options

1. **Catalog-scoped file resource, lifecycle independent of metadata.** A file is
   uploaded to a catalog, scanned, versioned, and served at a stable URL. A
   `Distribution` references it by `downloadURL` exactly as it would reference an
   agency-hosted file. Withdrawal is an explicit action on the file.
2. **File tied to a `Distribution`.** `hosted_file.distribution_object_id` is the
   owning link; public availability is a function of that object's `state`, and
   re-import rebinds the file to the newly-decomposed `Distribution`. This
   satisfies R4 and R5 as originally written.
3. **Globally-scoped file pool**, not scoped to any catalog — a flat upload area
   shared across the installation, with files selectable from anywhere.
4. **No hosting.** Agencies host their own files; Inventory holds `downloadURL`
   strings only, as it does for external distributions.

## Decision Outcome

Chosen option: **Option 1 — a catalog-scoped file resource whose lifecycle is
independent of `Distribution` metadata**, because it makes an Inventory-hosted
file the same kind of thing as an agency-hosted one, and because it removes
re-import from the set of operations that can affect a published URL.

### Why not Option 2, which the original requirements described

Option 2 was the design this record first carried, and it was reached by taking
R4 and R5 literally. Four consequences made it the worse choice; the product owner
withdrew R4 and R5 rather than accept them.

- **Re-import becomes dangerous.** R4 plus ADR 0008 means every re-import
  unpublishes every file, unless a rebinding mechanism rescues it. That mechanism
  needs a `downloadURL`-parsing step, a check that the parsed token's catalog
  matches the importing catalog (or one agency adopts another's file), and a
  pre-swap diff reporting files about to stop being served. It also leaves a
  residual risk with no fix: an agency that regenerates `data.json` from its own
  system drops Inventory's URLs and orphans its own files. **All of this exists
  only to undo damage the coupling causes.**
- **A routine metadata edit becomes a public-availability change.** Reverting a
  dataset to `draft` to fix a typo breaks every bookmark and every downstream
  consumer of its file. That is a surprising amount of blast radius for an edit,
  and it is the behaviour R5 specifies.
- **Two kinds of `Distribution`.** An agency-hosted distribution holds a URL; an
  Inventory-hosted one holds a URL *and* a lifecycle dependency. The special case
  propagates into export, import, validation, and the editor.
- **Files become the one thing that cannot be reused**, 1:1 with a
  `Distribution`, in a data model whose thesis is shared objects (ADR 0005).

**What is genuinely lost** is implicit withdrawal: unpublishing a dataset no longer
withdraws its file. Three things make that acceptable. Option 2 never offered a
true takedown either — "the URL stops returning a file" was never "the bytes are
erased," since the object remained in S3. The coupling's observable effect was
mostly the surprise in the second bullet. And an explicit withdraw action is a
better takedown primitive than a side effect of a state flip, because it can be
audited as what it is.

### Why not Options 3 and 4

**Option 3 (global pool)** is rejected because scope answers three questions at
once that would otherwise each need inventing: who may upload, who may withdraw,
and what the file picker lists. With no tenant entity in v2
([`architecture.md` §4](../architecture.md#there-is-no-agencybureau-tenant-entity)),
the catalog is the only available ownership anchor, and
`catalog_permission` already resolves authorization over it, transitive grants
included. A global pool would need a parallel permission model built from nothing.

**Option 4 (no hosting)** contradicts the feature list — ADR 0007 quotes *"Data
file storage and public retrieval: MVP Yes"* — and ADR 0006 has already specified
the scanning pipeline for uploads. It is listed because it is the honest baseline:
most agencies will host their own files, and Inventory hosting is a convenience for
those that cannot.

### Schema

`hosted_file` is scoped to a `catalog` and references no `metadata_object`. It is
**not** part of the object graph and is **not** cascade-deleted with
`metadata_object` — which is what lets it survive ADR 0008's destroy-and-rebuild
without any rebinding step.

```
hosted_file                             -- catalog-scoped resource; independent lifecycle
  id                      uuid PK       -- the stable URL token; NEVER changes
  catalog_id              uuid FK       -- immutable; ownership, authorization, picker scope
  label                   text          -- human-meaningful name for the picker
  current_version_id      uuid FK NULL  -- latest clean version; NULL until first clean scan
  withdrawn_at            timestamptz NULL  -- explicit withdrawal; stops public serving
  download_count          bigint        -- see "What is recorded about downloads"
  first_downloaded_at     timestamptz NULL
  last_downloaded_at      timestamptz NULL
  created_by              uuid FK
  created_at              timestamptz

hosted_file_version                     -- immutable once written
  id                 uuid PK
  hosted_file_id     uuid FK
  ordinal            int                -- upload order
  s3_key             text               -- files/{hosted_file_id}/{id}
  sha256             text               -- SI-7, per version
  size_bytes         bigint
  content_type       text
  original_filename  text               -- per version; filenames change between updates
  scan_state         text               -- pending | clean | infected | error
  signature_version  text               -- SI-3(2), per version
  scanned_at         timestamptz
  uploaded_by        uuid FK
  created_at         timestamptz
```
Comments on fields:
- `label` exists because the picker needs
something readable — the identifier is an opaque UUID by design.
- `size_bytes` and `content_type` support the
picker and the `Content-Type` on delivery.

S3 prefixes become `quarantine/`, `files/`, and `exports/`. **`clean/`
disappears**: a scanned version is identified by its row, not by its placement.

### The single invariant

> `current_version_id` advances **only** when a version reaches
> `scan_state = 'clean'`, in the same transaction as that state change.

| Req | Mechanism |
|---|---|
| **R1** | The URL keys on `hosted_file.id`, which never changes. A content update advances `current_version_id`. |
| **R2** | Publication-time check: resolve each `Distribution`'s `downloadURL`; if it is Inventory-hosted, require a non-null `current_version_id`. See below. |
| **R3** | The pointer does not advance for a `pending` version — nor for `infected` or `error`, so a bad upload cannot displace a good file. |
| **R4** (replaced) | Explicit withdrawal sets `withdrawn_at`; the public route 404s. Deleting a `Distribution` has no effect on the file. |
| **R5** (replaced) | Public serving does not depend on `Distribution` state. Owners reach any clean version through the authenticated route, as before. |

**R2 generalizes rather than disappearing.** The check becomes "every `live`
`Distribution`'s `downloadURL` resolves to something real," which for an
Inventory-hosted file means a clean current version, and for an external URL means
the URL validation the wiki already requires for live catalogs. R2 stops being a
special mechanism and becomes one case of a check v2 needs anyway. This also
retires the question of whether the gate means *bound* or *publicly fetchable* —
a file is publicly fetchable as soon as it has a clean version, independent of any
`Distribution`, so the ambiguity does not arise.

### Routes

```
GET /f/{hosted_file_id}                            -- the public bookmark
  404 unless  hosted_file.withdrawn_at IS NULL
          AND current_version_id IS NOT NULL
  -> 302 to a presigned URL for the current version (TTL: minutes)
     Content-Disposition from original_filename
     Cache-Control: no-store

GET /catalog/{cid}/file/{hosted_file_id}/v/{vid}   -- owner access, R5 second sentence
  -> catalog_permission `read` on {cid}, including transitive grants
  -> direct-object-reference check: hosted_file.catalog_id == cid
  -> any clean version, including superseded ones
  -> 302 to a presigned URL
```

The public condition is now **two column reads on one row** — no join to
`metadata_object`, no `state` lookup. That is the whole benefit of decoupling,
expressed as a query.

Five properties are load-bearing:

- **404, not 403**, for a withdrawn or not-yet-scanned file. A 403 would confirm
  that the identifier names something.
- **302, not 301**, with `Cache-Control: no-store`. A permanent or cached redirect
  would survive a withdrawal and defeat it.
- **A `pending` version is never served** on either route, preserving ADR 0006's
  "unscanned and unreachable are the same condition."
- **The presigned TTL only has to cover redirect-to-transfer-start**, so it is
  minutes. A long-lived presigned URL is a public bucket with extra steps — a
  forwardable bearer token valid for its whole window, with no revocation — and
  bookmarking it is the failure mode this design exists to avoid. The bookmark is
  the app route; the presigned URL is an implementation detail the user never
  retains.
- **The owner route's catalog check is not redundant with the permission check.**
  A `hosted_file` identifier carries no scope, so without
  `hosted_file.catalog_id == cid` a user holding `read` on any catalog could read
  any file by pairing their own `cid` with someone else's file id. This is the
  direct-object-reference hazard
  [`architecture.md` §4](../architecture.md#4-data-model) states for reusable
  objects, on a different table. It needs its own test.

Neither route can be served by `inventory-proxy`: both require database reads.
`/f/*` must be added to the proxy's default-deny path allowlist
(`proxy/nginx.conf:44,48`) and rate-limited — it is an unauthenticated endpoint
fronting egress of files up to 500 MB.

### Why the bucket stays private

The bucket could now be public-read without leaking drafts, because under this
decision there is no such thing as a draft file — a clean file is public, full
stop. That removes the objection that previously settled the question, so it is
re-argued here on its own terms. Three reasons to keep serving app-mediated:

1. **Withdrawal stays a column write.** Public-read makes the S3 key the
   credential, so withdrawing means deleting or moving the object — a storage
   mutation with a window in which the database and the bucket disagree. The same
   applies to SI-3(2) recall, which is the case where immediacy matters most.
2. **The bookmark would break on update.** A public bookmark would embed the
   version's key, so replacing the file would break it — unless objects were
   overwritten in place, which forfeits per-version `sha256` and scan state. The
   app route is what makes R1 and R3 compatible.
3. **`Content-Disposition` and the download counter need a request to observe.**
   Both are small; together with the above they settle it.

The cost is one database read and one HMAC per download. Bytes still never pass
through Python: the client fetches S3 directly, as in
[`architecture.md` §5.2](../architecture.md#52-export-with-error-reporting).

### Two buckets, not one

`inventory-s3` is split into two service instances:

| Instance | Contents | Properties |
|---|---|---|
| `inventory-s3-quarantine` | `quarantine/` | Unversioned, aggressive lifecycle expiry, never presigned, never public |
| `inventory-s3-files` | `files/`, `exports/` | Private, serving content; versioning optional (see blockers) |

Untrusted inbound bytes and vetted content are different trust boundaries and
should not share a policy surface. Two concrete benefits: retention can differ, so
quarantine expires quickly while served files persist; and a policy mistake on the
serving instance cannot expose unscanned uploads. ADR 0006's deletion of an
infected object also stays a real deletion, which it would not be under a
versioned bucket where an unqualified `DELETE` writes a delete marker and retains
the bytes.

S3-native versioning on `inventory-s3-files` is **not required** by this design and
is left as an option. It buys retention of superseded bytes — rollback from a bad
replacement — but it does not deliver R1 or R3, both of which come from the
stable-key-plus-row-pointer arrangement above. Whether a cloud.gov tenant can
enable it is also unverified (see blockers).

### What is recorded about downloads

Not identity. A public download is anonymous: the most that could be captured is
IP and user agent, which for CGNAT, corporate egress, and cloud ranges identifies
nobody, cannot support notification, and carries a privacy cost of its own — IP
addresses are PII, and `architecture.md` §6 drains logs to a **shared** archive
readable by principals with no Inventory access.

What an incident report actually needs when a file clean under signature set *N*
turns malicious under *N+1* is **magnitude and window**: was it fetched at all,
roughly how often, and between which dates. "Never downloaded" versus "downloaded
40,000 times" is the difference between a closed note and an incident with an
impact statement, and neither requires identity.

So the record is a **counter plus first-seen and last-seen on `hosted_file`**,
incremented when the redirect is issued. Three consequences:

- No per-request log of public downloads is required, and the PII question does not
  arise.
- The counter is a **row update**, so [ADR 0011](0011-audit-trail-mechanism.md)'s
  triggers capture it. This record therefore does **not** make ADR 0011's
  open question about non-row events load-bearing; that blocker remains about
  authentication failures and authorization denials only.
- **It is approximate, and must not be described otherwise.** The app issues a 302
  and never observes the transfer: a client may take the redirect and not fetch, or
  may fetch repeatedly within one TTL. It is a proxy for downloads, not a count of
  them, and the SSP should say so.

The **authenticated** owner route is separately attributable through
`catalog_permission` and the audit trail, and those are the people who can actually
be contacted — agency staff who pulled a file into their own systems. That is a
minority of traffic and does not change the reasoning above.

### How a Distribution references a hosted file

When editing a `Distribution`, the author picks from the catalog's hosted files —
a list of `hosted_file` rows scoped by `catalog_id` — or types an external URL. The
picker writes a `downloadURL` string; **nothing else is stored.** Export emits that
string like any other. An external consumer cannot tell from the catalog whether
the file is hosted by Inventory or by the agency, which is the intended outcome.

Two consequences worth stating:

- **A hosted file may be referenced by many `Distribution` objects, or by none.**
  Reuse falls out of the design rather than being added to it, consistent with
  ADR 0005's shared-object model.
- **Re-import does not touch hosted files at all.** It decomposes incoming
  metadata into a new object set carrying `downloadURL` strings; the files those
  strings point at are untouched, because nothing links them to the replaced
  objects. No rebinding, no pre-swap orphan diff, no cross-catalog adoption check.
  This closes ADR 0008's unspecified handling of `resource_file` by making the
  question not arise.

A hosted file that no `Distribution` references is **publicly reachable with no
metadata describing it**, which is the main governance cost of this decision — see
[Negative Consequences](#negative-consequences).

### Positive Consequences

- **Re-import is no longer a hazard to published files.** The rebinding mechanism,
  the pre-swap orphan diff, the cross-catalog adoption check, and the
  unfixable residual risk of an agency regenerating `data.json` from its own system
  all disappear. This is the single largest simplification.
- **One kind of `Distribution`.** Hosted and external are both a `downloadURL`
  string, so export, import, validation, and the editor carry no special case.
- **A metadata edit cannot change public file availability.** Reverting a dataset
  to `draft` to fix a typo no longer breaks bookmarks or downstream consumers.
- **Files are reusable like any other object**, consistent with ADR 0005's thesis,
  and the picker makes that reuse visible.
- **R1 and R3 hold with no storage mutation**, and R3's mechanism covers
  `infected` and `error` as well as `pending` — a stronger property than the
  requirement asked for.
- **`signature_version` is per version**, restoring the retroactive re-scan query
  ADR 0006 intends and that a single mutable row could not answer: *which versions
  were scanned under the now-superseded signature set?*
- **`sha256` is immutable**, recorded per version rather than updated in place,
  which is what SI-7 integrity verification requires.
- **Withdrawal is auditable as itself** — an explicit act with an actor and a
  timestamp, rather than a side effect inferred from a `state` change.
- **The public serving check is two columns on one row**, which is cheap, easy to
  reason about, and hard to get subtly wrong.

### Negative Consequences

- **Unpublishing a dataset no longer withdraws its file.** This is the accepted
  loss, and the one most likely to surprise a user. Two actions are now required
  where one previously sufficed, and the editor must make the second discoverable
  at the moment it is relevant — unpublishing a `Distribution` should offer to
  withdraw the file it references, and should say plainly that the file remains
  public until withdrawn. Without that prompt, this decision converts a surprising
  behaviour into a silent one, which is not obviously an improvement.
- **A hosted file can be public with no metadata describing it.** A file uploaded
  and never referenced, or whose referencing `Distribution` was deleted, is
  reachable with nothing saying what it is or why it is public. An
  unreferenced-file report is required, and someone must own the question of what
  to do about entries on it. Note ADR 0005 already carries this ambiguity for
  reusable objects — "orphan is ill-defined for something deliberately
  unattached" — so this is a known problem in a new place, not a new class of one.
- **It is a more file-hosting-shaped product than Option 2.** ADR 0007 retired the
  DataStore to narrow Inventory to "metadata authoring rather than data serving,"
  and a general-purpose per-catalog upload area sits less comfortably with that
  framing than files-attached-to-distributions did. The bytes served are identical
  and only the affordance differs, but this is the same reasoning pointing the other
  way and should be weighed rather than waved past (CM-7).
- **Storage grows without bound.** Every version of every file is retained, and
  withdrawal does not delete bytes. This multiplies the SI-12 retention question
  already open on [ADR 0011](0011-audit-trail-mechanism.md) and the `exports/`
  lifecycle decision already open in
  [`architecture.md` §5.2](../architecture.md#52-export-with-error-reporting).
  Retention is **not decided here** and is a blocker.
- **"Withdrawn" is not "erased."** `withdrawn_at` stops public serving; the object
  remains in S3 and remains reachable to catalog members through the owner route. A
  takedown requiring actual destruction is a separate operation this record does not
  define.
- **A new unauthenticated route fronting up-to-500 MB egress is a denial-of-service
  surface** v2 does not otherwise have, so rate limiting is a security control here
  rather than hygiene.
- **Public download at MVP moves ADR 0006's malware-distribution risk to launch
  day.** That record describes v1's exposure as "bounded by authentication — only
  vetted agency staff can upload," with public usage on the "long-term roadmap."
  That framing no longer holds.
- **Two tables replace one, and a second S3 instance replaces one.** The migration
  cost is nil only because no production data exists yet
  ([`architecture.md` §6](../architecture.md#squash-the-migration-history-at-10)),
  and the second instance is a small addition to ADR 0009's Terraform.
- **The bookmark is an opaque UUID.** `label` makes the file readable inside the
  app, but a human-meaningful public path would need a mutable name with its own
  uniqueness and collision rules; deliberately out of scope.
- **The download counter is a write on a read path.** At Inventory's scale this is
  irrelevant, but it is a contended row update, and it should not be made
  transactional with the redirect in a way that fails the download if the increment
  fails.

### Compliance Consequences

- **AC-3 (Access Enforcement)** — public serving is gated on the file's own state
  (`withdrawn_at IS NULL AND current_version_id IS NOT NULL`) and on **nothing
  else**. The SSP must state that plainly: a hosted file's availability is not
  derived from catalog permissions or metadata publication state. The authenticated
  owner route requires `read` plus the direct-object-reference check that
  `hosted_file.catalog_id` matches the catalog in the path — object identifiers are
  not authorization.
- **SI-3, SI-3(2) (Malicious Code Protection, Automatic Updates)** — per-version
  `signature_version` makes retroactive re-scan a query. Withdrawal is a column
  write, effective immediately, with no cache or bucket-policy lag. The
  download counter supplies the magnitude-and-window evidence an incident report
  needs, and is explicitly **approximate**.
- **SI-7 (Integrity)** — `sha256` recorded per immutable version, never updated in
  place.
- **SI-10 (Input Validation)** — ADR 0006's size, MIME, and extension allowlist
  applies to **every** version, not only the first. The publication-time
  `downloadURL` check (R2) applies to hosted and external URLs alike.
- **SI-12 (Retention)** — **open.** Superseded versions and withdrawn files
  accumulate without bound. A blocker.
- **SC-7 (Boundary Protection)** — **the reason this record is `yes-boundary`.**
  It introduces an unauthenticated public data flow serving file content at MVP,
  and a second S3 service instance. The SSP data-flow diagram and component
  inventory require update, and the ISSO should review.
- **CM-7 (Least Functionality)** — a per-catalog general-purpose upload area is a
  broader capability than file-attached-to-distribution. It is justified by the
  feature list's "public retrieval: MVP Yes," but the scope tension with ADR 0007's
  narrowing of Inventory to metadata authoring should be acknowledged in the SSP
  rather than left for an assessor to notice.
- **AU-2, AU-3 (Audit Events, Content)** — new events: file created, version
  uploaded, scan result per version, current-version advance, withdrawal, and
  reinstatement. **All are row mutations**, so ADR 0011's triggers capture them
  with no event-writing code — including the download counter. Withdrawal in
  particular must record its actor, since it is now a deliberate act rather than a
  consequence.
- **CM-3 (Configuration Change Control)** — the stable URL is a published external
  interface. It appears in every bookmark and in every exported `data.json`, so the
  route pattern is an interface contract from the first release; changing its shape
  later is a breaking change for consumers outside this system.

## Blockers before acceptance

1. **Confirm the `live`-means-public premise with a named decision maker**, and
   record it as a product decision rather than inheriting it from this record.
2. **Decide the unreferenced-file policy.** A hosted file referenced by no
   `Distribution` is public with no metadata describing it. Decide whether that is
   permitted indefinitely, flagged for review, or auto-withdrawn after a period —
   and who acts on the report. Coordinate with ADR 0005's orphan-definition
   question, which is the same problem on a different table.
3. **Decide retention** for superseded versions and withdrawn files (SI-12).
   Coordinate with the `exports/` lifecycle decision and ADR 0011's `activity`
   retention blocker; all three are the same conversation.
4. **Decide whether `current_version_id` auto-advances on a clean scan** or waits
   for explicit owner confirmation. Auto-advance satisfies R1 and R3 literally;
   confirmation gives the owner a verification step before the public URL changes
   content. A product question.
5. **Set the presigned TTL and verify the ceiling.** The value should be minutes.
   Confirm the expiry behaviour available with the credentials the cloud.gov S3
   broker issues via service binding.
6. **Set rate limits for `/f/*`** and confirm the proxy allowlist entry, including
   the egress and connection-budget implications of unauthenticated large
   downloads.
7. **Confirm the two-instance S3 split is available and worth its cost** under the
   cloud.gov broker, and decide whether `inventory-s3-files` enables versioning.
   Both are ADR 0009 Terraform changes. Versioning's availability to a tenant is
   unverified.
8. **Design the withdrawal prompt.** The accepted loss of implicit withdrawal is
   only acceptable if the editor offers to withdraw a file when its last
   referencing `Distribution` is unpublished or deleted. Without it, this decision
   trades a surprising behaviour for a silent one. This is a UX requirement, not a
   nicety.

## Consequences for other records

Each is required for this record to be coherent with the rest. **All have now been
made**, in the same change that introduced this record; the table is retained as
the record of what had to move and why, so a reviewer can check each edit against
its stated reason rather than re-deriving it.

| Record | Required change | Status |
|---|---|---|
| [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) | `read` redefined as view-only-including-drafts; direct-object-reference requirement for the owner file route. **Still correct under this rewrite** — the owner route is unchanged — but its stated rationale shifts: `read` now matters for draft *metadata* review, not for draft file access, since files have no draft state. | **Made**, including the rationale touch-up |
| [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) | Remove `resource_file` from the ERD. **`hosted_file` is not part of the object graph and should not be added to it** — note the deliberate absence, and that a `Distribution` holds only a `downloadURL` string. Its orphan-definition question is now shared with this record's unreferenced-file policy. | **Made** |
| [ADR 0006](0006-quarantine-then-scan-antivirus.md) | Scan state and `signature_version` move to the version row; `clean/` becomes `files/` in a separate service instance; the allowlist applies per version; the "bounded by authentication" risk framing no longer holds. | **Made** |
| [ADR 0007](0007-retire-tabular-datastore-api.md) | Note the scope tension: its narrowing of Inventory to "metadata authoring rather than data serving" sits against a per-catalog upload area and a public download route (CM-7). | **Made** |
| [ADR 0008](0008-onboard-via-data-json-reimport.md) | Record that re-import does **not** affect hosted files, and why — closing the unspecified `resource_file` handling by making the question not arise. No rebinding mechanism is needed. Onboarding imports no file bytes. | **Made** |
| [ADR 0009](0009-terraform-cloudgov-for-infrastructure.md) | Two S3 service instances rather than one; quarantine must be unversioned; optional versioning on the serving instance, with tenant availability unverified. | **Made** |
| [ADR 0011](0011-audit-trail-mechanism.md) | Add operations `upload_version`, `advance_current_version`, `withdraw_file`, `reinstate_file`. **Its non-row-event blocker is not made load-bearing by this record**, because the download counter is a row update. | **Made** |
| [`architecture.md`](../architecture.md) | §2 container view and S3 instances; §4 ERD and the hosted-file narrative; §5.2 export delivery; §5.3 upload flow; §5.3.1 download flow; §5.4 re-import note (rebinding paragraph removed); §6 services bound, Terraform table, and the unreferenced-file task; §10 compliance posture. | **Made** |

## Links

- [ADR 0006](0006-quarantine-then-scan-antivirus.md) — the scan lifecycle this record extends to multiple versions
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the object graph `hosted_file` deliberately sits outside, and the reuse thesis this design follows
- [ADR 0008](0008-onboard-via-data-json-reimport.md) — build-then-swap re-import, which this design makes irrelevant to files
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) — permission levels and the owner route's authorization
- [ADR 0007](0007-retire-tabular-datastore-api.md) — quotes the "public retrieval: MVP Yes" feature-list line, and the scope narrowing this record sits in tension with
- [ADR 0009](0009-terraform-cloudgov-for-infrastructure.md) — provisions the two S3 instances
- [ADR 0011](0011-audit-trail-mechanism.md) — captures every event in this design as a row mutation
- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — feature list
- [`docs/architecture.md`](../architecture.md) §4, §5.2, §5.3 — data model, presigned delivery, upload flow
- NIST SP 800-53 Rev 5.2 — AC-3, AU-2, AU-3, SI-3, SI-3(2), SI-7, SI-10, SI-12, SC-7, CM-3, CM-7, SA-8
- **Supersedes an earlier draft of this record** (`0012-stable-urls-for-hosted-data-files.md`, never committed) which tied a hosted file to a `Distribution` and derived public availability from metadata state. The requirements that drove it, R4 and R5, were withdrawn by the product owner; the rationale is preserved in [Why not Option 2](#why-not-option-2-which-the-original-requirements-described).
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
- **Unverified claims.** The cloud.gov brokered-S3 presigned-URL expiry ceiling, the availability of bucket versioning to a tenant, the cost and availability of a second S3 service instance, and `terraform-cloudgov`'s `s3` module inputs were **not** executed or confirmed against a live environment. Blockers 5 and 7 exist to close the parts of that gap this design depends on.
