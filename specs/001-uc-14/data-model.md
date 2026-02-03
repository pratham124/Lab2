# Data Model: View Completed Reviews for a Paper

## Entities

### Paper
- **id**: Unique paper identifier
- **title**: Paper title
- **status**: Submission state (e.g., submitted, under_review, decided)
- **assignedEditorId**: Editor responsible for the paper
- **reviewIds**: List of related review identifiers

### Review
- **id**: Unique review identifier
- **paperId**: Paper being reviewed
- **reviewerId**: Reviewer identifier (visible to assigned editor)
- **reviewerName**: Reviewer display name
- **status**: Review state (pending, submitted)
- **submittedAt**: Submission timestamp when status is submitted
- **content**: Structured review content fields as defined by the review form

### Editor
- **id**: Unique editor identifier
- **name**: Display name
- **role**: Editor role/permission type

## Relationships

- Paper **has many** Reviews
- Review **belongs to** Paper
- Paper **is assigned to** one Editor

## Validation Rules

- Only Reviews with `status = submitted` are considered completed.
- Only the assigned Editor for the Paper may view completed reviews.
- Review content shown must include all required review fields from the form.

## State Transitions

- Review: pending → submitted
