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
is scanned and where it is stored. It does not specify how that file is addressed
over time, what it belongs to, or how its lifecycle relates to the metadata that
describes it. This record decides those three things.

### Requirements

Stated by the product owner:

| | Requirement |
|---|---|
| **R1** | The file for a `live` `Distribution` stays available at a stable, bookmarkable URL, even when the file is updated. |
| **R2** | A `Distribution` cannot leave `draft` until the first file version has been uploaded, scanned clean, and is available at the stable URL. |
| **R3** | On update, the stable URL keeps serving the old version until the new version passes scanning. |
| **R4, R5** | *Withdrawn by the product owner.* They tied file availability to `Distribution` state (deleted or `draft` means the URL stops serving). They are replaced by **explicit file withdrawal**, an action on the file. Owners can still reach any file through the app. |

## Decision Drivers

- **An Inventory-hosted file should be the same kind of thing as an agency-hosted
  one.** In DCAT-US 3.0 a `Distribution` has a `downloadURL`, a string. The less
  hosted files differ from that, the less special-case logic reaches export,
  import, validation, and the editor.
- **Re-import must not endanger files**, and a metadata edit must not change public
  availability.
- **A replacement must not displace a serving file before it is scanned.**
- **Reuse is the product's characteristic action**
  ([ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md)); files should not be
  the one thing that cannot be reused.
- **Malware recall must stay a query (SI-3(2))**, and unscanned must mean
  unreachable (AC-3), for every version.
