# Acceptance Test Suite — UC-18 Receive Final Conference Schedule

## Overview

**Use Case**: UC-18 Receive Final Conference Schedule  
**Objective**: Verify that an author with accepted paper(s) can be notified that the final schedule is published and can view presentation details (date/time/session/location) for each accepted paper; verify behavior for delayed login, multiple accepted papers, notification failure, and retrieval errors.  
**In Scope**: Schedule publication visibility to authors, author access to presentation details, notification attempt, authorization, error handling/logging.  
**Out of Scope**: Downloading full schedule, calendar invitations, public schedule view without login (not specified).

---

## AT-UC18-01 — Author Can View Presentation Details for Accepted Paper (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Author `A1` is registered and can log in.
- Author `A1` has at least one accepted paper `P1`.
- Final conference schedule has been generated and published.
- Paper `P1` is assigned a time slot with:
  - Date
  - Time
  - Session
  - Location/Room
- CMS and database are available.

**Test Data**:

- Author: `A1`
- Paper: `P1`
- Scheduled details: (sample) Day 1, 10:00–10:15, Session S1, Room R1, Timezone TZ1 (conference official timezone)

**Steps**:

1. Log in as author `A1`.
2. Navigate to “My Submissions.”
3. Select accepted paper `P1`.

**Expected Results**:

- System displays presentation details for `P1`: date, time, session, location, timezone.
- Details match what is stored in the final schedule.
- Displayed timezone equals the conference’s official timezone.
- No unauthorized information (other papers’ private details) is shown beyond what is intended.

**Pass/Fail Criteria**:

- PASS if correct presentation details are visible for the accepted paper; FAIL otherwise.

---

## AT-UC18-02 — Notification Sent When Final Schedule Is Published

**Priority**: Medium  
**Preconditions**:

- Author `A1` has an accepted paper `P1`.
- Author `A2` has a rejected paper `P2` (should not receive schedule notification).
- Notification/email service is operational.
- Test environment can observe notifications (email stub/log/event queue).

**Test Data**:

- Author: `A1`

**Steps**:

1. Publish the final schedule (performed by admin/editor or test harness).
2. Record the publish response payload.
2. Inspect notification delivery to `A1` (email stub/log/event queue).
3. Confirm no notification is generated for `A2`.

**Expected Results**:

- System attempts to notify `A1` that the final schedule is available.
- Notification is delivered when the service is available.
- Publish response includes `publishedAt` and `notificationsEnqueuedCount`.
- Notifications are enqueued only for authors with accepted papers.

**Pass/Fail Criteria**:

- PASS if notification is sent/delivered in a verifiable way; FAIL otherwise.

---

## AT-UC18-03 — Delayed Login: Schedule Still Accessible Later (Extension 3a)

**Priority**: Medium  
**Preconditions**:

- Schedule is published.
- Author `A1` does not log in immediately after publication.

**Test Data**:

- Author: `A1`
- Paper: `P1`

**Steps**:

1. After schedule publication, wait/simulate a later session.
2. Log in as `A1`.
3. Navigate to `P1` presentation details.

**Expected Results**:

- Presentation details remain accessible and unchanged.
- No requirement to view within a short time window.

**Pass/Fail Criteria**:

- PASS if schedule details persist and can be viewed later; FAIL otherwise.

---

## AT-UC18-04 — Multiple Accepted Papers: Author Can See Details for Each (Extension 6a)

**Priority**: High  
**Preconditions**:

- Author `A2` has multiple accepted papers: `P2`, `P3`.
- Both are scheduled with distinct time/session/location entries.
- Schedule published.

**Test Data**:

- Author: `A2`
- Papers: `P2`, `P3`

**Steps**:

1. Log in as `A2`.
2. Navigate to “My Submissions.”
3. Open `P2` and note presentation details.
4. Open `P3` and note presentation details.

**Expected Results**:

- System shows presentation details for each accepted paper.
- Details correspond to each paper’s schedule entry (no mix-up).

**Pass/Fail Criteria**:

- PASS if both papers show correct respective schedule details; FAIL otherwise.

---

## AT-UC18-05 — Notification Failure Does Not Block Access (Extension 2a)

**Priority**: High  
**Preconditions**:

- Author `A1` has accepted paper `P1`.
- Schedule published.
- Simulate notification service failure at publish time.
- Database is available.

**Test Data**:

- Author: `A1`
- Paper: `P1`

**Steps**:

1. Publish final schedule while notification service is down.
2. Log in as author `A1`.
3. Navigate to `P1` and view presentation details.

**Expected Results**:

- System logs notification failure (verifiable in test environment logs).
- Author can still view presentation details through CMS.
- No dependency on notification for access.

**Pass/Fail Criteria**:

- PASS if access works without notification; FAIL otherwise.

---

## AT-UC18-06 — Retrieval Error: Show Friendly Error (Extension 7a)

**Priority**: High  
**Preconditions**:

- Schedule is published and `P1` has schedule details.
- Author `A1` logged in.
- Simulate schedule retrieval failure (DB read error/service outage).

**Test Data**:

- Author: `A1`
- Paper: `P1`

**Steps**:

1. Navigate to `P1` presentation details while retrieval failure is active.

**Expected Results**:

- System displays an error indicating schedule details cannot be retrieved at this time.
- Error message includes a short cause category and a clear next step (retry, check connection, or contact support/admin), without internal details.
- Error message may include a “Report issue” option if available.
- Error is logged (verifiable in test environment logs).

**Pass/Fail Criteria**:

- PASS if failure is handled safely with clear messaging; FAIL otherwise.

---

## AT-UC18-07 — Authorization: Author Cannot View Another Author’s Paper Schedule Details

**Priority**: High  
**Preconditions**:

- Author `A1` logged in.
- Paper `P9` exists, accepted, and scheduled, but belongs to different author `A9`.

**Test Data**:

- Paper: `P9` (not owned by `A1`)

**Steps**:

1. As `A1`, attempt to access `P9` schedule details via direct URL or ID guessing.

**Expected Results**:

- System denies access (access denied/403/not found/redirect as implemented).
- Schedule details for `P9` are not displayed.

**Pass/Fail Criteria**:

- PASS if privacy/access control is enforced; FAIL otherwise.

---

## Traceability (UC-18 Paths → Tests)

- **Main Success Scenario (view details)** → AT-UC18-01
- **Extension 3a (delayed login)** → AT-UC18-03
- **Extension 6a (multiple accepted papers)** → AT-UC18-04
- **Extension 2a (notification failure)** → AT-UC18-05
- **Extension 7a (retrieval error)** → AT-UC18-06
- **Notification attempt** → AT-UC18-02
- **Security/authorization** → AT-UC18-07
