# Data Model: CMS User Login

## Entities

### UserAccount

- **Purpose**: Represents a registered CMS user who can authenticate.
- **Fields**:
  - `id`: Unique identifier.
  - `email`: Unique login identifier (normalized, lower-case).
  - `password_hash`: Stored credential hash (salted).
  - `status`: Account status (active, disabled).
  - `created_at`: Account creation timestamp.
- **Validation Rules**:
  - `email` must be present and well-formed.
  - `email` must be unique.
  - `password_hash` must be a one-way salted hash (never plaintext).
  - `status` must be one of the allowed values.

### LoginAttempt

- **Purpose**: Records each login submission and its outcome.
- **Fields**:
  - `id`: Unique identifier.
  - `email`: Submitted email (normalized).
  - `timestamp`: Attempt time.
  - `outcome`: success, invalid_credentials, account_not_found, system_error, missing_fields.
  - `message`: User-facing error key or summary.
- **Validation Rules**:
  - `email` and `timestamp` required.
  - `outcome` must be one of the allowed values.
  - `message` must be user-safe and must not expose credentials or policy internals.

### AuthenticatedSession

- **Purpose**: Represents an authenticated session for a user during a visit.
- **Fields**:
  - `session_id`: Random session identifier.
  - `user_id`: Reference to UserAccount.
  - `created_at`: Session creation time.
  - `expires_at`: Session expiration time.
  - `last_active_at`: Last activity timestamp.
- **Validation Rules**:
  - `session_id` must be unique.
  - `expires_at` must be after `created_at`.

## Relationships

- A **UserAccount** can have zero or more **LoginAttempt** records.
- A **UserAccount** can have zero or more **AuthenticatedSession** records.
- Each **AuthenticatedSession** references exactly one **UserAccount**.

## State Transitions

- **LoginAttempt**: created on submission → outcome set to success or failure (including missing fields and system error).
- **AuthenticatedSession**: created on successful login → active until expired or explicitly cleared.
