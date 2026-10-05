---
title: "Provision cloud.gov infrastructure with GSA-TTS/terraform-cloudgov modules"
status: "proposed"
date: "2026-09-21"
decision_makers: ["Data.gov engineering team"]
category: "Deployment and Infrastructure"
nist_controls: ["CM-2", "CM-3", "CM-6", "CM-8", "CM-9", "SC-7", "SC-12", "SC-28", "AC-3", "AC-5", "SA-8", "SR-3"]
impact_level: "moderate"
ato_relevance: "yes-boundary"
risk_treatment: "mitigate"
---

# Provision cloud.gov infrastructure with GSA-TTS/terraform-cloudgov modules

## Context and Problem Statement

Inventory v1 provisions its cloud.gov services with `create-cloudgov-services.sh`
— 40 lines of `cf service … || cf create-service`, backgrounded with `wait`, then
asserting every service reports `succeeded`. It covers four brokered services and
nothing else.

v2 has infrastructure the script never covered: a ClamAV scanner application
([ADR 0006](0006-quarantine-then-scan-antivirus.md)), an egress proxy with an
allowlist for Login.gov and ClamAV signature updates, container-network policies
between three apps, and per-space CI deployer accounts. Today those exist as
manual `cf` commands, a stale README section, and tribal knowledge. We must decide
how v2 provisions and records its infrastructure.

## Decision Drivers

- **The infrastructure that is *not* in the v1 script is the infrastructure most
  likely to be misconfigured.** Network policies
  (`cf add-network-policy inventory-proxy → inventory` on 61443, and in v2
  `inventory → inventory-scanner`), egress allowlists, and deployer service keys
  are all undocumented manual steps. This is the same class of problem the v2
  rewrite exists to fix.
- **Three environments must stay in sync.** v1 approximates this with an
  `if space = prod` branch inside a shell script.
- **A configuration baseline must be inspectable and diffable (CM-2, CM-6).**
  A shell script says how to create a thing once; it does not describe the
  intended state, and it cannot detect drift.
- **Accidental destruction of a production database is the failure mode that
  matters.** Any tooling that can create a database can delete one.
- **Secrets must not leak into a state file (SC-12, SC-28).** This constrains
  *what* Terraform may manage, and is the main risk this decision introduces.
- **Platform consistency cuts both ways.** Neither sibling application
  (`datagov-catalog`, `datagov-harvester`) uses Terraform; both use
  `cf push` via a composite GitHub action. Diverging needs justification.
