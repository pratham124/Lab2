# Data Model: Submit Completed Review Form

## Entities

### Review
- **Purpose**: Stores a completed review for a specific paper by a specific reviewer.
- **Key Fields**:
  - `review_id` (unique identifier)
  - `paper_id` (references Paper)
  - `reviewer_id` (references Reviewer)
  - `required_fields` (all required form fields captured as structured values)
  - `optional_fields` (optional comments/notes)
  - `status` (InProgress, Submitted)
  - `submitted_at` (timestamp when submitted)
- **Validation Rules**:
  - All required fields must be present and valid before submission.
  - Exactly one submitted review per reviewer per paper.
  - Once `status = Submitted`, the review is immutable.

### Paper
- **Purpose**: Represents a submitted paper under review.
- **Key Fields**:
  - `paper_id`
  - `title`
  - `authors`

### Reviewer
- **Purpose**: Represents a reviewer who can submit reviews.
- **Key Fields**:
  - `reviewer_id`
  - `name`
  - `email`
  - `invitation_status` (Accepted, Declined, Pending)

### Editor
- **Purpose**: Represents an editor who views submitted reviews.
- **Key Fields**:
  - `editor_id`
  - `name`
  - `email`

## Relationships

- A **Review** belongs to exactly one **Paper** and one **Reviewer**.
- A **Paper** can have many **Reviews** (from different reviewers).
- A **Reviewer** can submit reviews for multiple papers they are assigned to.
- An **Editor** can view all submitted reviews for papers in their scope.

## State Transitions

- **Review.status**: InProgress → Submitted (terminal)
  - Transition allowed only if all required fields are valid and reviewer invitation is accepted.
