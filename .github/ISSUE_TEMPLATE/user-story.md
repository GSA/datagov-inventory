---
name: User story
about: A change a user (data manager, public user, Data.gov staff) can see or do
title: ''
labels: ''
assignees: ''

---

## User Story

In order to [goal], [stakeholder] wants [change].

## Acceptance Criteria

[ACs should be clearly demoable/verifiable whenever possible. Try specifying them using [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development#Behavioral_specifications).]

- [ ] GIVEN [a contextual precondition] \
  [AND optionally another precondition] \
  WHEN [a triggering event] happens \
  THEN [a verifiable outcome] \
  [AND optionally another verifiable outcome]

## Dependencies

[Work that must be finished before this can start or be accepted. "None" is OK, but be explicit. Set the same relationships using GitHub's "Blocked by" / "Blocks" issue relationships so they show up in the issue sidebar.]

- **Blocked by:** #[issue] — [what this ticket needs from it, e.g. "needs the `catalog` table"]
- **Blocks:** #[issue]
- **Gating ADR(s):** [ADR NNNN must be `accepted` before build starts / "none"]

## Background

[Any helpful contextual notes or links to artifacts/evidence, if needed. Link the relevant [architecture.md](https://github.com/GSA/datagov-inventory/blob/main/docs/architecture.md) section and ADR(s).]

## Security Considerations ([required](https://nvd.nist.gov/800-53/Rev4/control/CM-4))

[comment]: # "Our SSP says 'The Data.gov team ensures security implications are considered as part of the agile requirements refinement process by including a section in the issue template used as a basis for new work.' so please don't remove this section without care."
[Any security concerns that might be implicated in the change. "None" is OK, just be explicit here!]

- **NIST controls touched:** [e.g. AC-3, AU-2 / "none"]
- **Changes the authorization boundary or data flows (SSP / ISSO review)?** [yes / no]

## Sketch

[Notes or a checklist reflecting our understanding of the selected approach]

## Definition of Done

- [ ] Acceptance criteria demonstrated
- [ ] Automated tests cover each acceptance criterion and run in CI
- [ ] CI is green (lint, tests, dependency/security scans)
- [ ] Accessibility checked (Section 508 / WCAG 2.1 AA) — *UI changes only*
- [ ] Audit events and structured logging added where the change reads or writes data — *if applicable*
- [ ] Docs updated (`docs/`, ADR status or index if affected)
- [ ] Dependent tickets listed above are unblocked or notified
