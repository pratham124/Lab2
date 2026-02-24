# Research — Paper Submission

## Decision 1: Web Stack

- **Decision**: Use vanilla HTML/CSS/JavaScript with MVC separation.
- **Rationale**: Constitution mandates vanilla stack and MVC separation; aligns with existing CMS constraints.
- **Alternatives considered**: JS frameworks or build tooling (rejected by constitution).

## Decision 2: Storage

- **Decision**: Use existing CMS database and file storage for submissions and manuscripts.
- **Rationale**: Spec declares existing CMS storage; avoids introducing new storage tech.
- **Alternatives considered**: New storage service or external file host (out of scope).

## Decision 3: Duplicate Submission Detection

- **Decision**: Treat duplicates as same author + same title or manuscript content within the official submission window; block and inform the author.
- **Rationale**: Matches FR-009 and UC-04 extension; minimizes accidental double submissions.
- **Alternatives considered**: Allow duplicates with warning; block only same file hash (insufficiently user-visible).

## Decision 4: Performance Expectations

- **Decision**: Maintain spec success criteria (>=99% valid submissions succeed without system error) and ensure 7 MB uploads complete under normal network conditions during peak week.
- **Rationale**: Aligns with success criteria and file-size constraint.
- **Alternatives considered**: Formal latency SLAs (not required by spec).
