const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const {
  createAssignmentRuleValidationService,
} = require("../../src/services/assignment_rule_validation_service");
const { createAssignmentRulesController } = require("../../src/controllers/assignment_rules_controller");

function createHarness({
  workloadReadFails = false,
  initialRules = { requiredReviewerCount: 3, maxReviewerWorkload: 5 },
  sessionRoles = {
    sid_editor: "editor",
    sid_admin: "admin",
    sid_author: "author",
  },
} = {}) {
  const validationFailureLogs = [];
  let rules = { ...initialRules };
  const dataAccess = createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: "C1", title: "Paper 1", status: "submitted", assignedReviewerCount: 0 },
        { id: "P2", conferenceId: "C1", title: "Paper 2", status: "submitted", assignedReviewerCount: 0 },
        { id: "P3", conferenceId: "C1", title: "Paper 3", status: "submitted", assignedReviewerCount: 0 },
        { id: "P4", conferenceId: "C1", title: "Paper 4", status: "submitted", assignedReviewerCount: 0 },
        { id: "P5", conferenceId: "C1", title: "Paper 5", status: "submitted", assignedReviewerCount: 0 },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer One", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R2", name: "Reviewer Two", eligibilityStatus: true, currentAssignmentCount: 2 },
        { id: "R3", name: "Reviewer Three", eligibilityStatus: true, currentAssignmentCount: 3 },
        { id: "R4", name: "Reviewer Four", eligibilityStatus: true, currentAssignmentCount: 4 },
        { id: "R5", name: "Reviewer Five", eligibilityStatus: true, currentAssignmentCount: 5 },
      ],
      assignments: [
        { id: "A_R5_1", conferenceId: "C1", paperId: "BASE_R5_1", reviewerId: "R5" },
        { id: "A_R5_2", conferenceId: "C1", paperId: "BASE_R5_2", reviewerId: "R5" },
        { id: "A_R5_3", conferenceId: "C1", paperId: "BASE_R5_3", reviewerId: "R5" },
        { id: "A_R5_4", conferenceId: "C1", paperId: "BASE_R5_4", reviewerId: "R5" },
        { id: "A_R5_5", conferenceId: "C1", paperId: "BASE_R5_5", reviewerId: "R5" },
      ],
    },
  });

  if (workloadReadFails) {
    dataAccess.listAssignmentsByConference = function throwWorkloadReadFailure() {
      throw new Error("VALIDATION_DEPENDENCY_DOWN");
    };
  }

  const assignmentRuleValidationService = createAssignmentRuleValidationService({
    dataAccess,
    rulesProvider: {
      getCurrentRules() {
        return rules;
      },
    },
    failureLogger: {
      log(entry) {
        validationFailureLogs.push(entry);
      },
    },
  });

  const sessionService = {
    validate(sessionId) {
      const role = sessionRoles[sessionId];
      if (!role) {
        return null;
      }
      return {
        user_id: `u_${sessionId}`,
        role,
      };
    },
  };

  const assignmentRulesController = createAssignmentRulesController({
    assignmentRuleValidationService,
    sessionService,
  });

  function headers(sessionId) {
    return {
      accept: "application/json",
      "content-type": "application/json",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
    };
  }

  async function submitAssignment({ paperId, reviewerIds, sessionId = "sid_editor" } = {}) {
    return assignmentRulesController.handlePostReviewerAssignments({
      headers: headers(sessionId),
      params: { paperId },
      body: { reviewerIds },
    });
  }

  async function getAuditLogs({ sessionId = "sid_admin" } = {}) {
    return assignmentRulesController.handleGetViolationAuditLogs({
      headers: headers(sessionId),
    });
  }

  function assignmentsForPaper(paperId) {
    return dataAccess.getAssignmentsByPaperId(paperId);
  }

  function parsePayload(response) {
    return JSON.parse(response.body);
  }

  function setRules(nextRules) {
    rules = { ...rules, ...nextRules };
  }

  function auditLogs() {
    return dataAccess.listAssignmentViolationAuditLogs();
  }

  return {
    submitAssignment,
    getAuditLogs,
    assignmentsForPaper,
    parsePayload,
    setRules,
    auditLogs,
    validationFailureLogs,
  };
}

