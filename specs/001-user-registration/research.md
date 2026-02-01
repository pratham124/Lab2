# Phase 0 Research: Register User Account

## Decision 1: Vanilla web stack only
- **Decision**: Use plain HTML, CSS, and JavaScript with MVC separation.
- **Rationale**: Required by the project constitution and keeps implementation simple and compatible with current CMS constraints.
- **Alternatives considered**: Front-end frameworks or build tools (rejected by constitution).

## Decision 2: Storage and persistence
- **Decision**: Persist user accounts and registration attempts in the existing CMS persistent store.
- **Rationale**: The feature is an extension of the CMS and should use its existing storage for consistency and integrity.
- **Alternatives considered**: Separate storage or file-based persistence (adds complexity and fragmentation).

## Decision 3: Email validation standard
- **Decision**: Use RFC 5322 for email format validation as specified in the requirements.
- **Rationale**: Aligns with the explicit requirement to use RFC 5322 for format validation.
- **Alternatives considered**: Simpler regex or provider-specific validation (not specified).

## Decision 4: Testing approach
- **Decision**: Use `UC-01-AT.md` as acceptance-test contract with manual browser verification for user flows.
- **Rationale**: Acceptance tests are the source of truth per constitution; manual checks are sufficient for validating the documented scenarios.
- **Alternatives considered**: Automated UI testing frameworks (would introduce tooling not specified in the project).

## Decision 5: Performance expectations
- **Decision**: Target prompt user feedback on submission and completion within the existing 2-minute usability goal.
- **Rationale**: The spec defines a measurable completion-time outcome; no additional performance targets are required.
- **Alternatives considered**: Adding explicit latency SLAs (not specified and may over-constrain implementation).

## Decision 6: Scale assumptions
- **Decision**: Plan for typical conference-scale usage (hundreds to low thousands of users).
- **Rationale**: Aligns with the domain and avoids over-engineering for unlikely extremes.
- **Alternatives considered**: Large-scale public SaaS volumes (not implied by the CMS use case).
