# Quickstart — Assign Reviewers to Papers

## Purpose

This quickstart describes how to manually validate UC-08 reviewer assignment behavior using the acceptance tests in UC-08-AT.

## Steps

1. Open the CMS as an editor and navigate to submitted papers.
2. Select a paper that requires reviewer assignment.
3. Use the acceptance tests in `/root/493-lab/Lab2/UC-08-AT.md` to execute scenarios:
   - AT-UC08-01 through AT-UC08-06
4. Confirm results match expected outcomes, including:
   - Exactly three reviewers required
   - Workload limit enforcement
   - No partial assignments on validation failure
   - Invitation failures do not block assignment success

## Success

All UC-08-AT scenarios pass without deviations.
