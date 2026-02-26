# Research Notes: Pay Conference Registration Fee Online

## Decision: Vanilla web stack (HTML/CSS/JS)
- **Rationale**: Required by constitution; no frameworks or build-tool dependencies.
- **Alternatives considered**: Framework-based UI or server frameworks (rejected by constitution).

## Decision: Existing CMS datastore for registrations and payments
- **Rationale**: Feature extends current CMS records for registration status and payment transactions.
- **Alternatives considered**: New dedicated payment datastore (unnecessary for this scope).

## Decision: Manual validation using UC-21-AT
- **Rationale**: Acceptance tests are the contract; no automated testing framework is specified.
- **Alternatives considered**: Automated test harness (not specified and out of scope for this plan).
