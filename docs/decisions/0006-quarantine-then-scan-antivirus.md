---
title: "Scan uploaded data files with a quarantine-then-scan antivirus service and cap hosted files at 500 MB"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Data Handling"
nist_controls: ["SI-3", "SI-3(1)", "SI-3(2)", "SI-7", "SI-10", "SC-7", "AC-3", "AU-2", "AU-3", "IR-4", "IR-6"]
impact_level: "moderate"
ato_relevance: "yes-boundary"
risk_treatment: "mitigate"
---

# Scan uploaded data files with a quarantine-then-scan antivirus service and cap hosted files at 500 MB

## Context and Problem Statement

Inventory hosts agency data files and serves them for public download. Inventory
v1 performs **no malware scanning** on uploads: `ckanext-s3filestore` writes
directly to S3 and resources are publicly retrievable. cloud.gov brokers no
antivirus service, so scanning must be provided by the application. v2 must
decide whether and how to scan, and at what maximum file size, given that v1's
proxy accepts bodies up to 1500 MB (`proxy/nginx.conf:31`).

This is a **boundary-affecting** decision: it adds a component to the
authorization boundary and changes the data flow for uploaded content.

## Decision Drivers

- **A public-facing application that hosts and redistributes user-uploaded files
  must not be a malware distribution channel (SI-3).**
- **Files of the size v1 permits cannot be scanned inside an HTTP request.**
  A 1500 MB upload will not scan within any reasonable request timeout (v1's
  gunicorn timeout is 120 s).
- **Redis and RQ are being removed** (v1's only async mechanism, co-located with
  gunicorn at `config/server_start.sh:9`). Scanning must be asynchronous
  *without* reintroducing a broker.
- **ClamAV has real engine limits.** `clamd` defaults to `MaxFileSize` 100 MB
  and `MaxScanSize` 400 MB. Raising them costs memory and ClamAV does not scan
  very large archives well regardless — so "scan everything up to 1500 MB" is not
  an available option, only an aspiration.
- **Nothing unscanned may be publicly reachable (AC-3).**
- **Detections are security incidents requiring reporting (IR-4, IR-6).**
- **Signature freshness requires outbound network access (SI-3(2))**, which
  interacts with the cloud.gov egress proxy.

## Considered Options

1. **Quarantine-then-scan with a dedicated scanner app and a database-backed
   sweeper.** Uploads stream to an S3 `quarantine` bucket; a separate
   `inventory-scanner` app (clamd + freshclam + a thin Flask wrapper) scans and
   copies clean objects to the serving location; a per-file-version `scan_state`
   column tracks progress; a sweeper thread re-dispatches stalled work.
2. **Synchronous scan during upload.** Scan in the request path before
   acknowledging the upload.
3. **No scanning**, matching v1 behavior; rely on the authenticated-uploader
   trust model and document the accepted risk.
4. **Third-party scanning API** (commercial malware-scanning SaaS).
5. **S3 event-driven scanning** via AWS Lambda triggered on object creation.

## Decision Outcome

Chosen option: **Option 1 — quarantine-then-scan with a dedicated scanner app
and a database-backed sweeper**, with a **500 MB** maximum hosted file size.

Rejections: Option 2 cannot work at these file sizes. Option 3 is not
defensible for a system whose roadmap includes public upload. Option 4 sends
government data to an external service, requiring its own ATO consideration and
egress allowance — a larger boundary change than running the scanner in-boundary.
Option 5 is the better-engineered pattern in general, but cloud.gov does not
expose S3 event notifications or Lambda to tenants through the brokered service,
so it is unavailable.

### Flow

