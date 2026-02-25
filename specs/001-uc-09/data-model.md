# Data Model: Enforce Reviewer Workload Limit

## Entities

### Reviewer
- **Fields**: reviewer_id, name, role
- **Relationships**: has many Assignments
- **Notes**: Only editors can assign reviewers; reviewers themselves are selection targets.

### Paper
- **Fields**: paper_id, conference_id, title, status
- **Relationships**: has many Assignments

### Assignment
- **Fields**: assignment_id, reviewer_id, paper_id, conference_id, assigned_at
- **State**: assigned (no pending state)
- **Rules**: Only created when workload validation passes.

### Workload Count
- **Derived**: count of Assignments per reviewer per conference
- **Rule**: Must never exceed 5

## Validation Rules

- A reviewer is selectable only if their per-conference workload count is less than 5.
- Assignment creation is blocked if workload verification fails.
- Under concurrency, only one assignment may succeed when two assignments would push the count above 5.

## State Transitions

- **Assignment**: not assigned → assigned (only if workload check passes)
