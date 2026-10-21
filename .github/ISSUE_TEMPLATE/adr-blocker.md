---
name: ADR blocker
about: A verification task or decision that must clear before an ADR is accepted (see docs/decisions/README.md)
title: ''
labels: ''
assignees: ''

---

## Blocker

- **ADR:** [NNNN — title, link to `docs/decisions/NNNN-*.md`]
- **Type:** [Product / Design / Data / Compliance / Organizational / External]
- **Decision owner(s):** [named people or role who decide — not "the team"]

[Copy the blocker text from the "Blockers before any record is accepted" table in [docs/decisions/README.md](https://github.com/GSA/datagov-inventory/blob/main/docs/decisions/README.md#blockers-before-any-record-is-accepted).]

## Question to answer

[Restate as a single question with a clear done-state, e.g. "What is the p99 file size in the existing S3 buckets, and is 500 MB the right cap?"]

## Acceptance Criteria

- [ ] GIVEN [the evidence needed] \
  WHEN [the owner(s) review it] \
  THEN [the answer is recorded on this issue with its evidence]
- [ ] The ADR is updated to reflect the answer (a PR editing the ADR and the blocker table in `docs/decisions/README.md`)
- [ ] If this was the ADR's last open blocker, a **separate** PR flips its status to `accepted` and names the signing-off decision makers

## Dependencies

- **Blocked by:** #[issue] / none
- **Gates (cannot start build until this closes):** #[issue], #[issue]

## Background

[Links to evidence, prior conversations, upstream issues.]

## Security Considerations

[Anything sensitive about the evidence, e.g. production logs or agency data. Keep sensitive details out of the public issue. "None" is OK, just be explicit here!]

## Outcome

[Filled in when closed: the decision, the evidence, and which downstream tickets changed as a result.]
