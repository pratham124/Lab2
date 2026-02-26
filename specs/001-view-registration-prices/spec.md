# Feature Specification: View Conference Registration Prices

**Feature Branch**: `001-view-registration-prices`  
**Created**: February 3, 2026  
**Status**: Draft  
**Input**: User description: "UC-20.md UC-20-AT.md"

## Clarifications

### Session 2026-02-03

- Q: Should registration prices be viewable without login, or require login (or partial login)? → A: Pricing is publicly viewable without login.
- Q: How should the system handle pricing categories that are defined but marked inactive? → A: Hide inactive categories entirely.
- Q: How should the system handle pricing categories that exist but have no price amount? → A: Show category labeled “Not available”.
- Q: If all categories are inactive or have no price amounts, how should the system respond? → A: Treat as “Pricing is not available.” (empty-state message).
- Q: What localization requirement applies to the pricing view (messages/labels)? → A: English only for this feature.

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-20
- **Acceptance Tests**: UC-20-AT
- **Notes**: Existing UC-20 behavior is being specified; no new use cases added.

### User Story 1 - View Current Registration Prices (Priority: P1)

As an attendee, I want to view the current conference registration prices so I can understand the cost of attending.

**Why this priority**: This is the primary value of the feature and required for attendees to make attendance decisions.

**Independent Test**: Can be fully tested by opening the registration prices view and confirming prices are displayed.

**Acceptance Scenarios**:

1. **Given** pricing information is defined and accessible, **When** an attendee opens the registration prices view, **Then** the system displays all current prices with category labels and amounts.
2. **Given** pricing information includes multiple categories, **When** an attendee opens the registration prices view, **Then** all categories are visible without errors.

---

### User Story 2 - Handle Missing Pricing Information (Priority: P2)

As an attendee, I want to be informed when pricing is not available so I know to check back later.

**Why this priority**: If prices are not defined, the system must clearly communicate the situation to avoid confusion.

**Independent Test**: Can be tested by removing all pricing entries and verifying the empty-state message.

**Acceptance Scenarios**:

1. **Given** no pricing information is defined, **When** an attendee opens the registration prices view, **Then** the system displays a clear “Pricing is not available.” message and no prices.

---

### User Story 3 - Handle Retrieval Failures Safely (Priority: P3)

As an attendee, I want a clear error message if pricing cannot be retrieved so I can try again later.

**Why this priority**: Failures should not expose technical details and should preserve user trust.

**Independent Test**: Can be tested by simulating a pricing retrieval failure and verifying the error message.

**Acceptance Scenarios**:

1. **Given** pricing exists but retrieval fails, **When** an attendee opens the registration prices view, **Then** the system shows a friendly error message and no sensitive details.

---

### Edge Cases

- When all categories are inactive and no prices are visible, follow FR-010/FR-011 (show “Pricing is not available.”).
- When all categories exist but have no price amounts, follow FR-010/FR-011 and FR-009 (unavailable state with “Pricing is not available.” and “Not available” where applicable).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a way for attendees to access current registration prices.
- **FR-002**: System MUST display each available price with its category label and amount, using the order and formatting defined by the pricing configuration (see AC-013, AC-014).
- **FR-003**: System MUST show a clear “Pricing is not available.” message when no pricing is defined.
- **FR-004**: System MUST show a friendly error message when pricing retrieval fails and must not expose technical details.
- **FR-005**: System MUST support displaying multiple pricing categories when they exist.
- **FR-006**: System MUST ensure displayed prices match the stored pricing values at the time of view.
- **FR-007**: System MUST allow attendees to view pricing without login.
- **FR-008**: System MUST hide inactive pricing categories from the attendee view.
- **FR-009**: System MUST display categories with no price amount as “Not available”.
- **FR-010**: When no active categories with prices are available, system MUST display the “Pricing is not available.” message.
- **FR-011**: When no active priced categories exist (none defined, all inactive, or all amounts missing), the system MUST treat the response as unavailable and show “Pricing is not available.” (not an error).
- **FR-012**: Retrieval or service failures MUST be treated as errors distinct from unavailability and show the friendly error message.

### Acceptance Criteria (Requirements)

- **AC-001**: From any attendee entry point to pricing, prices are visible when pricing is defined and accessible.
- **AC-002**: Each displayed price includes a category label and a numeric amount.
- **AC-003**: When pricing is undefined, only a “Pricing is not available.” message is shown.
- **AC-004**: When pricing retrieval fails, only a friendly error message is shown with no technical details.
- **AC-005**: If multiple categories exist, all categories are displayed in the full view.
- **AC-006**: A known stored price value is displayed exactly as stored.
- **AC-007**: Prices are visible to users who are not logged in.
- **AC-008**: Inactive categories are not shown in the attendee pricing view.
- **AC-009**: Categories with no price amount are shown as “Not available”.
- **AC-010**: If no active categories with prices exist, the “Pricing is not available.” message is shown.
- **AC-011**: If no active priced categories exist due to none defined, all inactive, or all amounts missing, the system returns an unavailable state with “Pricing is not available.” rather than an error.
- **AC-012**: Retrieval/service failures result in the error message and do not use the unavailable state.
- **AC-013**: Categories are displayed in the order defined by the pricing configuration.
- **AC-014**: Price amounts follow the currency and formatting defined by the pricing configuration.

### Scope

- **In Scope**: Viewing current registration prices, category display, missing-pricing messaging, retrieval failure messaging.
- **Out of Scope**: Payments, discounts/coupons, deadline/tier computation, registration workflows beyond viewing prices.

### Dependencies

- Pricing information is stored and available in the CMS.
- Pricing retrieval service is available and authorized to return current prices.

### Assumptions

- Pricing information is defined in the CMS before public release unless explicitly marked as unavailable.
- Prices are presented in the currency and formatting defined by the conference’s pricing configuration.
- Category names are business-defined (e.g., Student, Regular, Early) and should be displayed as provided.
- Pricing is publicly viewable without authentication.
- All pricing labels and messages are provided in English only.

### Key Entities *(include if feature involves data)*

- **Registration Price**: Represents a price amount for a registration category, including category name, amount, and active status.
- **Pricing Category**: Represents a label/grouping for registration prices (e.g., Student, Regular, Early).
- **Access Policy**: Pricing is publicly viewable without authentication.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of attendees who open the registration prices view can see the current prices on the first attempt.
- **SC-002**: When no pricing is defined, 100% of users see a clear “Pricing is not available.” message within 2 seconds of opening the view.
- **SC-003**: When pricing retrieval fails, 100% of users see a friendly error message with no technical details.
- **SC-004**: In usability testing, at least 90% of users can accurately identify the registration price for a given category.
