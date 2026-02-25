const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createReviewerSelectionController } = require("../../src/controllers/reviewer_selection_controller");
const { createReviewerAssignmentController } = require("../../src/controllers/reviewer_assignment_controller");
const { countAssignmentsForReviewerConference } = require("../../src/models/workload_count");

const CONFERENCE_ID = "C1";

function createHarness({
  workloadReadFails = false,
  sessionRoleById,
} = {}) {
  const logs = [];
  const dataAccess = createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: CONFERENCE_ID, title: "Paper 1", status: "submitted", assignedReviewerCount: 0 },
        { id: "P2", conferenceId: CONFERENCE_ID, title: "Paper 2", status: "submitted", assignedReviewerCount: 0 },
        { id: "P3", conferenceId: CONFERENCE_ID, title: "Paper 3", status: "submitted", assignedReviewerCount: 0 },
        { id: "P4", conferenceId: CONFERENCE_ID, title: "Paper 4", status: "submitted", assignedReviewerCount: 0 },
        { id: "P5", conferenceId: CONFERENCE_ID, title: "Paper 5", status: "submitted", assignedReviewerCount: 0 },
        { id: "P6", conferenceId: CONFERENCE_ID, title: "Paper 6", status: "submitted", assignedReviewerCount: 0 },
        { id: "P7", conferenceId: CONFERENCE_ID, title: "Paper 7", status: "submitted", assignedReviewerCount: 0 },
        { id: "P8", conferenceId: CONFERENCE_ID, title: "Paper 8", status: "submitted", assignedReviewerCount: 0 },
      ],
      reviewers: [
        { id: "R0", name: "Reviewer Zero", eligibilityStatus: true, currentAssignmentCount: 0 },
        { id: "R2", name: "Reviewer Two", eligibilityStatus: true, currentAssignmentCount: 2 },
        { id: "R4", name: "Reviewer Four", eligibilityStatus: true, currentAssignmentCount: 4 },
        { id: "R5", name: "Reviewer Five", eligibilityStatus: true, currentAssignmentCount: 5 },
      ],
      assignments: [
        { id: "A_R5_1", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_1", reviewerId: "R5" },
        { id: "A_R5_2", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_2", reviewerId: "R5" },
        { id: "A_R5_3", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_3", reviewerId: "R5" },
        { id: "A_R5_4", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_4", reviewerId: "R5" },
        { id: "A_R5_5", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_5", reviewerId: "R5" },
        { id: "A_R4_1", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_1", reviewerId: "R4" },
        { id: "A_R4_2", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_2", reviewerId: "R4" },
        { id: "A_R4_3", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_3", reviewerId: "R4" },
        { id: "A_R4_4", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_4", reviewerId: "R4" },
        { id: "A_R2_1", conferenceId: CONFERENCE_ID, paperId: "BASE_R2_1", reviewerId: "R2" },
        { id: "A_R2_2", conferenceId: CONFERENCE_ID, paperId: "BASE_R2_2", reviewerId: "R2" },
      ],
    },
  });

  if (workloadReadFails) {
    dataAccess.listAssignmentsByConference = function throwReadFailure() {
      throw new Error("DB_READ_FAILURE");
    };
  }

  const sessionService = {
    validate(sessionId) {
      const role = (sessionRoleById && sessionRoleById[sessionId]) || "editor";
      if (!sessionId) {
        return null;
      }
      return { user_id: `u_${sessionId}`, role };
    },
  };

  const workloadLogger = {
    logVerificationFailure(entry) {
      logs.push(entry);
    },
  };

  const reviewerSelectionController = createReviewerSelectionController({
    sessionService,
    dataAccess,
  });
  const reviewerAssignmentController = createReviewerAssignmentController({
    sessionService,
    dataAccess,
    workloadLogger,
  });

  function headers(sessionId) {
    return {
      accept: "application/json",
      "content-type": "application/json",
      cookie: `cms_session=${sessionId}`,
    };
  }

  async function openAssignmentUi({ paperId, sessionId = "sid_editor" } = {}) {
    return reviewerSelectionController.handleGetSelectableReviewers({
      headers: headers(sessionId),
      params: { conference_id: CONFERENCE_ID, paper_id: paperId },
    });
  }

  async function submitAssignment({ paperId, reviewerId, sessionId = "sid_editor" } = {}) {
    return reviewerAssignmentController.handlePostAssignment({
      headers: headers(sessionId),
      params: { conference_id: CONFERENCE_ID, paper_id: paperId },
      body: { reviewer_id: reviewerId },
    });
  }

  function getWorkload(reviewerId) {
    return countAssignmentsForReviewerConference(dataAccess.listAssignmentsByConference(CONFERENCE_ID), {
      reviewerId,
      conferenceId: CONFERENCE_ID,
    });
  }

  function hasAssignment(paperId, reviewerId) {
    return dataAccess
      .getAssignmentsByPaperId(paperId)
      .some((assignment) => assignment.reviewerId === reviewerId);
  }

  return {
    dataAccess,
    logs,
    openAssignmentUi,
    submitAssignment,
    getWorkload,
    hasAssignment,
  };
}

test("AT-UC09-01 — Block Assignment When Reviewer Already Has 5 Papers (Main Success Scenario)", async () => {
  const harness = createHarness();

  const response = await harness.submitAssignment({ paperId: "P1", reviewerId: "R5" });
  assert.equal(response.status, 400);

  const payload = JSON.parse(response.body);
  assert.equal(payload.code, "WORKLOAD_LIMIT_REACHED");
  assert.equal(payload.message.includes("5"), true);
  assert.equal(payload.message.toLowerCase().includes("stack"), false);
  assert.equal(payload.message.includes("R5"), false);
  assert.equal(harness.hasAssignment("P1", "R5"), false);
  assert.equal(harness.getWorkload("R5"), 5);
});

test("AT-UC09-02 — Allow Assignment When Reviewer Has 4 Papers (Extension 3a Boundary)", async () => {
  const harness = createHarness();

  const selection = await harness.openAssignmentUi({ paperId: "P2" });
  assert.equal(selection.status, 200);

  const response = await harness.submitAssignment({ paperId: "P2", reviewerId: "R4" });
  assert.equal(response.status, 201);
  const payload = JSON.parse(response.body);
  assert.equal(payload.paper_id, "P2");
  assert.equal(payload.reviewer_id, "R4");
  assert.equal(harness.hasAssignment("P2", "R4"), true);
  assert.equal(harness.getWorkload("R4"), 5);
});

test("AT-UC09-03 — Allow Assignment When Reviewer Has 0 Papers (Extension 3a)", async () => {
  const harness = createHarness();

  const response = await harness.submitAssignment({ paperId: "P3", reviewerId: "R0" });
  assert.equal(response.status, 201);
  assert.equal(harness.hasAssignment("P3", "R0"), true);
  assert.equal(harness.getWorkload("R0"), 1);
});

test("AT-UC09-04 — Fail Safe When Workload Cannot Be Retrieved (Extension 4a)", async () => {
  const harness = createHarness({ workloadReadFails: true });

  const selection = await harness.openAssignmentUi({ paperId: "P4" });
  assert.equal(selection.status, 400);
  const selectionPayload = JSON.parse(selection.body);
  assert.equal(selectionPayload.code, "WORKLOAD_VERIFICATION_FAILED");

  const response = await harness.submitAssignment({ paperId: "P4", reviewerId: "R2" });
  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.code, "WORKLOAD_VERIFICATION_FAILED");
  assert.equal(payload.message.toLowerCase().includes("stack"), false);
  assert.equal(payload.message.includes("DB_READ_FAILURE"), false);
  assert.equal(harness.logs.length, 1);
  assert.equal(harness.hasAssignment("P4", "R2"), false);
});

test("AT-UC09-05 — No Partial Assignment: Enforcement Applies Per Reviewer Selection", async () => {
  const harness = createHarness();

  const selectable = await harness.openAssignmentUi({ paperId: "P5" });
  assert.equal(selectable.status, 200);
  const selectablePayload = JSON.parse(selectable.body);
  assert.equal(selectablePayload.some((reviewer) => reviewer.reviewer_id === "R5"), false);
  assert.equal(selectablePayload.some((reviewer) => reviewer.reviewer_id === "R2"), true);

  const blocked = await harness.submitAssignment({ paperId: "P5", reviewerId: "R5" });
  assert.equal(blocked.status, 400);
  assert.equal(JSON.parse(blocked.body).code, "WORKLOAD_LIMIT_REACHED");
  assert.equal(harness.hasAssignment("P5", "R5"), false);

  const allowed = await harness.submitAssignment({ paperId: "P5", reviewerId: "R2" });
  assert.equal(allowed.status, 201);
  assert.equal(harness.hasAssignment("P5", "R2"), true);
  assert.equal(harness.getWorkload("R2"), 3);
});

test("AT-UC09-06 — Prevent Exceeding Limit Under Concurrency (Race Condition Check)", async () => {
  const harness = createHarness();

  const [a, b] = await Promise.all([
    harness.submitAssignment({ paperId: "P6", reviewerId: "R4", sessionId: "sid_editor_a" }),
    harness.submitAssignment({ paperId: "P7", reviewerId: "R4", sessionId: "sid_editor_b" }),
  ]);

  const results = [a, b];
  const successes = results.filter((response) => response.status === 201);
  const failures = results.filter((response) => response.status !== 201);

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);

  const failurePayload = JSON.parse(failures[0].body);
  assert.equal(
    failurePayload.code === "WORKLOAD_LIMIT_REACHED" ||
      failurePayload.code === "CONCURRENT_WORKLOAD_CONFLICT",
    true
  );
  assert.equal(failurePayload.message.toLowerCase().includes("workload"), true);
  assert.equal(harness.getWorkload("R4"), 5);
});

test("AT-UC09-07 — Authorization: Only Editors Can Trigger Workload Enforcement via Assignment UI", async () => {
  const harness = createHarness({
    sessionRoleById: { sid_author: "author" },
  });

  const deniedSelection = await harness.openAssignmentUi({ paperId: "P8", sessionId: "sid_author" });
  assert.equal(deniedSelection.status, 403);

  const deniedAssignment = await harness.submitAssignment({
    paperId: "P8",
    reviewerId: "R2",
    sessionId: "sid_author",
  });
  assert.equal(deniedAssignment.status, 403);
  assert.equal(harness.hasAssignment("P8", "R2"), false);
});
