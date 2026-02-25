const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");

test("UC-09 data_access createSingleAssignment executes normalization and effectiveConferenceId fallback", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P_LINE", title: "Line Coverage Paper", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R_LINE", name: "Line Reviewer", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });

  const created = access.createSingleAssignment({
    conferenceId: " C_LINE ",
    paperId: " P_LINE ",
    reviewerId: " R_LINE ",
  });

  assert.equal(created.paperId, "P_LINE");
  assert.equal(created.reviewerId, "R_LINE");
  assert.equal(created.conferenceId, "C_LINE");
});

test("UC-09 data_access createSingleAssignment evaluates effectiveConferenceId when paper has conference id", () => {
  const access = createDataAccess({
    seed: {
      papers: [
        {
          id: "P_CONF",
          conferenceId: "C_PAPER",
          title: "Conference-bound Paper",
          status: "submitted",
          assignedReviewerCount: 0,
        },
      ],
      reviewers: [{ id: "R_CONF", name: "Line Reviewer 2", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });

  const created = access.createSingleAssignment({
    conferenceId: "C_PAPER",
    paperId: "P_CONF",
    reviewerId: "R_CONF",
  });

  assert.equal(created.conferenceId, "C_PAPER");
  assert.equal(created.paperId, "P_CONF");
  assert.equal(created.reviewerId, "R_CONF");
});

test("UC-09 data_access createSingleAssignment falls back to empty conference id when both sources are empty", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P_EMPTY_CONF", title: "No Conference Paper", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R_EMPTY_CONF", name: "Reviewer", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });

  const created = access.createSingleAssignment({
    paperId: "P_EMPTY_CONF",
    reviewerId: "R_EMPTY_CONF",
  });

  assert.equal(created.conferenceId, "");
});

test("UC-09 data_access review invitation and notification normalization branches", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R1", name: "Reviewer", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
      reviewInvitations: [{ id: " I1 ", reviewerId: " R1 ", paperId: " P1 ", status: "not-a-status" }],
      notifications: [{ invitationId: " INV_X ", channel: " email ", deliveryStatus: " sent " }],
    },
  });

  assert.equal(access.getReviewInvitationById(" I1 ").id, "I1");
  assert.equal(access.getReviewInvitationById(undefined), null);
  assert.equal(access.listReviewInvitationsByReviewer(" R1 ").length, 1);
  assert.equal(access.listReviewInvitationsByReviewer(undefined).length, 0);

  const updated = access.updateReviewInvitationStatus("I1", {});
  assert.equal(updated.status, "pending");
  assert.equal(updated.respondedAt, null);

  const notifications = access.listNotificationRecords();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].invitationId, "INV_X");
  assert.equal(notifications[0].channel, "email");
  assert.equal(notifications[0].deliveryStatus, "sent");

  updated.status = "";
  const fallbackUpdated = access.updateReviewInvitationStatus("I1", {});
  assert.equal(fallbackUpdated.status, "pending");
});