test("AT-UC10-01 — Notify on Invalid Reviewer Count (Too Few)", async () => {
  const harness = createHarness();
  const response = await harness.submitAssignment({ paperId: "P1", reviewerIds: ["R1", "R2"] });
  assert.equal(response.status, 422);

  const payload = harness.parsePayload(response);
  assert.equal(payload.violations.length, 1);
  assert.equal(payload.violations[0].rule_name, "Required Reviewer Count");
  assert.equal(payload.violations[0].violation_message.includes("Exactly 3 reviewers"), true);
  assert.equal(typeof payload.violations[0].corrective_action_hint, "string");
  assert.equal(harness.assignmentsForPaper("P1").length, 0);
  assert.equal(harness.auditLogs().length, 1);
});

test("AT-UC10-02 — Notify on Invalid Reviewer Count (Too Many)", async () => {
  const harness = createHarness();
  const response = await harness.submitAssignment({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3", "R4"],
  });
  assert.equal(response.status, 422);

  const payload = harness.parsePayload(response);
  assert.equal(payload.violations.length, 1);
  assert.equal(payload.violations[0].violation_message.includes("Exactly 3 reviewers"), true);
  assert.equal(harness.assignmentsForPaper("P1").length, 0);
  assert.equal(harness.auditLogs().length, 1);
});

test("AT-UC10-03 — Notify on Reviewer Workload Violation", async () => {
  const harness = createHarness();
  const response = await harness.submitAssignment({
    paperId: "P2",
    reviewerIds: ["R1", "R2", "R5"],
  });
  assert.equal(response.status, 422);

  const payload = harness.parsePayload(response);
  assert.equal(payload.violations.length, 1);
  assert.equal(payload.violations[0].rule_name, "Reviewer Workload Limit");
  assert.equal(payload.violations[0].violation_message.includes("R5"), true);
  assert.equal(payload.violations[0].violation_message.includes("(5)"), true);
  assert.equal(harness.assignmentsForPaper("P2").length, 0);
  assert.equal(harness.auditLogs().length, 1);
});

test("AT-UC10-04 — Multiple Violations: Notify All Detected Issues", async () => {
  const harness = createHarness();
  const response = await harness.submitAssignment({
    paperId: "P3",
    reviewerIds: ["R5", "R1"],
  });
  assert.equal(response.status, 422);

  const payload = harness.parsePayload(response);
  assert.equal(payload.violations.length, 2);
  const ruleIds = payload.violations.map((item) => item.violated_rule_id).sort();
  assert.deepEqual(ruleIds, ["required_reviewer_count", "reviewer_workload_limit"]);
  assert.equal(harness.assignmentsForPaper("P3").length, 0);
  assert.equal(harness.auditLogs().length, 2);
});

