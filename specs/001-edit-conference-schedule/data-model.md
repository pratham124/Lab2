# Data Model: Edit Generated Conference Schedule

## Entities

### Schedule

- **Fields**:
  - `id`
  - `name`
  - `status` (e.g., generated, edited)
  - `lastUpdatedAt` (timestamp for concurrency)
- **Relationships**:
  - Has many `ScheduleItem`

### ScheduleItem

- **Fields**:
  - `id`
  - `scheduleId`
  - `paperId`
  - `sessionId`
  - `roomId`
  - `timeSlotId`
- **Relationships**:
  - Belongs to `Schedule`
  - References `Paper`, `Session`, `Room`, `TimeSlot`

### Paper

- **Fields**:
  - `id`
  - `title`

### Session

- **Fields**:
  - `id`
  - `name`

### Room

- **Fields**:
  - `id`
  - `name`

### TimeSlot

- **Fields**:
  - `id`
  - `startTime`
  - `endTime`

### Editor

- **Fields**:
  - `id`
  - `role` (must include editor permission)

## Validation Rules

- A `ScheduleItem` must not share the same `roomId` and `timeSlotId` with another `ScheduleItem` in the same `Schedule`.
- A `ScheduleItem` must not share the same `paperId` and `timeSlotId` with another `ScheduleItem` in the same `Schedule`.
- `Schedule.lastUpdatedAt` must match the value captured at load time; otherwise the save is rejected and the editor must refresh/reload.
- Save operations are atomic: if validation or persistence fails, no partial `ScheduleItem` updates are applied.

## State Transitions

- `Schedule.status`: generated → edited (on first successful save).
