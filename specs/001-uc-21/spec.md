# Feature Specification: Pay Conference Registration Fee Online

**Feature Branch**: `001-uc-21`  
**Created**: February 3, 2026  
**Status**: Draft  
**Input**: User description: "UC-21.md UC-21-AT.md"

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-21
- **Acceptance Tests**: UC-21-AT
- **Notes**: Existing use case; specification aligns with UC-21 and its acceptance tests.

### User Story 1 - Pay Registration Fee Online (Priority: P1)

As an attendee who has already registered and selected a registration category, I want to pay the conference registration fee online by credit/debit card so my registration is confirmed.

**Why this priority**: Payment completion is the core value that enables attendance and revenue collection.

**Independent Test**: Can be fully tested by completing a payment flow and verifying a confirmed registration with a success message.

**Acceptance Scenarios**:

1. **Given** an attendee is logged in with an unpaid registration and a selected category, **When** they choose the credit/debit card payment option and complete payment successfully, **Then** the system records the payment, updates registration status to “Paid/Confirmed,” and shows a payment confirmation.
2. **Given** the payment gateway confirms success, **When** the confirmation is received by the system, **Then** the attendee’s registration status is updated and remains confirmed.
3. **Given** an attendee’s registration is already marked “Paid/Confirmed,” **When** they navigate to payment initiation, **Then** the system blocks payment initiation and shows the paid status with the payment record.

---

### User Story 2 - View Payment Status and Record (Priority: P2)

As an attendee who has paid, I want to view my payment status and record so I can confirm my registration is complete.

**Why this priority**: Attendees need reassurance and a reliable way to verify payment without contacting support.

**Independent Test**: Can be fully tested by paying once and later verifying that the status and payment record are visible in the attendee account.

**Acceptance Scenarios**:

1. **Given** a successful payment exists for an attendee, **When** they view their registration status, **Then** the status is shown as “Paid/Confirmed” and the payment record (amount, date/time, reference) is visible.

---

### User Story 3 - Handle Failed or Unavailable Payments (Priority: P3)

As an attendee attempting to pay, I want clear feedback when payment fails or the payment service is unavailable so I know what to do next and my registration is not incorrectly marked as paid.

**Why this priority**: Failure handling prevents confusion, avoids incorrect registration states, and reduces support burden.

**Independent Test**: Can be fully tested by simulating invalid details, a declined payment, or payment service unavailability and verifying clear messaging and unchanged unpaid status.

**Acceptance Scenarios**:

1. **Given** an attendee enters invalid or incomplete payment details, **When** the payment attempt is rejected, **Then** the attendee is shown a clear error message and the registration remains unpaid.
2. **Given** a payment attempt is declined, **When** the system receives a declined result, **Then** the attendee is informed and the registration remains unpaid.
3. **Given** the payment service is unavailable before redirect, **When** the attendee attempts to initiate payment, **Then** the system shows an availability message and the registration remains unpaid.
4. **Given** a payment completes but confirmation is delayed, **When** the attendee is returned to the system, **Then** a pending message is displayed and the registration is not marked paid until confirmation arrives.
5. **Given** a payment remains pending for more than 24 hours, **When** the system evaluates the pending state, **Then** the registration remains unpaid and the attendee is notified to retry payment.
6. **Given** a duplicate confirmation is received for the same transaction, **When** the system processes the confirmation, **Then** no duplicate payment record is created and the registration status is unchanged.

---

### Edge Cases

