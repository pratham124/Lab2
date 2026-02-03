# Acceptance Test Suite — UC-20 View Conference Registration Prices

## Overview

**Use Case**: UC-20 View Conference Registration Prices  
**Objective**: Verify that an attendee can view current registration prices, that the system handles missing pricing data and retrieval failures safely, and that optional category-based viewing (if supported) works correctly.  
**In Scope**: Price page access, retrieval/display of pricing data, empty-state when undefined or no active prices, error handling/logging, optional category filters/views, public access without login, inactive category handling, missing price handling, English-only labels/messages.  
**Out of Scope**: Payment processing, discounts/coupons, deadlines and tier logic unless explicitly implemented.

---

## AT-UC20-01 — View Registration Prices Successfully (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Registration pricing information is defined in CMS (at least one price tier exists).
- Pricing information service and database are available.
- Attendee `T1` can access CMS (logged in if required).

**Test Data** (example):

- Category: Regular — $200
- Category: Student — $100

**Steps**:

1. Access the CMS as attendee `T1` (log in if required).
2. Navigate to “Registration Prices.”
3. View the displayed pricing table/list.

**Expected Results**:

- System retrieves current pricing information.
- System displays all available prices clearly (amount and category label).
- No errors are shown.

**Pass/Fail Criteria**:

- PASS if prices are displayed correctly; FAIL otherwise.

---

## AT-UC20-02 — Pricing Not Defined: Show “Not Available” Message (Extension 3a)

**Priority**: High  
**Preconditions**:

- No registration pricing entries exist in CMS (pricing undefined/unpublished).
- Attendee can access pricing page.

**Test Data**:

- Pricing dataset is empty

**Steps**:

1. Navigate to “Registration Prices.”

**Expected Results**:

- System displays a clear message indicating pricing is not available.
- Response indicates unavailable state (not error) when no active priced categories exist.
- System does not display stale/default prices.
- No stack traces or technical error details shown.

**Pass/Fail Criteria**:

- PASS if empty-state is clear and safe; FAIL otherwise.

---

## AT-UC20-03 — Retrieval Error: Show Friendly Error (Extension 3b)

**Priority**: High  
**Preconditions**:

- Pricing exists in CMS.
- Simulate DB read failure or pricing service outage.

**Test Data**:

- Any valid pricing dataset

**Steps**:

1. Navigate to “Registration Prices” while retrieval failure is active.

**Expected Results**:

- System shows an error indicating pricing cannot be retrieved at this time.
- No technical stack traces or sensitive details shown.
- Error is logged (verifiable in test environment logs).
- Retrieval failures are treated as errors (not unavailable state).

**Pass/Fail Criteria**:

- PASS if error handling is safe and clear; FAIL otherwise.

---

## AT-UC20-04 — Category View/Filter Works (Extension 4a, If Supported)

**Priority**: Medium  
**Preconditions**:

- Multiple price categories exist (e.g., Student, Regular).
- UI supports viewing/filtering by category.

**Test Data**:

- Student — $100
- Regular — $200

**Steps**:

1. Open “Registration Prices.”
2. Select “Student” category filter/view.
3. Select “Regular” category filter/view.
4. Clear filter (if available).

**Expected Results**:

- When filtered, only the selected category price is shown (or highlighted), as implemented.
- Switching categories updates display correctly.
- Clearing filter returns to full list view.

**Pass/Fail Criteria**:

- PASS if category-specific viewing behaves correctly; FAIL otherwise.

---

## AT-UC20-05 — Public Access Without Login

**Priority**: Low  
**Preconditions**:

- Pricing information is defined.
- Pricing is publicly viewable without login.

**Test Data**:

- Any valid pricing dataset

**Steps**:

1. Attempt to open the “Registration Prices” page without logging in.

**Expected Results**:

- Prices are visible without login.
- No login prompt is required.

**Pass/Fail Criteria**:

- PASS if behavior matches expected access policy; FAIL otherwise.

---

## AT-UC20-06 — Data Integrity: Displayed Prices Match Stored Values

**Priority**: Medium  
**Preconditions**:

- Known pricing entries exist in CMS.
- Attendee can access pricing view.

**Test Data**:

- Known entry: Regular — $200 (exact expected value)

**Steps**:

1. Open “Registration Prices.”
2. Locate the known entry.

**Expected Results**:

- Displayed amount matches stored value exactly.
- Category labels match expected tier names.
- Currency symbol/formatting is consistent (as implemented).

**Pass/Fail Criteria**:

- PASS if displayed values match stored pricing; FAIL otherwise.

---

## AT-UC20-07 — Inactive Categories Hidden

**Priority**: Medium  
**Preconditions**:

- At least one active category exists with a price amount.
- At least one category is marked inactive.

**Test Data**:

- Active: Regular — $200
- Inactive: VIP — $500

**Steps**:

1. Open “Registration Prices.”
2. Observe the displayed categories.

**Expected Results**:

- Active categories are displayed.
- Inactive categories are not shown.

**Pass/Fail Criteria**:

- PASS if inactive categories are hidden; FAIL otherwise.

---

## AT-UC20-08 — Category Without Price Shows “Not available”

**Priority**: Medium  
**Preconditions**:

- At least one category exists without a price amount.

**Test Data**:

- Student — (no price amount)

**Steps**:

1. Open “Registration Prices.”
2. Locate the Student category.

**Expected Results**:

- The Student category is shown with price displayed as “Not available”.

**Pass/Fail Criteria**:

- PASS if the missing price is shown as “Not available”; FAIL otherwise.

---

## AT-UC20-09 — No Active Categories With Prices

**Priority**: Medium  
**Preconditions**:

- No active categories have price amounts.
- Any categories that exist are inactive and/or have no price amount.

**Steps**:

1. Open “Registration Prices.”

**Expected Results**:

- System displays a clear “pricing is not available” message.
- Response indicates unavailable state (not error).
- No prices are displayed.

**Pass/Fail Criteria**:

- PASS if the empty-state message is shown; FAIL otherwise.

---

## AT-UC20-10 — English-Only Labels and Messages

**Priority**: Low  
**Preconditions**:

- Pricing exists with at least one category.

**Steps**:

1. Open “Registration Prices.”
2. Review category labels and system messages (including empty/error states if applicable).

**Expected Results**:

- All labels and messages are displayed in English.

**Pass/Fail Criteria**:

- PASS if all labels/messages are English-only; FAIL otherwise.

---

## Traceability (UC-20 Paths → Tests)

- **Main Success Scenario** → AT-UC20-01
- **Extension 3a (pricing undefined)** → AT-UC20-02
- **Extension 3b (retrieval error)** → AT-UC20-03
- **Extension 4a (category view)** → AT-UC20-04
- **Access policy robustness** → AT-UC20-05
- **Correctness** → AT-UC20-06
- **Inactive categories hidden** → AT-UC20-07
- **Missing price amount** → AT-UC20-08
- **No active categories with prices** → AT-UC20-09
- **English-only labels/messages** → AT-UC20-10