- **Identifiers are not authorization**
  ([`architecture.md` §4](../architecture.md#4-data-model)).
- **Withdrawal must be deliberate**, not inferred from an unrelated edit.

## Considered Options

1. **Catalog-scoped file resource with its own lifecycle.** A `Distribution`
   references it through `downloadURL`, exactly as it would an agency-hosted file.
2. **File tied to a `Distribution`**, with availability derived from that object's
   `state` (R4 and R5 as originally written). Rejected: re-import would unpublish
   every file unless a rebinding mechanism rescued it, a routine edit back to
   `draft` would break every bookmark, hosted and external distributions would
   become two different things, and files would be the only non-reusable object.
3. **Global file pool**, not scoped to a catalog. Rejected: scope answers who may
   upload, who may withdraw, and what the picker lists. With no tenant entity
   ([`architecture.md` §4](../architecture.md#there-is-no-agencybureau-tenant-entity)),
   the catalog is the only ownership anchor, and `catalog_permission` already
   resolves authorization over it.
4. **No hosting.** Agencies host their own files. Rejected: it contradicts the
   feature list ("data file storage and public retrieval: MVP Yes"), though it
   remains the baseline most agencies will use.

## Decision Outcome

Chosen option: **Option 1**, because it makes a hosted file the same kind of thing
as an agency-hosted one and removes re-import from the operations that can affect
a published URL.

**What is lost** is implicit withdrawal: unpublishing a dataset no longer withdraws
its file. This is acceptable because Option 2 never erased bytes either, and an
explicit withdraw action is a better takedown primitive than a side effect of a
state change, since it is audited as what it is. The editor must make it
discoverable (see [design decisions](#design-decisions-made-in-review)).

### Schema

`hosted_file` is scoped to a `catalog` and references no `metadata_object`. It is
**not** part of the object graph and is **not** cascade-deleted with it, which is
what lets it survive ADR 0008's destroy-and-rebuild without a rebinding step.

```
hosted_file                             -- catalog-scoped resource; independent lifecycle
  id                      uuid PK       -- the stable URL token; NEVER changes
  catalog_id              uuid FK       -- immutable; ownership, authorization, picker scope
  label                   text          -- human-readable name for the picker
  current_version_id      uuid FK NULL  -- latest clean version; NULL until first clean scan
  withdrawn_at            timestamptz NULL  -- explicit withdrawal; stops public serving
  download_count          bigint        -- approximate; see "Download recording"
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

S3 prefixes are `quarantine/`, `files/`, and `exports/`. A scanned version is
identified by its row, not by where it sits, so `clean/` is gone.

### The single invariant

> `current_version_id` advances **only** when a version reaches
> `scan_state = 'clean'`, in the same transaction as that state change.

| Req | Mechanism |
|---|---|
| **R1** | The URL keys on `hosted_file.id`, which never changes. An update advances `current_version_id`. |
| **R2** | Publication-time check: every `live` `Distribution`'s `downloadURL` must resolve. For an Inventory-hosted file that means a non-null `current_version_id`; for an external URL it is the URL validation already required for live catalogs. |
| **R3** | The pointer does not advance for `pending`, `infected`, or `error`, so a bad upload cannot displace a good file. |
| **R4, R5** (replaced) | Withdrawal sets `withdrawn_at` and the public route 404s. `Distribution` state has no effect on the file. |

### Routes

```
GET /f/{hosted_file_id}                            -- the public bookmark
  404 unless  hosted_file.withdrawn_at IS NULL
          AND current_version_id IS NOT NULL
  -> 302 to a presigned URL for the current version (TTL: 5 minutes)
     Content-Disposition from original_filename
     Cache-Control: no-store

GET /catalog/{cid}/file/{hosted_file_id}/v/{vid}   -- owner access
  -> catalog_permission `read` on {cid}, including transitive grants
  -> hosted_file.catalog_id == cid
  -> any clean version, including superseded ones
  -> 302 to a presigned URL
```

Load-bearing properties:

- **404, not 403**, for withdrawn or unscanned files; a 403 confirms the identifier
  names something.
- **302, not 301**, with `no-store`, so a cached redirect cannot survive a withdrawal.
- **A `pending` version is never served** on either route.
- **The public condition is two columns on one row**, with no join to
  `metadata_object` and no `state` lookup.
- **The owner route's `catalog_id == cid` check is not redundant** with the
  permission check. Without it, a user with `read` on any catalog could read any
  file by pairing their own `cid` with another file's id. It needs its own test.

### How a download is served

The bucket is private, and the app serves files without carrying their bytes by
issuing **presigned URLs**:

1. The browser requests `/f/{id}`. The proxy forwards it to Flask.
2. Flask runs the one-row check above, then signs a time-limited S3 URL **locally**
   with the bucket credentials from its service binding (an AWS SigV4 HMAC, with
   no call to S3).
3. Flask returns the `302`, a few hundred bytes.
4. The browser fetches the object **directly from S3**. S3 verifies the signature
   and streams the bytes. Neither Flask nor the proxy sees them.

"Private" means S3 rejects any request without a valid signature; the app is the
only thing that can mint one. A presigned URL is a **bearer token**: anyone holding
it can fetch the object until it expires, and it cannot be revoked. Hence:

- **The TTL is 5 minutes.** S3 checks it only when the request starts, so it need
  only cover redirect-to-transfer-start. The bookmark is always the app route; the
  presigned URL is never retained.
- **The bucket is not public-read**, even though a clean file is public by design,
  for three reasons. Withdrawal stays a one-column write (public-read makes the key
  the credential, so withdrawing means deleting or moving the object, which is a
  storage mutation with a window where the database and bucket disagree, and the
  same applies to SI-3(2) recall). The bookmark survives file replacement, which a
  key-based public URL cannot do without overwriting in place and forfeiting
  per-version `sha256` and scan state. And `Content-Disposition` and the counter
  need a request to observe.
- **The app's cost per download is one database read and one local HMAC.**

**Consequence for rate limiting.** Because bytes flow from S3 to the client,
`inventory-proxy` can rate-limit only requests to `/f/*`, which is **URL minting**.
It cannot limit download volume or bandwidth, and nothing in v2 can. What the limit
does protect is the app: each request is a database read and, for a served file, a
counter write on an unauthenticated route. Abuse that downloads a large file
repeatedly is bounded by the per-client mint rate, the 500 MB cap, and S3 itself,
not by the proxy. The resulting S3 egress cost is an accepted risk. `/f/*` must be added to the proxy's default-deny allowlist
(`proxy/nginx.conf:44,48`). Because the route appears in every bookmark and
exported `data.json`, it is an **interface contract**; changing its shape later is
a breaking change for outside consumers (CM-3).

### Two buckets, not one

| Instance | Contents | Properties |
|---|---|---|
| `inventory-s3-quarantine` | `quarantine/` | Unversioned, short lifecycle expiry, never presigned, never public |
| `inventory-s3-files` | `files/`, `exports/` | Private, serving content; versioning optional |

Untrusted inbound bytes and vetted content are different trust boundaries. Retention
can differ, a policy mistake on the serving instance cannot expose unscanned
uploads, and deleting an infected object stays a real deletion (in a versioned
bucket a plain `DELETE` writes a marker and keeps the bytes).

S3-native versioning on `inventory-s3-files` is not required: R1 and R3 come from
the stable key plus the row pointer, not from S3. Versioning would only retain
superseded bytes. **Neither versioning nor lifecycle expiry can be set through
Terraform or the cloud.gov broker's documented parameters**
([ADR 0009](0009-terraform-cloudgov-for-infrastructure.md)); whether a tenant can
set them with bucket credentials is unverified (see
[requirements for completion](#requirements-for-completion)). The quarantine
sweeper in [ADR 0006](0006-quarantine-then-scan-antivirus.md) is the primary
cleanup, so lifecycle expiry is a backstop.

### Download recording

Identity is **not** recorded. A public download is anonymous; IP and user agent
identify nobody useful and are PII flowing to a shared log archive. What an
incident needs when a file clean under signature set *N* turns malicious under
*N+1* is **magnitude and window**: fetched at all, roughly how often, between which
dates.

So the record is a **counter plus first and last seen on `hosted_file`**,
incremented when the redirect is issued. It is a row update, so
[ADR 0011](0011-audit-trail-mechanism.md)'s triggers capture it, and the increment
must not fail the download if it fails. It is **approximate and must be described
as such**: Flask issues a redirect and never observes the transfer, so a client may
not fetch, or may fetch repeatedly within one TTL. Authenticated owner access is
separately attributable through `catalog_permission` and the audit trail.

### How a Distribution references a hosted file

The editor's picker lists the catalog's `hosted_file` rows (scoped by `catalog_id`)
or accepts an external URL, and writes a `downloadURL` string. **Nothing else is
stored.** Export emits that string like any other, so an outside consumer cannot
tell hosted from agency-hosted. Consequences:

- A hosted file may be referenced by many `Distribution` objects, or by none.
- **Re-import does not touch hosted files.** It builds a new object set carrying
  `downloadURL` strings, and nothing links the files to the replaced objects.
  There is no rebinding, pre-swap orphan diff, or cross-catalog adoption check.
  This resolves ADR 0008's unspecified handling of `resource_file`.

### Positive Consequences

- Re-import is no longer a hazard to published files.
- One kind of `Distribution`: hosted and external are both a `downloadURL` string.
- A metadata edit cannot change public file availability.
- Files are reusable like any other object.
- `signature_version` and `sha256` are per immutable version, so retroactive
  re-scan is a query and SI-7 integrity is not overwritten in place.
- Withdrawal is auditable as itself, with an actor and timestamp.

### Negative Consequences

- **Unpublishing a dataset no longer withdraws its file.** The editor must offer
  to withdraw a file when its last referencing `Distribution` is unpublished or
  deleted, and say that the file stays public until then. Without that prompt this
  trades a surprising behaviour for a silent one.
- **A hosted file can be public with no metadata describing it.** A monthly
  report of unreferenced files, acted on by Data.gov staff, is the control. ADR 0005 carries the same
  ambiguity for reusable objects ("orphan is ill-defined for something deliberately
  unattached").
- **It is a more file-hosting-shaped product** than files-attached-to-distributions,
  which sits against ADR 0007's narrowing of Inventory to metadata authoring (CM-7).
- **Storage grows without bound** for files in use, and for 7 years for superseded
  and withdrawn ones. Nothing is purged automatically. `exports/` lifecycle
  ([`architecture.md` §5.2](../architecture.md#52-export-with-error-reporting))
  and ADR 0011's `activity` retention are decided separately.
- **Withdrawn is not erased.** `withdrawn_at` stops public serving; the object
  remains in S3 and reachable through the owner route. A user-facing **delete** is
  future work and must not conflict with retention: it should be a soft delete
  that keeps the bytes for the retention period, and it must be blocked, or at
  least warn loudly, when a `Distribution` references the file, because those
  files are kept indefinitely and a deleted one would break a published link.
- **Download volume is outside v2's control** (see
  [How a download is served](#how-a-download-is-served)).
- **Public download at MVP moves ADR 0006's malware-distribution risk to launch
  day.** That record's "bounded by authentication" framing no longer holds.
- **The bookmark is an opaque UUID.** A human-meaningful path would need a mutable
  name with uniqueness rules; out of scope.

### Compliance Consequences

- **AC-3** — public serving depends on the file's own state and nothing else. The
  SSP must say plainly that availability is not derived from catalog permissions or
  publication state. The owner route requires `read` plus the `catalog_id` check.
- **SI-3, SI-3(2)** — per-version `signature_version` makes recall a query;
  withdrawal is a column write with no cache or bucket-policy lag; the counter
  supplies approximate magnitude and window.
- **SI-7, SI-10** — `sha256` per immutable version; ADR 0006's size, MIME, and
  extension allowlist applies to every version, and the R2 check applies to hosted
  and external URLs alike.
- **SI-12** — superseded versions and withdrawn files are retained 7 years by
  default, and files in use indefinitely; confirm the 7 years with the records
  officer.
- **SC-7** — the reason this record is `yes-boundary`: an unauthenticated public
  flow in which clients fetch from S3 directly, and a second S3 instance. The SSP
  data-flow diagram and component inventory need updating and the ISSO should
  review.
- **CM-7** — a per-catalog upload area is broader than file-attached-to-distribution;
  justify it in the SSP by the feature list rather than leave it for an assessor to
  notice.
- **AU-2, AU-3** — new events (file created, version uploaded, scan result, current
  version advance, withdrawal, reinstatement) are all row mutations captured by ADR
  0011's triggers. Withdrawal must record its actor.
- **CM-3** — the `/f/*` route shape is a published interface (above).

## Design decisions made in review

These were open blockers and are now decided.

1. **`live` means public.** Any file uploaded to Inventory is there to be made
   available to the public. Confirmed by the product owner, 2026-10-05.
2. **Retention.** Files made available through a `Distribution` are stored
   **indefinitely**. Superseded versions and withdrawn files are retained for
   **7 years** by default. Nothing is purged automatically. This covers hosted
   files only; `exports/` lifecycle and ADR 0011's `activity` retention remain
   decided in their own records.
3. **Unreferenced files are reported, not acted on.** A monthly Data.gov report
   lists files referenced by no `Distribution`, as-is: it ignores how long a file
   has been in the system or when it was orphaned, and it recommends cleanup for
   Data.gov staff to act on. It replaces the daily
   `flask audit unreferenced-files` cadence. This is a planned ticket, not a
   decision to be made first.
4. **A clean scan auto-advances `current_version_id`**, for first uploads and
   replacements alike. A file may be attached to a draft `Distribution` before it
   is scanned; its `/f/` link returns 404 until the scan passes, then works. An
   `infected` or `error` file never serves, so the editor must show scan state
   next to the reference. R2 is unchanged: a `Distribution` cannot go `live` until
   its file serves.
5. **The presigned URL TTL is 5 minutes.** It only has to cover the time until the
   transfer starts; once started, a transfer is not cut off at expiry. A download
   interrupted for more than 5 minutes cannot resume on the same URL and is
   restarted from the bookmark.
6. **Rate limit on `/f/*`: about 100 requests per 5 minutes per client**, to keep
   the proxy and app healthy. S3 egress cost from abusive downloading is accepted
   as a risk. The limit is configuration, not code. The proxy sits behind the
   cloud.gov router, so it must key on the real client address
   (`X-Forwarded-For` through nginx `real_ip`), or every client will share one
   bucket.
7. **The two-instance S3 split is worth its cost** and is decided.
8. **Hide and delete are future work.** The file list will offer a **delete**
   (trash can) button and a **hide** button. Hide sets `withdrawn_at`, so the file
   is no longer public but stays in Inventory and can be reinstated. Delete is
   constrained by the retention decision above and is described under
   [Negative Consequences](#negative-consequences). The editor prompt to withdraw
   a file when its last referencing `Distribution` is unpublished or deleted
   remains a requirement of that work.

## Blockers before acceptance

None.

## Requirements for completion

Work that must finish before the feature ships, not before this record is
accepted. Track each as an issue.

- **Verify S3 capabilities in the development environment.** Confirm that bucket
  credentials issued by the cloud.gov broker can set lifecycle expiry on
  `inventory-s3-quarantine` and, optionally, versioning on `inventory-s3-files`,
  and that a 5-minute presigned URL expires as expected. The design does not
  depend on the first two: the quarantine sweeper is the primary cleanup, and
  versioning is optional.
- **Confirm the 7-year default with the records officer.** It can be raised in the
  same conversation as ADR 0008's NARA determination for v1 edit history.

## Links

- [ADR 0006](0006-quarantine-then-scan-antivirus.md) — scan lifecycle this record extends to multiple versions
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the object graph `hosted_file` deliberately sits outside
- [ADR 0008](0008-onboard-via-data-json-reimport.md) — re-import, which this design makes irrelevant to files
- [ADR 0004](0004-jit-user-provisioning-and-catalog-rbac.md) — permission levels and the owner route's authorization
- [ADR 0007](0007-retire-tabular-datastore-api.md) — the "public retrieval: MVP Yes" quote and the scope tension
- [ADR 0009](0009-terraform-cloudgov-for-infrastructure.md) — provisions the two S3 instances
- [ADR 0011](0011-audit-trail-mechanism.md) — captures every event here as a row mutation
- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — feature list
- [`docs/architecture.md`](../architecture.md) §4, §5.2, §5.3 — data model, presigned delivery, upload flow
- NIST SP 800-53 Rev 5.2 — AC-3, AU-2, AU-3, SI-3, SI-3(2), SI-7, SI-10, SI-12, SC-7, CM-3, CM-7, SA-8
- **Supersedes an earlier, never-committed draft** that tied a hosted file to a `Distribution`. Its driving requirements, R4 and R5, were withdrawn by the product owner.
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing.
- **Unverified claims.** The brokered-S3 presigned-URL expiry ceiling, tenant access to bucket versioning and lifecycle expiry, and the cost of a second S3 instance were not confirmed against a live environment. The first requirement for completion closes the parts this design depends on.
