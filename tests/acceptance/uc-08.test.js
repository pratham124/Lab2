const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createNotificationService } = require("../../src/services/notification_service");
const { createAssignmentService } = require("../../src/services/assignment_service");
const { createAssignmentController } = require("../../src/controllers/assignment_controller");

const PAPER_ID = "P1";

function createHarness({
  reviewerOverrides,
  inviterOverride,
  loggerOverride,
  forceSaveFailure = false,
  sessionRole = "editor",
} = {}) {
  const invitationAttempts = [];
  const notificationLogs = [];
  const saveFailureLogs = [];

  const reviewers = reviewerOverrides || [
    { id: "R1", name: "Reviewer One", currentAssignmentCount: 1, eligibilityStatus: true },
    { id: "R2", name: "Reviewer Two", currentAssignmentCount: 2, eligibilityStatus: true },
    { id: "R3", name: "Reviewer Three", currentAssignmentCount: 3, eligibilityStatus: true },
    { id: "R4", name: "Reviewer Four", currentAssignmentCount: 4, eligibilityStatus: true },
    { id: "R5", name: "Reviewer Five", currentAssignmentCount: 5, eligibilityStatus: true },
  ];

  const dataAccess = createDataAccess({
    seed: {
      papers: [
        {
          id: PAPER_ID,
          title: "Deterministic UC-08 Paper",
          status: "submitted",
          assignedReviewerCount: 0,
        },
      ],
      reviewers,
      assignments: [],
    },
  });

  if (forceSaveFailure) {
    const originalCreate = dataAccess.createAssignments;
    dataAccess.createAssignments = function failingCreateAssignments() {
      throw new Error("DB_WRITE_FAILURE");
    };
    dataAccess.__restoreCreateAssignments = () => {
      dataAccess.createAssignments = originalCreate;
    };
  }

  const inviter =
    inviterOverride ||
    {
      async sendInvitation({ reviewer }) {
        invitationAttempts.push(reviewer.id);
      },
    };

  const notificationService = createNotificationService({
    inviter,
    logger:
      loggerOverride ||
      {
        warn(message) {
          notificationLogs.push(message);
        },
      },
  });

  const assignmentService = createAssignmentService({
    dataAccess,
    notificationService,
    failureLogger: {
      log(entry) {
        saveFailureLogs.push(entry);
      },
    },
  });

  const sessionService = {
    validate(sessionId) {
      if (String(sessionId || "") !== "sid_editor" && String(sessionId || "") !== "sid_non_editor") {
        return null;
      }
      if (sessionId === "sid_non_editor") {
        return { user_id: "u_author", role: sessionRole };
      }
      return { user_id: "u_editor", role: "editor" };
    },
  };

  const assignmentController = createAssignmentController({
    assignmentService,
    sessionService,
    dataAccess,
  });

  function jsonHeaders(sessionId) {
    return {
      accept: "application/json",
      "content-type": "application/json",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
    };
  }

  function htmlHeaders(sessionId) {
    return {
      accept: "text/html",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
    };
  }

  async function openAssignmentUi({ sessionId = "sid_editor" } = {}) {
    return assignmentController.handleGetForm({
      headers: htmlHeaders(sessionId),
      params: { paper_id: PAPER_ID },
    });
  }

  async function submitAssignment({ reviewerIds, sessionId = "sid_editor", asJson = true } = {}) {
    return assignmentController.handlePostAssignment({
      headers: asJson ? jsonHeaders(sessionId) : htmlHeaders(sessionId),
      params: { paper_id: PAPER_ID },
      body: {
        reviewer_ids: reviewerIds,
      },
    });
  }

  return {
    dataAccess,
    assignmentController,
    invitationAttempts,
    notificationLogs,
    saveFailureLogs,
    openAssignmentUi,
    submitAssignment,
  };
}

test("AT-UC08-01 — Successful Assignment of 3 Reviewers (Main Success Scenario)", async () => {
  const harness = createHarness();

  const papers = harness.dataAccess.listSubmittedPapers();
  assert.equal(papers.length, 1);
  assert.equal(papers[0].id, PAPER_ID);

  const ui = await harness.openAssignmentUi({ sessionId: "sid_editor" });
  assert.equal(ui.status, 200);

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(response.status, 200);

  const payload = JSON.parse(response.body);
  assert.equal(payload.assignment_count, 3);

  const assignments = harness.dataAccess.getAssignmentsByPaperId(PAPER_ID);
  assert.equal(assignments.length, 3);
  assert.deepEqual(
    assignments.map((item) => item.reviewerId).sort(),
    ["R1", "R2", "R3"]
  );
  assert.deepEqual(harness.invitationAttempts.sort(), ["R1", "R2", "R3"]);
});

