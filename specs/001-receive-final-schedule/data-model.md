# Data Model: Receive Final Conference Schedule

## Entities

### Author

- **Fields**: id, name, email
- **Notes**: An author can own multiple papers.

### Paper

- **Fields**: id, title, status (accepted/rejected), authorId
- **Relationships**: Many papers belong to one author.

### FinalSchedule

- **Fields**: id, status (draft/published), publishedAt, conferenceTimezone
- **Notes**: Schedule details remain hidden until status is published.

### PresentationDetails

- **Fields**: id, paperId, date, time, session, location, timezone
- **Required**: paperId, date, time, session, location, timezone
- **Relationships**: One presentation detail per accepted paper.
- **Validation**: timezone must equal the conference’s official timezone; date/time required once published.

### Notification

- **Fields**: id, authorId, type (final_schedule), channel (in_app/email), status (pending/sent/failed), sentAt, retryCount, lastAttemptAt
- **Notes**: Notifications only for authors with accepted papers; retries are tracked for best-effort delivery.

## State Transitions

- **FinalSchedule**: draft → published (explicit “Publish Final Schedule” action triggers access and notifications)
- **Paper**: submitted → accepted (eligible for presentation details)
- **Notification**: pending → sent | failed (retryable on transient failures)
