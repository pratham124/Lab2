# Data Model — Assign Reviewers to Papers

## Entities

### Paper
- **Fields**: id (unique), title, status (submitted/assigned), assignedReviewerCount
- **Relationships**: has many Assignments; has many Invitations (via Assignments)
- **Validation**: can only move to assigned status when exactly three assignments exist

### Reviewer
- **Fields**: id (unique), name, currentAssignmentCount, eligibilityStatus
- **Relationships**: has many Assignments; receives Invitations
- **Validation**: currentAssignmentCount must be <= 5 after any new assignment

### Assignment
- **Fields**: id (unique), paperId, reviewerId, assignedAt
- **Relationships**: belongs to Paper; belongs to Reviewer
- **Validation**: each paper must have exactly three assignments; prevent duplicates per paper+reviewer

### Invitation
- **Fields**: id (unique), assignmentId, status (pending/sent/failed), lastAttemptAt
- **Relationships**: belongs to Assignment
- **Validation**: invitation created for each assignment; failed invitations are retried; invitation failures do not invalidate assignments

## State Transitions

- **Paper.status**: submitted → assigned (when three valid assignments are saved)
- **Invitation.status**: pending → sent; pending/failed → failed (on send error); failed → pending (on retry)
