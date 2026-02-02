# Quickstart: Enforce Reviewer Workload Limit

## Goal
Implement and validate UC-09 behavior: enforce a fixed per-conference limit of five assigned papers per reviewer, hide reviewers at limit, block invalid assignments, and log workload verification failures.

## Steps

1. Review `specs/001-uc-09/spec.md`, `UC-09.md`, and `UC-09-AT.md` for required behavior.
2. Implement model logic to calculate per-conference workload counts from assigned papers only.
3. Implement controller flow to:
   - filter reviewer selection to only those below the limit,
   - block assignments when workload verification fails,
   - log verification failures for admin review.
4. Update views to hide reviewers at the workload limit and display clear error messages when blocked.
5. Execute all scenarios in `UC-09-AT.md` and confirm outcomes.
