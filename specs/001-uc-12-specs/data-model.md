# Data Model: Access Assigned Papers for Review

## Entities

### Reviewer
- **Fields**: reviewerId (unique), name, email, status (active/inactive)
- **Rules**: Must be authenticated to access assigned papers.

### Paper
- **Fields**: paperId (unique), title, status (submitted/withdrawn), metadata (e.g., track)
- **Rules**: Only assigned papers are visible to a reviewer.

### Assignment
- **Fields**: assignmentId (unique), reviewerId (FK), paperId (FK), status (active/inactive), assignedAt
- **Rules**: An active assignment grants view-only access to the paper.

### Manuscript
- **Fields**: manuscriptId (unique), paperId (FK), availability (available/unavailable), version
- **Rules**: If unavailable, the system shows a clear error and does not display content.

### ErrorResponse
- **Fields**: message, nextStep, backLink
- **Rules**: Returned for retrieval failures, access denied, and manuscript unavailable states; message must be user-facing and backLink returns to the assigned papers list.

## Relationships
- Reviewer 1..* Assignment
- Paper 1..* Assignment
- Paper 0..1 Manuscript

## Validation Rules
- Reviewer must be logged in and have an active Assignment to access a Paper.
- Access to any Paper without an Assignment is denied and does not reveal content.
- Manuscript availability must be checked before display.
- View-only access: no download capability is exposed.

## State Transitions
- Assignment: inactive → active (when assigned) → inactive (when unassigned or review closed)
- Manuscript: unavailable → available (on upload) → unavailable (if removed or inaccessible)
