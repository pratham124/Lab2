# Quickstart: Generate Conference Schedule

## Purpose
Provide a minimal checklist to validate UC-16 behavior during implementation.

## References
- Spec: /root/493-lab/Lab2/specs/001-generate-conference-schedule/spec.md
- Use Case: /root/493-lab/Lab2/UC-16.md
- Acceptance Tests: /root/493-lab/Lab2/UC-16-AT.md

## Verification Steps
1. Ensure scheduling parameters are defined for a conference.
2. Log in as an administrator and trigger schedule generation.
3. Confirm the schedule is generated, stored, and displayed.
4. Re-run acceptance tests in `UC-16-AT.md` to validate failure paths.

## Performance Validation (SC-001, SC-004)

1. Measure schedule generation time for a representative dataset and record elapsed duration.
2. Verify generation completes within 2 minutes for normal acceptance-test scale.
3. Measure schedule retrieval (`GET /admin/conferences/{conferenceId}/schedule`) and record page/API load time.
4. Verify retrieval completes within 5 seconds.
5. Capture measurement date, dataset size, and observed timings in implementation notes.

## Quickstart Validation Status

- Steps validated against current implementation on 2026-02-25.