- Duplicate payment confirmations are received for the same transaction.
- A payment remains pending for more than 24 hours.
- A payment completes but the attendee closes the browser before confirmation is displayed.
- An unauthenticated user attempts to access the payment initiation page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require attendees to be logged in before initiating payment.
- **FR-002**: The system MUST display the registration fee and the available credit/debit card payment option for the attendee’s selected category.
- **FR-003**: The system MUST allow an attendee to initiate a credit/debit card payment and complete the process through a secure payment flow (handled by the payment gateway; CMS does not accept/store raw card data; sensitive details are not logged).
- **FR-004**: The system MUST record each successful payment with amount, date/time, and a transaction reference.
- **FR-005**: The system MUST update the attendee’s registration status to “Paid/Confirmed” after a successful payment confirmation is received.
- **FR-006**: The system MUST display a payment confirmation message after a successful payment.
- **FR-007**: The system MUST inform the attendee when payment details are invalid or incomplete and keep the registration unpaid.
- **FR-008**: The system MUST inform the attendee when a payment is declined and keep the registration unpaid.
- **FR-009**: The system MUST inform the attendee when the payment service is temporarily unavailable and keep the registration unpaid.
- **FR-010**: The system MUST prevent duplicate payment records and status changes from repeated confirmations of the same transaction.
- **FR-011**: The system MUST allow attendees to view their current registration status and payment record after payment.
- **FR-012**: The system MUST support a “Pending Payment Confirmation” state when confirmation is delayed and resolve it upon receipt of confirmation.
- **FR-013**: The system MUST block payment initiation when a registration is already “Paid/Confirmed” and display the paid status with the payment record.
- **FR-014**: The system MUST treat payments pending confirmation for more than 24 hours as unpaid and notify the attendee.

### Status Codes & Messaging Requirements

- **Status Codes**:
  - **Registration status codes**: `unpaid` | `pending_confirmation` | `paid_confirmed`
  - **Payment transaction status codes**: `initiated` | `pending_confirmation` | `succeeded` | `failed` | `declined`
  - User-facing labels may be displayed (e.g., “Unpaid,” “Pending Confirmation,” “Paid/Confirmed”), but canonical values MUST use the codes above.
- **Error Messaging**:
  - Error messages MUST be plain-language and MUST NOT expose internal system details.
  - Error message codes MUST include support for: `invalid_details`, `declined`, `service_unavailable`, `not_eligible_already_paid`, `pending_timeout`.

### Non-Functional Requirements

#### Security

- **NFR-001**: The CMS MUST NOT store raw cardholder data; payment handling and PCI responsibilities are delegated to the payment gateway where possible.
- **NFR-002**: The system MUST mask or avoid logging sensitive payment details (e.g., full card numbers, security codes).
- **NFR-003**: The system MUST record audit events for payment attempts, confirmations, and failures.

#### Datastore Guarantees

- **NFR-004**: Payment transaction references MUST be unique across all records.
- **NFR-005**: Payment confirmation processing MUST be idempotent.
- **NFR-006**: Registration status updates and payment record persistence MUST be atomic; if atomicity is not available, the system MUST define an explicit order with compensating behavior.
- **NFR-007**: If eventual consistency applies, the system MUST state expected propagation delays and the user-facing status behavior during that window.

### Key Entities *(include if feature involves data)*

- **Attendee**: Registered user who pays the registration fee.
- **Registration**: The attendee’s registration record including category, fee, and status.
- **Payment Transaction**: Record of a payment attempt, including amount, status, timestamp, and reference.
- **Payment Status**: State of the payment (e.g., unpaid, pending confirmation, paid/confirmed).

### Assumptions

- Attendees are already registered and have selected a registration category before payment.
- Registration fees and currency are configured in the system before payment is initiated.
- Refunds, chargebacks, and receipt generation are out of scope for this feature.
- Only credit/debit card payments are in scope for this feature.

### Dependencies

- Online payment service availability.
- Registration pricing configuration.
- Authentication for attendee access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Successful payments result in a “Paid/Confirmed” status and a visible confirmation message for the attendee.
- **SC-002**: Invalid, declined, or unavailable payment attempts leave registrations unpaid and show a clear message to the attendee.
- **SC-003**: Duplicate payment confirmations do not create duplicate records or alter an already confirmed registration.
- **SC-004**: Payments pending confirmation for more than 24 hours are marked unpaid and the attendee is notified to retry.
