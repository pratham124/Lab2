# Data Model: Generate Conference Schedule

## Entities

### ConferenceSchedule
- **Fields**: `id`, `conferenceId`, `createdByAdminId`, `createdAt`, `status`, `sessions[]`
- **Notes**: Represents the full schedule for a single conference. `status = generated` implies all accepted papers were scheduled exactly once.

### Session
- **Fields**: `id`, `scheduleId`, `roomId`, `timeSlotId`, `paperIds[]`
- **Notes**: Groups one or more accepted papers into a session in a room and time slot.

### TimeSlot
- **Fields**: `id`, `conferenceId`, `date`, `startTime`, `endTime`
- **Notes**: A discrete window for a session.

### AcceptedPaper
- **Fields**: `id`, `conferenceId`, `title`, `status`
- **Notes**: Only papers with `status = accepted` are eligible for scheduling.

### SchedulingParameters
- **Fields**: `conferenceId`, `conferenceDates[]`, `sessionLengthMinutes`, `dailyTimeWindow`, `availableRoomIds[]`
- **Notes**: Inputs required to generate a schedule.

### Room
- **Fields**: `id`, `conferenceId`, `name`, `capacity`
- **Notes**: Physical or virtual location for sessions.

## Relationships

- **ConferenceSchedule** belongs to **Conference** (by `conferenceId`).
- **Session** belongs to **ConferenceSchedule** and references one **Room** and one **TimeSlot**.
- **AcceptedPaper** belongs to **Conference** and is included in exactly one **Session** in a successful schedule.
- **SchedulingParameters** belong to **Conference** and are required before generation.

## Validation Rules

- A schedule can only be generated if all required **SchedulingParameters** are present.
- Only **AcceptedPaper** entities with `status = accepted` may be scheduled.
- Each accepted paper appears exactly once in a successfully generated schedule, and never more than once.
- Scheduling MUST apply a deterministic assignment order when resolving conflicts (e.g., sort by paper ID then fill slots).
- Sessions must reference valid **Room** and **TimeSlot** entries.

## State Transitions

- **ConferenceSchedule**: `not_generated` → `generated` (stored) or `not_generated` → `generation_failed` (no schedule stored).
