# UC-12 Manual Acceptance Results

Date: 2026-02-25  
Feature: Access Assigned Papers for Review

## Coverage Focus

- SC-002: Access to unassigned papers is blocked.
- SC-003: Reviewers can open assigned papers on first attempt.
- SC-004: Empty-state message appears when no assignments exist.

## Findings

- SC-002: PASS (unassigned paper access returns 403 with "Access denied" and no manuscript content).
- SC-003: PASS (assigned paper opens from list and renders view-only manuscript content).
- SC-004: PASS (reviewer with zero assignments sees clear empty-state message).

## Notes

- Download remains unavailable for assigned papers (view-only behavior retained).
- Retrieval and manuscript-unavailable states return safe messages with next-step text and a back link to `/reviewer/assignments`.
