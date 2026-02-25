# Quickstart: Send Decision Notification

This feature is planned for a vanilla HTML/CSS/JavaScript MVC implementation.

## Prerequisites

- Existing CMS runtime environment (not defined in this repository)
- Access to the notification delivery service used by the CMS

## What This Includes

- Decision recording and author notification behavior
- Author visibility of recorded decisions
- Resend behavior for failed notifications only

## What This Excludes

- Reviewer comments or decision rationale content
- Camera-ready instructions

## Next Step

Proceed to implementation using the plan and contracts in this directory.

## Acceptance Check Execution Notes

- Update and review `UC-15-AT.md` before running behavior checks.
- Run focused UC-15 unit coverage:
- `node --test tests/unit/uc-15-decision-notification.test.js`
- Run full regression suite before merge:
- `npm test`
- Validate manual acceptance outcomes against SC-001..SC-004 timing and authorization criteria.
