# Data Model: Save Submission Draft

## Entities

### Author
- **Purpose**: Registered user who owns drafts.
- **Key Fields**: author_id, account_status
- **Relationships**: One Author has many Submissions; each Submission has at most one Draft Submission.

### Submission
- **Purpose**: Container for a paper submission lifecycle (draft → submitted).
- **Key Fields**: submission_id, author_id, status
- **Relationships**: One Submission belongs to one Author; one Submission has at most one Draft Submission.

### Draft Submission
- **Purpose**: Partially completed submission data saved by the author.
- **Key Fields**: draft_id, submission_id, author_id, saved_at, data_payload
- **Relationships**: One Draft Submission belongs to one Submission and one Author.

## Validation Rules

- Drafts may be saved with no required fields completed; only provided fields are validated.
- Save is rejected if any provided field fails basic consistency validation.
- Only the draft owner (author_id) can access or modify the draft.
- At most one draft exists per submission.

## State Transitions

- **Create Draft**: none → draft (on first save).
- **Update Draft**: draft → draft (on subsequent saves).
- **Submit**: draft → submitted (out of scope for this feature).
