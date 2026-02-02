# Phase 0 Research: Receive Review Invitation

## Decision 1: Vanilla web stack with MVC separation

- **Decision**: Use plain HTML/CSS/JavaScript with MVC separation.
- **Rationale**: Required by the project constitution and sufficient for the feature scope.
- **Alternatives considered**: Frontend frameworks or build tools (rejected by constitution).

## Decision 2: Use existing CMS datastore for invitation data

- **Decision**: Persist invitations, papers, and reviewers in the existing CMS datastore.
- **Rationale**: The feature extends current CMS workflows and does not require a new storage system.
- **Alternatives considered**: New storage layer or separate invitation service (adds complexity).

## Decision 3: Authenticated access only

- **Decision**: Require login to view the invitations list and any invitation detail.
- **Rationale**: Protects confidential submission information and aligns with UC-11 security expectations.
- **Alternatives considered**: Access via emailed tokenized links (privacy risk, expands scope).
