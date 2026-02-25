# Data Model: Receive Review Invitation

## Entities

### ReviewInvitation

- **Purpose**: Represents a request for a reviewer to review a paper.
- **Fields**:
  - `id` (unique identifier)
  - `reviewer_id`
  - `paper_id`
  - `status` (pending, accepted, rejected, declined)
  - `created_at`
  - `response_due_at`
  - `responded_at` (optional)
- **Relationships**:
  - Many invitations belong to one Reviewer.
  - Many invitations belong to one Paper.
- **Validation Rules**:
  - `reviewer_id` and `paper_id` are required.
  - `response_due_at` must be after `created_at` when set.
  - Only pending invitations are shown by default.
- **State Transitions**:
  - pending → accepted (not in scope for UC-11 actions)
  - pending → rejected (not in scope for UC-11 actions)
  - pending → declined (automatic when response_due_at passes)

### Reviewer

- **Purpose**: User who can receive and respond to invitations.
- **Fields**:
  - `id`
  - `name`
  - `email`
  - `status` (active/inactive)
- **Relationships**:
  - One Reviewer can have many ReviewInvitations.

### Paper

- **Purpose**: Submission being reviewed.
- **Fields**:
  - `id`
  - `title`
  - `abstract`
  - `status` (submitted/under_review/other as defined elsewhere)
- **Relationships**:
  - One Paper can have many ReviewInvitations.

### Notification

- **Purpose**: Record of an invitation notification attempt.
- **Fields**:
  - `id`
  - `invitation_id`
  - `channel` (email)
  - `delivery_status` (pending/sent/failed)
  - `sent_at` (optional)
- **Relationships**:
  - One Notification belongs to one ReviewInvitation.

## Identity & Uniqueness

- `ReviewInvitation.id`, `Reviewer.id`, and `Paper.id` are globally unique within the CMS.
- A reviewer should not have more than one pending invitation for the same paper.

## Access Rules

- Only the invited reviewer can view a ReviewInvitation.
- Invitation list defaults to status `pending`.
- Invitation detail reveals paper abstract only after acceptance (out of scope for UC-11 actions).
