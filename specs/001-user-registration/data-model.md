# Data Model: Register User Account

## Entities

### User Account

- **Purpose**: Represents a registered CMS user.
- **Key Fields**:
  - **id**: Unique identifier.
  - **email**: Canonical email address (trimmed, lowercased for comparison).
  - **credential**: Stored authentication secret.
  - **status**: Active or disabled.
  - **created_at**: Account creation timestamp.

### Registration Attempt

- **Purpose**: Captures a registration submission and outcome for operational review.
- **Key Fields**:
  - **id**: Unique identifier.
  - **email_input**: Raw email as submitted (for diagnostics).
  - **email_canonical**: Trimmed, case-normalized email used for uniqueness checks.
  - **timestamp**: Submission time.
  - **outcome**: Success, validation failure, or system error.
  - **reason**: Brief reason for failure (if any).

## Relationships

- **User Account** can be linked to many **Registration Attempts** by canonical email.
- A **Registration Attempt** may or may not result in a **User Account** creation.

## Validation Rules (from requirements)

- Email format must satisfy RFC 5322.
- Email uniqueness is enforced case-insensitively after trimming leading/trailing whitespace.
- Only one account may exist per email address.
- Passwords must be at least 8 characters and include at least 1 letter and 1 number.
- Required-field errors must be specific for email and password.

## State Transitions

- Registration Attempt: `submitted` → `validated` → `succeeded` or `failed`.
- User Account: `created` → `active` (default) or `disabled` (administrative action).