- **Reusing audited modules beats writing resources (SR-3).**
  [`GSA-TTS/terraform-cloudgov`](https://github.com/GSA-TTS/terraform-cloudgov)
  is maintained within GSA, versioned (currently `v2.5.0`), has Terraform tests,
  and is already used by `rails-template`-based apps and the FAC.

## Considered Options

1. **`GSA-TTS/terraform-cloudgov` modules** on the official
   `cloudfoundry/cloudfoundry` provider, pinned by tag.
2. **Hand-written Terraform** using provider resources directly, following the
   pattern in [`GSA/datagov-ssb`](https://github.com/GSA/datagov-ssb).
3. **A shell script**, as v1 does, extended to cover network policies, the
   egress proxy, and the scanner app.
4. **`cf` CLI in the existing composite GitHub action**, matching
   `datagov-catalog` — no separate infrastructure tooling.

## Decision Outcome

Chosen option: **Option 1 — `GSA-TTS/terraform-cloudgov` modules**, pinned at a
released tag and run with **Terraform** (not OpenTofu — see
[Design decisions](#design-decisions-made-in-review)), because the modules already encapsulate three of v2's genuinely
novel components (ClamAV scanner, egress proxy), they are maintained
and tested inside GSA, and they are built on the **official provider** rather than
the deprecated v2 API.

```hcl
module "database" {
  source          = "github.com/GSA-TTS/terraform-cloudgov//database?ref=v2.5.0"
  space           = data.cloudfoundry_space.app_space
  name            = "inventory-db"
  rds_plan_name   = var.rds_plan_name          # small-psql | medium-psql-redundant
  prevent_destroy = (var.environment == "prod")
  tags            = ["postgres", "inventory"]
}

module "s3_quarantine" {
  source = "github.com/GSA-TTS/terraform-cloudgov//s3?ref=v2.5.0"
  name   = "inventory-s3-quarantine"             # unversioned; short lifecycle expiry
  ...
}

module "s3_files" {
  source = "github.com/GSA-TTS/terraform-cloudgov//s3?ref=v2.5.0"
  name   = "inventory-s3-files"                  # serving content; versioning optional
  ...
}

module "clamav" {
  source         = "github.com/GSA-TTS/terraform-cloudgov//clamav?ref=v2.5.0"
  name           = "inventory-scanner"
  max_file_size  = var.max_file_size           # see ADR 0006
  clamav_memory  = "3072M"                     # module default; see below
  proxy_server   = module.egress_proxy.domain
  proxy_port     = module.egress_proxy.port
  ...
}

module "egress_proxy" {
  source          = "github.com/GSA-TTS/terraform-cloudgov//egress_proxy?ref=v2.5.0"
  cf_egress_space = data.cloudfoundry_space.egress_space   # pre-existing; looked up, not created
  allowlist = ["secure.login.gov:443", "database.clamav.net:443"]   # plus the validator API host (ADR 0010)
  allowports = [443, 61443]                    # see New Relic note below
  ...
}
```

### Why not the `datagov-ssb` pattern

`datagov-ssb` is the team's existing Terraform, so it is the obvious template —
and it is the wrong one. Its `versions.tf` pins
`cloudfoundry-community/cloudfoundry ~> 0.54.0`, which targets the **Cloud
Foundry v2 API, deprecated 2025-06-06**. `terraform-cloudgov` modules `>= 2.0.0`
use `cloudfoundry/cloudfoundry >= 1.4.0`, the official provider, and document v2
deprecation compatibility explicitly.

Adopting `datagov-ssb`'s approach would mean starting v2 on the far side of a
deprecation. This should also prompt a separate look at `datagov-ssb` itself,
which is out of scope here but worth tracking.

### Scope boundary: Terraform owns topology, not secret values

**This is the constraint that makes the decision safe, and it is not negotiable.**
`cloudfoundry_service_key` attributes and user-provided-service credentials are
stored in Terraform state in plaintext. Managing `inventory-secrets` values in
Terraform would place the Login.gov OIDC private key and the Flask secret key
into an S3 object, converting a well-contained secrets story into a new
high-value target.

| Terraform manages | Stays outside Terraform |
|---|---|
| `aws-rds` instance and plan, per environment | `inventory-secrets` **credential values** (`cf cups` / `cf uups`) |
| **Two** `s3` instances — `inventory-s3-quarantine` and `inventory-s3-files` | Key rotation procedures |
| ClamAV scanner app (`clamav` module) | The cloud.gov spaces themselves, including the egress space — they pre-exist and are shared with other applications; Terraform looks them up |
| Egress proxy and its allowlist (`egress_proxy`), deployed into the existing egress space | Space roles and security groups |
| Container-network policies between apps | CI deployer service accounts **and** their keys |
| Existence of the `inventory-secrets` UPS, not its contents | The Terraform state bucket (bootstrap paradox) |

Terraform manages **this application's** infrastructure inside spaces it does not
own. It must never manage space-level resources, which other applications in the
same spaces depend on and which are managed by a shared, hand-run process that this
record deliberately leaves unchanged. Consequently the `cg_space` module is not used: it creates
a space and assigns roles, which needs org-level privilege and is out of scope.

### Two S3 instances, because they are two trust boundaries

[ADR 0012](0012-catalog-scoped-hosted-files.md) splits object storage into
`inventory-s3-quarantine` (holding `quarantine/`) and `inventory-s3-files`
(holding `files/` and `exports/`), rather than two prefixes in one instance.
Untrusted inbound bytes and vetted serving content should not share a policy
surface: retention can then differ, and a policy mistake on the serving instance
cannot expose unscanned uploads.

Two properties this record must carry:

- **The quarantine instance must be unversioned**, because ADR 0006's deletion of
  an infected object has to be a real deletion — in a versioned bucket an
  unqualified `DELETE` writes a delete marker and retains the bytes.
- **S3-native versioning on the serving instance is optional**, not required by
  ADR 0012's design. It buys retention of superseded bytes; it does not deliver
  the stable-URL or replacement-safety properties, which come from the database
  row pointer. **Whether a cloud.gov tenant can enable it is unverified** and
  remains an [ADR 0012](0012-catalog-scoped-hosted-files.md) blocker. What was
  verified here: the `s3` module exposes only `s3_plan_name` and `json_params`,
  and the cloud.gov broker documents one optional parameter
  (`object_ownership`). **Neither bucket versioning nor lifecycle expiry can be set
  through Terraform.** If a tenant can set them at all, it is with bucket
  credentials (e.g. `aws s3api`) outside Terraform, which also keeps those
  credentials out of state. The cloud.gov documentation lists no per-instance
  charge, only 5 TB of included storage per bucket.

**Application deployment stays `cf push --strategy rolling`** via a composite
GitHub action, matching `datagov-catalog`. The modules include `application`,
`drupal`, and `spiffworkflow` deployment modules; v2 does **not** use them.
Terraform is for infrastructure lifecycle; app deploys are frequent, rolling, and
already well served.

### Three facts the modules supply that this design had wrong or missing

Reading the module source corrected the architecture document, which is itself an
argument for adopting them:

1. **The scanner needs ~3 GB, not ~2 GB.** `clamav/variables.tf` defaults
   `clamav_memory = "3072M"` with `disk_quota = 2048M` and
   `health_check_invocation_timeout = 600`. ADR 0006 and `architecture.md` §2 said
   ~2 GB — a guess, now corrected against a module used in production.
2. **New Relic needs `allowports = [443, 61443]` through the egress proxy.**
   Documented in the module README as discovered on the FAC, which uses the same
   Python agent and the same FedRAMP `gov-collector.newrelic.com` endpoint v2 will
   use. Without this, telemetry silently fails.
3. **The ClamAV app gets an `apps.internal` route**, no public route — consistent
   with ADR 0006's requirement that the scanner is not publicly reachable, and now
   enforced by the module rather than by our own care.

### Positive Consequences

- Network policies, egress allowlists, and the scanner app
  become version-controlled, reviewable configuration instead of undocumented
  manual steps. This is the primary benefit.
- `prevent_destroy = (var.environment == "prod")` gives a hard guard against
  accidental production database destruction, using the module's documented
  pattern.
- Environment differences become a `tfvars` file per environment rather than an
  `if` branch in a shell script.
- `terraform plan` on pull requests surfaces intended infrastructure changes for
  review before they happen (CM-3), and detects drift (CM-6).
- The component inventory required for the ATO (CM-8) can be derived from
  configuration rather than assembled by hand.
- Module upgrades arrive as reviewed version bumps with an `UPGRADING.md`, rather
  than as ad-hoc `cf` command changes.

### Negative Consequences

- **A second toolchain in the app repository** — Terraform, a state
  backend, provider lockfile, and CI wiring — for a team whose other two
  application repos have none.
- **Bootstrap paradox.** The S3 bucket holding Terraform state cannot itself be
  managed by that state. It must be created out-of-band and documented.
- **Divergence from `datagov-catalog` and `datagov-harvester`**, weakening the
  platform-consistency driver used in ADRs 0001 and 0002. Justified by v2 having
  materially more infrastructure (scanner, egress proxy, three-app network
  policies), but it is a real cost and should be revisited if that turns out not
  to be true.
- **State becomes sensitive even under the boundary above.** Service instance
  GUIDs and binding metadata are not secrets, but the state file still warrants
  encryption at rest, access restriction, and versioning.
- **Drift detection is worthless if nobody reads the plan.** A `terraform plan`
  posted on a PR and ignored buys nothing. This requires a review habit, not just
  a workflow file.
- **Module dependency is a supply-chain dependency (SR-3).** Pinning by tag
  (`?ref=v2.5.0`) rather than branch is mandatory, and upgrades need review.
- **`prevent_destroy` on an existing database requires a manual state migration**
  per the module's `UPGRADING.md`. Cheaper to enable at creation — another reason
  to adopt this before the first production deploy, not after.

### Compliance Consequences

- **CM-2 (Baseline Configuration)** — *strengthened.* Infrastructure becomes a
  declarative, version-controlled baseline rather than an imperative script.
- **CM-3 (Configuration Change Control)** — infrastructure changes flow through
  pull request with a visible plan, under the same protected-branch review as
  code (ADR 0001).
- **CM-6 (Configuration Settings)** — drift between intended and actual state
  becomes detectable.
- **CM-8 (Component Inventory)** — derivable from configuration; useful ATO
  evidence.
- **CM-9 (Configuration Management Plan)** — the Terraform layout, state backend,
  and apply workflow must be documented before first production use.
- **SC-7 (Boundary Protection)** — **the reason this record is
  `yes-boundary`.** Egress allowlist and container-network policies are boundary
  controls, and moving them into Terraform makes them auditable artifacts. The
  allowlist (`secure.login.gov:443`, `database.clamav.net:443`, and the validator API host) becomes reviewable
  configuration rather than a remembered command.
- **SC-12, SC-28 (Key Management, Protection at Rest)** — addressed by the scope
  boundary: no secret values in state. The state bucket must be encrypted,
  versioned, and access-restricted regardless.
- **AC-3, AC-5 (Access Enforcement, Separation of Duties)** — space roles and
  deployer service accounts are created by hand and are **not** in Terraform
  state, so the CM-9 plan must record who creates them, their scope, their
  rotation, and which credential runs `apply`. Scope that credential to what the
  plan requires; it must not be reusable for ad-hoc production changes.
- **SR-3 (Supply Chain)** — modules pinned by tag; `.terraform.lock.hcl`
  committed; module and provider upgrades reviewed.

### Design decisions made in review

These were open blockers and are now decided.

1. **The module set fits a Flask app.** Each module used (`database`, `s3`,
   `clamav`, `egress_proxy`) was read against its `variables.tf` and source; none
   is coupled to Rails (the README is the only file that mentions it). The one
   gap is bucket versioning and lifecycle expiry on `s3`, which no module can
   provide (see [above](#two-s3-instances-because-they-are-two-trust-boundaries));
   it is tracked as an ADR 0012 blocker, not here.
2. **Terraform, not OpenTofu.** Terraform is pinned in CI, and `.terraform.lock.hcl`
   is committed.
3. **Deployer accounts and keys are hand-managed, and the shared process is not
   changing now.** Terraform manages this application only, inside spaces that
   already exist with other applications on them. Spaces, space roles, security
   groups, deployer service accounts and their keys stay outside Terraform and
   state. Every other Data.gov application relies on the existing hand-managed
   process, so v2 follows it rather than changing it unilaterally. If Terraform
   management goes well here, a **future epic** will bring Data.gov's space-level
   resources under Terraform — the application and egress spaces, space roles,
   deployer accounts, and log shipping. That epic is out of scope for this record
   and for v2's MVP.
4. **Logging scope.** v2 adopts the existing shared arrangement: it binds
   `logstack-space-drain` (as `datagov-catalog` does, on both the app and the
   proxy) and does **not** deploy the module's `logshipper`, which would stand up
   a redundant drain app inside inventory's own spaces. The shared
   `logstack-shipper` lives in the `management` space — inside the same
   authorization boundary, outside inventory's spaces, and not provisioned by this
   repository's Terraform. Log retention is inherited from it. See
   [`architecture.md` §6](../architecture.md#logging-uses-shared-infrastructure-this-repository-does-not-own).

### Blockers before acceptance

None. Remaining open S3 questions belong to
[ADR 0012](0012-catalog-scoped-hosted-files.md).

### Requirements for completion

Work that must finish before the first `terraform apply`, not before this record
is accepted. Track each as an issue.

- **Provision and document the state backend** — a dedicated S3 bucket with
  restricted access, created out-of-band (bootstrap paradox), and recorded in the
  CM-9 plan. The bucket must be encrypted at rest. Two properties are unverified
  on the cloud.gov broker and must be confirmed during this task: **versioning**
  (the same tenant-access question as the ADR 0012 blocker) and **state locking**
  (the S3 backend's native lockfile needs Terraform 1.10 or later and conditional
  writes; a brokered bucket has no DynamoDB table to fall back on). If either
  is unavailable, record the compensating control (for example, serialized
  `apply` through a single CI job).
- **Document the hand-managed prerequisites** — the spaces, space roles, security
  groups (including the egress space's `public_networks_egress`), and deployer
  accounts and keys that Terraform assumes, with owner and rotation (CM-9).

## Links

- [GSA-TTS/terraform-cloudgov](https://github.com/GSA-TTS/terraform-cloudgov) — module source, `v2.5.0`
- [terraform-cloudgov UPGRADING.md](https://github.com/GSA-TTS/terraform-cloudgov/blob/main/UPGRADING.md) — `prevent_destroy` migration, clamav and egress-proxy network policy examples
- [cloud.gov v2 API deprecation](https://cloud.gov/2025/01/07/v2api-deprecation/) — why the `datagov-ssb` provider pin is not the model to follow
- [GSA/datagov-ssb](https://github.com/GSA/datagov-ssb) — the team's existing Terraform, on the deprecated community provider
- [ADR 0001](0001-repository-topology-for-inventory-v2.md) — the repository this Terraform lives in
- [ADR 0006](0006-quarantine-then-scan-antivirus.md) — the scanner this provisions; amended by this record's 3 GB and `max_file_size` findings
- [ADR 0012](0012-catalog-scoped-hosted-files.md) — requires the two S3 service instances provisioned above, and leaves serving-instance versioning as an open question
- [`docs/architecture.md`](../architecture.md) §6 — deployment
- NIST SP 800-53 Rev 5.2 — CM-2, CM-3, CM-6, CM-8, CM-9, SC-7, SC-12, SC-28, AC-3, AC-5, SA-8, SR-3
- **v1 code citations** in this record refer to [`GSA/inventory-app@9fc0003a`](https://github.com/GSA/inventory-app/tree/9fc0003a7f2aeac92bab852c7ad7e5418925de5c) (2026-09-04), the v1 HEAD at the time of writing. Line numbers are pinned to that commit.
