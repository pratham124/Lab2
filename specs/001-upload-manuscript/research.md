# Research Notes: Upload Manuscript File

## Decision 1: LaTeX Upload Artifact

- **Decision**: Accept a single `.zip` archive containing LaTeX sources.
- **Rationale**: LaTeX projects are commonly multi-file; a single archive minimizes upload failures and keeps validation simple.
- **Alternatives considered**: Accept `.tex` only; accept both `.tex` and `.zip`; remove LaTeX support.

## Decision 2: Manuscript Replacement Behavior

- **Decision**: Only one active manuscript per submission; new upload replaces the previous file.
- **Rationale**: Minimizes author confusion and keeps submission state unambiguous.
- **Alternatives considered**: Keep full version history; keep latest plus one prior version.

## Decision 3: Validation Error Messaging

- **Decision**: Inline errors specifying accepted formats and size limit.
- **Rationale**: Reduces retries and support burden by giving immediate, actionable guidance.
- **Alternatives considered**: Generic error only; error with link to guidelines.

## Decision 4: Retention

- **Decision**: Retain uploaded manuscripts indefinitely unless explicitly removed by an authorized user.
- **Rationale**: Avoids unintended data loss during review and archival periods.
- **Alternatives considered**: Cleanup after deadline; cleanup after 30/90 days.

## Decision 5: Retry Limits

- **Decision**: Allow unlimited retries after failed uploads.
- **Rationale**: Failures may be network-related; unlimited retries reduce friction.
- **Alternatives considered**: Limit retries to 3 or 5 attempts.

## Decision 6: Security & Privacy Controls

- **Decision**: Restrict manuscript access to the submitting author and authorized CMS roles; prevent public access via direct URLs; store files to prevent unauthorized read access.
- **Rationale**: Manuscripts are sensitive pre-publication content requiring controlled access.
- **Alternatives considered**: Public access links; broader access for all logged-in users.
