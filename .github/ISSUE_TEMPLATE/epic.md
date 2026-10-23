---
name: EPIC
about: Parent ticket that tracks a larger body of work made up of user stories, spikes, and ADR blockers
title: '[EPIC] '
labels: 'Epic'
assignees: ''

---

## Goal

In order to [outcome for users / the platform], the team wants [capability delivered by this EPIC].

[Two or three sentences. Describe the outcome, not the implementation.]

## Success Criteria

[Demo-able outcomes that mean this EPIC is done. Prefer [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development#Behavioral_specifications). The detailed ACs live on the child tickets; these are the EPIC-level ones.]

- [ ] GIVEN [a contextual precondition] \
  WHEN [a triggering event] happens \
  THEN [a verifiable outcome]

## Scope

**In scope**

- [capability or area]

**Out of scope / non-goals**

- [thing a reader might assume is included but is not, with the ADR or issue that says so where one exists]

## Stages

[Mark each stage that applies. Stages can be skipped when the work is already clearly defined and low complexity; say so rather than leaving a stage blank. List the child ticket under each stage once it exists, and set the same relationships using GitHub's sub-issue feature so they show up in the sidebar.]

- [ ] **Discover** — [research, spikes, ADR blockers] #[issue] / not needed: [why]
- [ ] **Define** — [stories, acceptance criteria, API contracts] #[issue] / not needed: [why]
- [ ] **Design** — [data model, UI, technical design] #[issue] / not needed: [why]
- [ ] **Develop** — [implementation stories] #[issue]
- [ ] **Implement** (optional) — [rollout, onboarding, communications, manual steps CI/CD does not cover] #[issue] / not needed: [why]

## Dependencies

- **Blocked by:** #[EPIC or issue] — [what this EPIC needs from it]
- **Blocks:** #[EPIC or issue] — [what it unlocks]
- **Gating ADR(s):** [ADR NNNN must be `accepted` before build starts / "none"]
- **ADR blockers:** [#issue for each open blocker in [docs/decisions/README.md](https://github.com/GSA/datagov-inventory/blob/main/docs/decisions/README.md#blockers-before-any-record-is-accepted) that affects this EPIC / "none"]

## ATO / SSP Impact

[State whether this EPIC touches the authorization boundary: a new component, a new data flow, a new egress destination, an account-management change, or an audit-trail change. The ADRs marked `yes-boundary` (0006, 0007, 0009, 0010, 0012) need SSP data-flow and component-inventory updates and ISSO review. Name the child ticket that does that update. "None" is OK, just be explicit here!]

- **Boundary impact:** [none / describe]
- **SSP update ticket:** #[issue] / not needed

## Security Considerations ([required](https://nvd.nist.gov/800-53/Rev4/control/CM-4))

[comment]: # "Our SSP says 'The Data.gov team ensures security implications are considered as part of the agile requirements refinement process by including a section in the issue template used as a basis for new work.' so please don't remove this section without care."
[EPIC-level security risks and the NIST controls involved. Each child ticket still carries its own Security Considerations section. "None" is OK, just be explicit here!]

## Background

[Links to the relevant [architecture.md](https://github.com/GSA/datagov-inventory/blob/main/docs/architecture.md) sections and ADR(s), plus any evidence, prior conversations, or upstream issues.]

- [architecture.md §N — title](https://github.com/GSA/datagov-inventory/blob/main/docs/architecture.md)
- [ADR NNNN — title](https://github.com/GSA/datagov-inventory/blob/main/docs/decisions/)