test("AT-UC08-02 — Reject Fewer Than 3 Reviewers (Extension 4a)", async () => {
  const harness = createHarness();

  const ui = await harness.openAssignmentUi({ sessionId: "sid_editor" });
  assert.equal(ui.status, 200);

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2"] });
  assert.equal(response.status, 400);

  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "invalid_reviewer_count");
  assert.equal(payload.message, "Exactly 3 reviewers are required.");
  assert.equal(harness.dataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
  assert.equal(harness.invitationAttempts.length, 0);
});

test("AT-UC08-03 — Reject More Than 3 Reviewers (Extension 4a)", async () => {
  const harness = createHarness();

  const ui = await harness.openAssignmentUi({ sessionId: "sid_editor" });
  assert.equal(ui.status, 200);

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R3", "R4"] });
  assert.equal(response.status, 400);

  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "invalid_reviewer_count");
  assert.equal(payload.message, "Exactly 3 reviewers are required.");
  assert.equal(harness.dataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
  assert.equal(harness.invitationAttempts.length, 0);
});

test("AT-UC08-04 — Enforce Reviewer Workload Limit (Extension 5a)", async () => {
  const harness = createHarness();

  const ui = await harness.openAssignmentUi({ sessionId: "sid_editor" });
  assert.equal(ui.status, 200);

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R5"] });
  assert.equal(response.status, 400);

  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "reviewer_workload_exceeded");
  assert.equal(payload.message.includes("maximum workload of 5"), true);
  assert.equal(harness.dataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
  assert.equal(harness.invitationAttempts.length, 0);
});

test("AT-UC08-05 — Boundary Test: Reviewer With 4 Assignments Can Be Assigned a 5th", async () => {
  const harness = createHarness();

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R4"] });
  assert.equal(response.status, 200);

  const payload = JSON.parse(response.body);
  assert.equal(payload.assignment_count, 3);

  const r4 = harness.dataAccess.getReviewerById("R4");
  assert.equal(r4.currentAssignmentCount, 5);
  assert.deepEqual(harness.invitationAttempts.sort(), ["R1", "R2", "R4"]);
});

test("AT-UC08-06 — Handle Notification Failure After Successful Assignment", async () => {
  const notificationLogs = [];
  const harness = createHarness({
    inviterOverride: {
      async sendInvitation() {
        throw new Error("NOTIFICATION_DOWN");
      },
    },
    loggerOverride: {
      warn(message) {
        notificationLogs.push(message);
      },
    },
  });

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(response.status, 200);

  const payload = JSON.parse(response.body);
  assert.equal(payload.assignment_count, 3);
  assert.equal(payload.warningCode, "invitation_partial_failure");
  assert.equal(payload.warningMessage.includes("Assignments were saved"), true);

  const assignments = harness.dataAccess.getAssignmentsByPaperId(PAPER_ID);
  assert.equal(assignments.length, 3);
  assert.equal(notificationLogs.length, 3);
  assert.equal(payload.warningMessage.includes("failed"), true);
});

test("AT-UC08-07 — Handle System/Database Failure During Save (Extension 6a)", async () => {
  const harness = createHarness({ forceSaveFailure: true });

  const response = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(response.status, 500);

  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "assignment_save_failed");
  assert.equal(payload.message, "Could not save reviewer assignments at this time.");
  assert.equal(harness.saveFailureLogs.length, 1);
  assert.equal(harness.dataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
  assert.equal(harness.invitationAttempts.length, 0);
});

test("AT-UC08-08 — Authorization: Non-Editor Cannot Assign Reviewers", async () => {
  const harness = createHarness({ sessionRole: "author" });

  const uiDenied = await harness.openAssignmentUi({ sessionId: "sid_non_editor" });
  assert.equal(uiDenied.status, 403);

  const postDenied = await harness.submitAssignment({
    reviewerIds: ["R1", "R2", "R3"],
    sessionId: "sid_non_editor",
  });
  assert.equal(postDenied.status, 403);

  assert.equal(harness.dataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
  assert.equal(harness.invitationAttempts.length, 0);
});

test("AT-UC08-09 — Prevent Duplicate Assignments on Rapid Confirm/Save", async () => {
  const harness = createHarness();

  const first = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R3"] });
  const second = await harness.submitAssignment({ reviewerIds: ["R1", "R2", "R3"] });

  assert.equal(first.status, 200);
  assert.equal(second.status, 400);

  const secondPayload = JSON.parse(second.body);
  assert.equal(secondPayload.errorCode, "already_assigned");

  const assignments = harness.dataAccess.getAssignmentsByPaperId(PAPER_ID);
  assert.equal(assignments.length, 3);
  const uniqueReviewerIds = new Set(assignments.map((item) => item.reviewerId));
  assert.equal(uniqueReviewerIds.size, 3);

  const inviteCounts = harness.invitationAttempts.reduce((acc, reviewerId) => {
    acc[reviewerId] = (acc[reviewerId] || 0) + 1;
    return acc;
  }, {});

  assert.deepEqual(inviteCounts, {
    R1: 1,
    R2: 1,
    R3: 1,
  });
});
