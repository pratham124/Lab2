# Quickstart: Access Assigned Papers for Review

## Purpose
Verify the view-only assigned papers flow for reviewers.

## Prerequisites
- CMS is running in a development environment.
- Reviewer account exists with at least one assigned paper.
- Reviewer account exists with no assigned papers.
- At least one paper is assigned to another reviewer (for unauthorized access check).

## Steps
1. Log in as a reviewer with assigned papers.
2. Open the assigned papers page and verify titles are listed.
3. Open an assigned paper and verify content displays (view-only).
4. Attempt to access an unassigned paper and verify “Access denied” while staying within reviewer pages.
5. Attempt a download (if any direct link exists) and verify no download is available and view-only access remains.
6. Log in as a reviewer with no assignments and verify the empty-state message.

## Expected Results
- Assigned papers list shows titles only.
- Assigned paper content is view-only with no download option.
- Unauthorized access is denied with a clear message.
- Errors are shown for retrieval failures or missing manuscripts.

## Success Criteria Verification

- **SC-003 (Open assigned paper on first attempt)**: Verify at least 9 of 10 reviewers can open at least one assigned paper from the list on their first attempt without assistance.
- **SC-004 (Empty-state reliability)**: For reviewers with zero assignments, verify the empty-state message appears in every check (target 100% occurrence).