test("AT-UC10-05 — Correction Loop: Violations Clear After Fixing and Re-Saving", async () => {
  const harness = createHarness();

  const firstAttempt = await harness.submitAssignment({
    paperId: "P2",
    reviewerIds: ["R1", "R2", "R5"],
  });
  assert.equal(firstAttempt.status, 422);

  const secondAttempt = await harness.submitAssignment({
    paperId: "P2",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(secondAttempt.status, 200);

  const payload = harness.parsePayload(secondAttempt);
  assert.equal(payload.assignment_count, 3);
  assert.equal(harness.assignmentsForPaper("P2").length, 3);
  assert.equal(harness.auditLogs().length, 1);
});

test("AT-UC10-06 — Validation Failure: Notify Editor and Block Save", async () => {
  const harness = createHarness({ workloadReadFails: true });
  const response = await harness.submitAssignment({
    paperId: "P4",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(response.status, 503);

  const payload = harness.parsePayload(response);
  assert.equal(payload.message, "Validation cannot be completed now and the assignment is not saved.");
  assert.equal(harness.assignmentsForPaper("P4").length, 0);
  assert.equal(harness.validationFailureLogs.length, 1);
});

test("AT-UC10-07 — Notification Quality: Message Is Clear and Actionable", async () => {
  const harness = createHarness();
  const response = await harness.submitAssignment({
    paperId: "P2",
    reviewerIds: ["R1", "R2", "R5"],
  });
  assert.equal(response.status, 422);

  const payload = harness.parsePayload(response);
  const violation = payload.violations[0];
  assert.equal(typeof violation.rule_name, "string");
  assert.equal(typeof violation.corrective_action_hint, "string");
  assert.equal(violation.corrective_action_hint.length > 0, true);
  assert.equal(violation.violation_message.toLowerCase().includes("stack"), false);
  assert.equal(violation.violation_message.toLowerCase().includes("error code"), false);
});

test("AT-UC10-08 — No Silent Failure: Save Cannot Proceed Without Feedback", async () => {
  const harness = createHarness();
  const response = await harness.submitAssignment({
    paperId: "P1",
    reviewerIds: ["R1", "R2"],
  });
  assert.notEqual(response.status, 200);

  const payload = harness.parsePayload(response);
  const hasViolationFeedback = Array.isArray(payload.violations) && payload.violations.length > 0;
  const hasValidationMessage = typeof payload.message === "string" && payload.message.length > 0;

  assert.equal(hasViolationFeedback || hasValidationMessage, true);
  assert.equal(harness.assignmentsForPaper("P1").length, 0);
});

test("AT-UC10-09 — Repeated Invalid Attempts Re-Validate and Notify", async () => {
  const harness = createHarness();
  const first = await harness.submitAssignment({
    paperId: "P1",
    reviewerIds: ["R1", "R2"],
  });
  const second = await harness.submitAssignment({
    paperId: "P1",
    reviewerIds: ["R1", "R2"],
  });

  assert.equal(first.status, 422);
  assert.equal(second.status, 422);
  assert.equal(harness.parsePayload(first).violations.length > 0, true);
  assert.equal(harness.parsePayload(second).violations.length > 0, true);
  assert.equal(harness.assignmentsForPaper("P1").length, 0);
  assert.equal(harness.auditLogs().length, 2);
});

test("AT-UC10-10 — Rule Changes Between Selection and Save", async () => {
  const harness = createHarness({ initialRules: { requiredReviewerCount: 3, maxReviewerWorkload: 5 } });

  harness.setRules({ requiredReviewerCount: 4 });
  const response = await harness.submitAssignment({
    paperId: "P5",
    reviewerIds: ["R1", "R2", "R3"],
  });

  assert.equal(response.status, 422);
  const payload = harness.parsePayload(response);
  assert.equal(payload.violations.length, 1);
  assert.equal(payload.violations[0].violation_message.includes("Exactly 4 reviewers"), true);
  assert.equal(harness.assignmentsForPaper("P5").length, 0);
});

test("AT-UC10-11 — Audit Log Access Restricted to Admin", async () => {
  const harness = createHarness();
  await harness.submitAssignment({
    paperId: "P1",
    reviewerIds: ["R1", "R2"],
  });

  const editorResponse = await harness.getAuditLogs({ sessionId: "sid_editor" });
  const adminResponse = await harness.getAuditLogs({ sessionId: "sid_admin" });

  assert.equal(editorResponse.status, 403);
  assert.equal(adminResponse.status, 200);

  const payload = harness.parsePayload(adminResponse);
  assert.equal(payload.entries.length > 0, true);
  assert.equal(typeof payload.entries[0].editor_id, "string");
  assert.equal(typeof payload.entries[0].paper_id, "string");
  assert.equal(typeof payload.entries[0].violated_rule_id, "string");
  assert.equal(typeof payload.entries[0].violation_message, "string");
  assert.equal(typeof payload.entries[0].timestamp, "string");
});