Shown as amended by [ADR 0012](0012-catalog-scoped-hosted-files.md), which moves
scan state onto a per-version row and splits the bucket into two service
instances; see [the amendment below](#amendment-scan-state-is-per-file-version-and-promotion-crosses-a-service-boundary)
for what this replaces and why.

```
upload → size/MIME/extension allowlist (every version, not only the first)
       → stream to inventory-s3-quarantine quarantine/{uuid}
       → INSERT hosted_file_version(scan_state='pending', sha256, size_bytes,
                                    content_type, original_filename)
       → POST /scan to inventory-scanner (fire-and-forget, 2 s timeout)
       → 202 to user; HTMX polls GET /file/{version_id}/status

scanner: stream object → clamd INSTREAM
  clean    → copy to inventory-s3-files files/{hosted_file_id}/{version_id},
             delete the quarantine object, scan_state='clean',
             record scanned_at + signature_version,
             and advance hosted_file.current_version_id in the same transaction
  infected → delete object, scan_state='infected', record threat_name,
             notify org admin + Data.gov team (SI-3 audit + IR-6 event);
             current_version_id unchanged

sweeper (CF_INSTANCE_INDEX == 0 only):
  pending > 5 min  → re-dispatch
  pending > 60 min → scan_state='error', alert
```

Three properties are load-bearing:

- **Public download requires a `clean` version.** Presigned URLs are minted only
  for one. Neither S3 instance has a public-read policy and `quarantine/` is never
  presigned. "Unscanned" and "unreachable" are the same condition — and under
  ADR 0012 that holds for **every** version, including a replacement for an
  already-public file, because `current_version_id` advances only on a clean scan.
- **The sweeper is why this works without a broker.** Dropped `POST /scan`
  calls, scanner restarts, and crashed scans all self-heal. It reuses the
  `CF_INSTANCE_INDEX == 0` guard that `datagov-harvester`'s `LoadManager`
  already uses, so it is a familiar pattern on-call.
- **Signature version is recorded per version**, so a retroactive re-scan after a
  signature update is a query rather than a guess (SI-3(2)).

### The 500 MB cap is a policy change, and it is a regression

v1 permits 1500 MB. Lowering to 500 MB means some currently-uploadable file is
no longer uploadable. The rationale is that a cap Inventory can actually *scan*
is worth more than a cap it can only *accept*, and files above the cap should be
referenced by agency-hosted URL in the `Distribution` rather than uploaded.
`clamd` must be configured with `MaxFileSize`/`MaxScanSize` at or above 500 MB,
and the scanner sized accordingly (~3 GB memory — see the amendment below).

**Before implementation, query existing S3 objects for the actual size
distribution.** If a meaningful number of hosted files exceed 500 MB, this cap
needs revisiting — the number should be chosen from data, not from ClamAV's
defaults. Recorded as a verification task, not an assumption.

### Amendment: the scanner app comes from the terraform-cloudgov clamav module

[ADR 0009](0009-terraform-cloudgov-for-infrastructure.md) adopts
[`GSA-TTS/terraform-cloudgov`](https://github.com/GSA-TTS/terraform-cloudgov),
which includes a `clamav` module that provisions exactly the scanner application
this record describes. Three corrections to the design above follow from reading
that module's source, and they supersede the corresponding statements in this
record:

- **Memory is ~3 GB, not ~2 GB.** `clamav/variables.tf` defaults
  `clamav_memory = "3072M"`, with `disk_quota = 2048M` and
  `health_check_invocation_timeout = 600`. The ~2 GB figure elsewhere in this
  record was an estimate; 3 GB comes from a module in production use. The space
  memory quota must account for it.
- **`max_file_size` is a required module input, and its interaction with the
  500 MB cap needs checking.** The module README's example uses
  `max_file_size = "30M"` — an order of magnitude below the cap proposed here.
  That is an example rather than a limit, but it is a signal: the blocker above
  (measure the real S3 size distribution) should also confirm that a 500 MB scan
  completes within the module's health-check and request timeouts. **If it does
  not, the cap must come down.** Scannability, not policy preference, sets the
  ceiling.
- **The scanner gets an `apps.internal` route only.** The module wires this
  itself, so this record's requirement that the scanner have no public route is
  enforced by configuration rather than by our own care.

**What the module does not provide is the part that makes this design work.** It
deploys a ClamAV-over-HTTP scanning service; it does not implement the
quarantine/promote lifecycle, the per-version `scan_state`, the presigned-download
gate, or — most importantly — the **sweeper** that recovers dropped dispatches and
crashed scans. Those remain application code in `datagov-inventory`, and the
sweeper in particular is what allows asynchronous scanning with no message broker.

Outbound access for signature updates is also the module's concern: it accepts
`proxy_server`/`proxy_port`/`proxy_username`/`proxy_password` explicitly for
reaching `database.clamav.net`, which is provisioned by the `egress_proxy` module
rather than configured by hand.

### Positive Consequences

- Closes a genuine gap: v2 will not redistribute known malware, and under
  [ADR 0012](0012-catalog-scoped-hosted-files.md) that is a **launch** requirement,
  since public download is MVP scope.
- Scanning scales independently of web traffic; a scanner crash or restart
  cannot take down uploads or the site, and stalled work is recovered.
- No broker: no Redis, no RQ, no queue to operate or monitor.
- The scanner is isolated — a separate app with its own memory limit, so
  clamd's footprint cannot starve the web app (v1's co-located RQ worker could).
- SHA-256 on ingest also supports integrity verification (SI-7) independent of
  scanning, and under ADR 0012 it is recorded **per immutable version** rather
  than updated in place.
- Records the signature version **per version**, enabling targeted re-scan
  campaigns as a query rather than a guess.

### Negative Consequences

- **A new app to build, deploy, size, and monitor**, plus ClamAV operational
  knowledge (signature database freshness, memory behavior, `clamd` tuning) the
  team does not currently carry.
- **~3 GB memory** for the scanner (the `clamav` module default; see the
  amendment above). Real cost against the space memory quota.
- **Upload is no longer immediately complete from the user's perspective.** A
  polling status UI is required, and "your file is scanning" is a new state
  agency users must understand.
- **ClamAV catches known signatures only.** It is not a guarantee, and the ATO
  documentation should not overstate it. It does not detect malicious *content*
  in a structurally valid CSV.
- **The 500 MB cap is a user-visible capability reduction** (above).
- **freshclam requires outbound access to `database.clamav.net`** through the
  egress proxy. Without it, signatures silently staleness-decay — the most
  likely quiet failure of this design. Requires an explicit alert on signature
  age, not just on scan failures.
- A pathological file can consume scanner CPU; `clamd` timeouts plus the
  60-minute sweeper bound the damage.
- **The scanner now writes across two S3 service instances** rather than two
  prefixes in one, so it holds two bindings and a promotion is a cross-instance
  copy. A small addition to the operational surface, and the reason the split's
  availability and cost is an ADR 0012 blocker.

### Compliance Consequences

- **SI-3 (Malicious Code Protection)** — *newly addressed.* Previously absent.
  SSP must state scanner placement, update cadence, and the action on detection.
- **SI-3(1) (Central Management)** — single scanner service per environment.
- **SI-3(2) (Automatic Updates)** — freshclam on a schedule; **signature age
  must be monitored and alerted**, since a stale-but-running scanner is the
  dangerous failure mode. Retroactive recall is a query over
  `hosted_file_version.signature_version`, and withdrawal of a recalled file is a
  single column write with no cache or bucket-policy lag
  ([ADR 0012](0012-catalog-scoped-hosted-files.md)).
- **SI-7 (Software, Firmware, and Information Integrity)** — SHA-256 recorded at
  ingest on an **immutable version row**, never updated in place; integrity
  verifiable independently of scan state.
- **SI-10 (Input Validation)** — size, MIME, and extension allowlist applied
  *before* the object is written, not after, and on **every** version rather than
  only a file's first upload.
- **AC-3 (Access Enforcement)** — download requires a `clean` version;
  quarantine objects are never presigned and neither S3 instance has a
  public-read policy. Note the companion statement in ADR 0012: public
  availability is gated on the **file's own** state, not on any permission or
  metadata publication state.
- **SC-7 (Boundary Protection)** — the scanner has no public route (internal
  route only) and one new egress allowlist entry
  (`database.clamav.net`). **This is the boundary change that makes this ADR
  `yes-boundary`:** a new in-boundary component with a new outbound flow.
  ADR 0012 adds the other half of the boundary story — an unauthenticated public
  download flow and a second S3 service instance.
- **AU-2, AU-3** — audit events required: upload accepted, scan started, scan
  result (with signature version), promotion to clean, deletion on detection. All
  are row mutations on `hosted_file` / `hosted_file_version`, so
  [ADR 0011](0011-audit-trail-mechanism.md)'s triggers capture them with
  `actor_kind = 'system'`.
- **IR-4, IR-6 (Incident Handling and Reporting)** — a detection is a security
  incident. The notification path (org admin + Data.gov team) must be defined in
  the runbook, and the uploading user's identity is known via Login.gov auth.
  Per AGENTS.md §9.2, detections are **not** filed as public issues.
- **Evidence for the ATO package** — a test demonstrating that a known-malicious
  test file (EICAR) is detected, deleted, and never presigned. This should be an
  automated test, not a one-time manual demonstration.

## Links

- [Inventory Beta Re-design](https://github.com/GSA/data.gov/wiki/Inventory-Beta-Re%E2%80%90design) — data file storage and public retrieval feature
- [ClamAV documentation](https://docs.clamav.net/) — `clamd` configuration and limits
- [EICAR test file](https://www.eicar.org/download-anti-malware-testfile/) — detection verification
- [ADR 0005](0005-object-graph-data-model-for-dcat-us-3.md) — the object graph, which hosted files deliberately sit outside
- [ADR 0007](0007-retire-tabular-datastore-api.md) — retires the DataStore; uploaded files remain downloadable
- [ADR 0009](0009-terraform-cloudgov-for-infrastructure.md) — provisions the scanner app via the `clamav` module; source of the 3 GB and `max_file_size` findings
- [ADR 0012](0012-catalog-scoped-hosted-files.md) — moves scan state to a per-version row, splits the bucket into two service instances, retires the `clean/` prefix, and makes public download MVP scope
- `proxy/nginx.conf:31` — current 1500 MB body limit
- `.profile:117-122`, `config/ckan.ini:215-221` — current S3 upload configuration with no scanning
- NIST SP 800-53 Rev 5.2 — SI-3, SI-7, SI-10, SC-7, AC-3, AU-2, AU-3, IR-4, IR-6
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
