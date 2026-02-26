# Data Model: View Published Conference Schedule

## Entities

### PublishedSchedule

- **id**: Unique identifier
- **status**: Published | Unpublished
- **entries**: Collection of ScheduleEntry
- **publishedAt**: Date/time schedule was published

### ScheduleEntry

- **id**: Unique identifier
- **title**: Session title
- **timeSlot**: TimeSlot (required for display)
- **location**: Location (required for display)
- **day**: Calendar day label or date
- **session**: Session or track identifier

### TimeSlot

- **startTime**: Start time
- **endTime**: End time

### Location

- **name**: Room or venue name

### Attendee

- **id**: Unique identifier (if tracked)
- **role**: Attendee

## Relationships

- PublishedSchedule **has many** ScheduleEntry
- ScheduleEntry **has one** TimeSlot
- ScheduleEntry **has one** Location

## Validation Rules

- PublishedSchedule must have status = Published to be visible.
- ScheduleEntry must include both timeSlot and location to be displayed.
- Filtering by day or session (if available) only includes matching entries.

## State Transitions

- PublishedSchedule: Unpublished -> Published
