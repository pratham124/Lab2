const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const {
  createAssignmentRuleValidationService,
} = require("../../src/services/assignment_rule_validation_service");
const { createAssignmentRulesController } = require("../../src/controllers/assignment_rules_controller");
const { createRoutes } = require("../../src/controllers/routes");

function createUc10DataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: "C1", status: "submitted" },
        { id: "P2", conferenceId: "C1", status: "submitted" },
      ],
      reviewers: [
        { id: "R1", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R2", eligibilityStatus: true, currentAssignmentCount: 2 },
        { id: "R3", eligibilityStatus: true, currentAssignmentCount: 3 },
        { id: "R4", eligibilityStatus: true, currentAssignmentCount: 4 },
        { id: "R5", eligibilityStatus: true, currentAssignmentCount: 5 },
      ],
      assignments: [
        { id: "A_R5_1", conferenceId: "C1", paperId: "B1", reviewerId: "R5" },
        { id: "A_R5_2", conferenceId: "C1", paperId: "B2", reviewerId: "R5" },
        { id: "A_R5_3", conferenceId: "C1", paperId: "B3", reviewerId: "R5" },
        { id: "A_R5_4", conferenceId: "C1", paperId: "B4", reviewerId: "R5" },
        { id: "A_R5_5", conferenceId: "C1", paperId: "B5", reviewerId: "R5" },
      ],
    },
  });
}

test("UC-10 service constructor and helper branches", () => {
  assert.throws(() => createAssignmentRuleValidationService(), /dataAccess is required/);

  const svc = createAssignmentRuleValidationService({ dataAccess: createUc10DataAccess() });
  assert.deepEqual(svc.__test.normalizeReviewerIds(["R1", " R2 ", ""]), ["R1", "R2"]);
  assert.deepEqual(svc.__test.normalizeReviewerIds("R1, R2"), ["R1", "R2"]);
  assert.deepEqual(svc.__test.normalizeReviewerIds(null), []);

  assert.deepEqual(svc.__test.defaultRulesProvider(), {
    requiredReviewerCount: 3,
    maxReviewerWorkload: 5,
  });
  assert.equal(
    svc.__test.buildCountViolation({ requiredCount: 3, providedCount: 2 }).corrective_action_hint,
    "Add 1 more reviewer before saving."
  );
  assert.equal(
    svc.__test.buildCountViolation({ requiredCount: 3, providedCount: 4 }).corrective_action_hint,
    "Remove 1 reviewer before saving."
  );
  assert.equal(
    svc.__test.buildCountViolation({ requiredCount: 4, providedCount: 2 }).corrective_action_hint,
    "Add 2 more reviewers before saving."
  );
  assert.equal(
    svc.__test.buildCountViolation({ requiredCount: 2, providedCount: 4 }).corrective_action_hint,
    "Remove 2 reviewers before saving."
  );
});

test("UC-10 service validateAndSave covers missing-paper and verification-unavailable branches", async () => {
  const logs = [];
  const dataAccess = createUc10DataAccess();
  const svc = createAssignmentRuleValidationService({
    dataAccess,
    failureLogger: { log: (entry) => logs.push(entry) },
  });

  const missing = await svc.validateAndSave({
    paperId: "DOES_NOT_EXIST",
    reviewerIds: ["R1", "R2", "R3"],
    editorId: "u_editor",
  });
  assert.equal(missing.type, "validation_error");
  assert.equal(missing.status, 404);

  dataAccess.listAssignmentsByConference = function failRead() {
    throw new Error("DB_DOWN");
  };
  const unavailable = await svc.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
    editorId: "u_editor",
  });
  assert.equal(unavailable.type, "validation_unavailable");
  assert.equal(unavailable.status, 503);
  assert.equal(logs.length, 1);
});

test("UC-10 service covers default failure logger no-op function", async () => {
  const dataAccess = createUc10DataAccess();
  dataAccess.listAssignmentsByConference = function failRead() {
    throw new Error("READ_FAIL");
  };

  const svc = createAssignmentRuleValidationService({ dataAccess });
  const result = await svc.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
    editorId: "u_editor",
  });
  assert.equal(result.type, "validation_unavailable");
  assert.equal(result.status, 503);
});

test("UC-10 service validateAndSave covers remaining default/error-code branches", async () => {
  const readFailureDataAccess = createUc10DataAccess();
  readFailureDataAccess.listAssignmentsByConference = function failReadWithPlainObject() {
    throw {};
  };
  const readLogs = [];
  const readFailureService = createAssignmentRuleValidationService({
    dataAccess: readFailureDataAccess,
    rulesProvider: { getCurrentRules: () => null },
    failureLogger: { log: (entry) => readLogs.push(entry) },
  });

  const readFailure = await readFailureService.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(readFailure.type, "validation_unavailable");
  assert.equal(readFailure.status, 503);
  assert.equal(readLogs[0].error_code, "UNKNOWN_ERROR");

  const writeFailureDataAccess = createUc10DataAccess();
  writeFailureDataAccess.createAssignments = function failWriteWithPlainObject() {
    throw {};
  };
  const writeLogs = [];
  const writeFailureService = createAssignmentRuleValidationService({
    dataAccess: writeFailureDataAccess,
    rulesProvider: { getCurrentRules: () => null },
    failureLogger: { log: (entry) => writeLogs.push(entry) },
  });

  const writeFailure = await writeFailureService.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(writeFailure.type, "validation_unavailable");
  assert.equal(writeFailure.status, 503);
  assert.equal(writeLogs[0].error_code, "UNKNOWN_ERROR");

  const blankConferenceDataAccess = createDataAccess({
    seed: {
      papers: [{ id: "PX", status: "submitted" }],
      reviewers: [
        { id: "R1", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R5", eligibilityStatus: true, currentAssignmentCount: 5 },
      ],
      assignments: [
        { id: "X1", conferenceId: "C1", paperId: "B1", reviewerId: "R5" },
        { id: "X2", conferenceId: "C1", paperId: "B2", reviewerId: "R5" },
        { id: "X3", conferenceId: "C1", paperId: "B3", reviewerId: "R5" },
        { id: "X4", conferenceId: "C1", paperId: "B4", reviewerId: "R5" },
        { id: "X5", conferenceId: "C1", paperId: "B5", reviewerId: "R5" },
      ],
    },
  });
  const blankConferenceService = createAssignmentRuleValidationService({
    dataAccess: blankConferenceDataAccess,
    rulesProvider: { getCurrentRules: () => null },
  });

  const violations = await blankConferenceService.validateAndSave({
    paperId: " PX ",
    reviewerIds: ["R1", "R5"],
  });
  assert.equal(violations.type, "violations");
  assert.equal(violations.violations.length, 2);
  const auditEntries = blankConferenceDataAccess.listAssignmentViolationAuditLogs();
  assert.equal(auditEntries.length, 2);
  assert.equal(auditEntries[0].editor_id, "");

  const defaultInputResult = await blankConferenceService.validateAndSave();
  assert.equal(defaultInputResult.type, "validation_error");
  assert.equal(defaultInputResult.status, 404);

  const fallbackReviewerFieldDataAccess = createDataAccess({
    seed: {
      papers: [{ id: "PZ", conferenceId: "C1", status: "submitted" }],
      reviewers: [
        { id: "R1", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R5", eligibilityStatus: true, currentAssignmentCount: 5 },
      ],
      assignments: [
        { id: "MISSING_REVIEWER_ID", conferenceId: "C1", paperId: "B0" },
        { id: "R5A1", conferenceId: "C1", paperId: "B1", reviewerId: "R5" },
        { id: "R5A2", conferenceId: "C1", paperId: "B2", reviewerId: "R5" },
        { id: "R5A3", conferenceId: "C1", paperId: "B3", reviewerId: "R5" },
        { id: "R5A4", conferenceId: "C1", paperId: "B4", reviewerId: "R5" },
        { id: "R5A5", conferenceId: "C1", paperId: "B5", reviewerId: "R5" },
      ],
    },
  });
  const fallbackReviewerFieldService = createAssignmentRuleValidationService({
    dataAccess: fallbackReviewerFieldDataAccess,
  });
  const fallbackReviewerFieldResult = await fallbackReviewerFieldService.validateAndSave({
    paperId: "PZ",
    reviewerIds: ["R1", "R5"],
  });
  assert.equal(fallbackReviewerFieldResult.type, "violations");
  assert.equal(fallbackReviewerFieldResult.violations.length, 2);
});

test("UC-10 service validateAndSave covers violations, success, and create-assignments failure", async () => {
  const dataAccess = createUc10DataAccess();
  const svc = createAssignmentRuleValidationService({ dataAccess });

  const multiViolation = await svc.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R5"],
    editorId: "u_editor",
  });
  assert.equal(multiViolation.type, "violations");
  assert.equal(multiViolation.status, 422);
  assert.equal(multiViolation.violations.length, 2);
  assert.equal(dataAccess.listAssignmentViolationAuditLogs().length, 2);
  assert.equal(dataAccess.listAssignmentViolationAuditLogs()[0].editor_id, "u_editor");

  const success = await svc.validateAndSave({
    paperId: "P2",
    reviewerIds: ["R1", "R2", "R3"],
    editorId: "u_editor",
  });
  assert.equal(success.type, "success");
  assert.equal(success.assignmentCount, 3);
  assert.equal(dataAccess.getAssignmentsByPaperId("P2").length, 3);

  const failingDataAccess = createUc10DataAccess();
  failingDataAccess.createAssignments = function failWrite() {
    throw new Error("WRITE_DOWN");
  };
  const failureLogs = [];
  const failingSvc = createAssignmentRuleValidationService({
    dataAccess: failingDataAccess,
    failureLogger: { log: (entry) => failureLogs.push(entry) },
  });
  const writeUnavailable = await failingSvc.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
    editorId: "u_editor",
  });
  assert.equal(writeUnavailable.type, "validation_unavailable");
  assert.equal(writeUnavailable.status, 503);
  assert.equal(failureLogs.length, 1);
});

test("UC-10 service validateAndSave covers skip branch for missing/ineligible reviewers", async () => {
  const dataAccess = createUc10DataAccess();
  const logs = [];
  const svc = createAssignmentRuleValidationService({
    dataAccess,
    failureLogger: { log: (entry) => logs.push(entry) },
  });

  const result = await svc.validateAndSave({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "DOES_NOT_EXIST"],
    editorId: "u_editor",
  });
  assert.equal(result.type, "validation_unavailable");
  assert.equal(result.status, 503);
  assert.equal(logs.length, 1);
});

test("UC-10 service listViolationAuditLogs and data_access audit helpers cover normalization/copy branches", () => {
  const dataAccess = createUc10DataAccess();
  dataAccess.addAssignmentViolationAuditLog({
    editor_id: " u_editor ",
    paper_id: " P1 ",
    violated_rule_id: " rule_id ",
    violation_message: " message ",
    timestamp: " 2026-02-25T00:00:00.000Z ",
  });

  const fromDataAccess = dataAccess.listAssignmentViolationAuditLogs();
  assert.equal(fromDataAccess.length, 1);
  assert.deepEqual(fromDataAccess[0], {
    editor_id: "u_editor",
    paper_id: "P1",
    violated_rule_id: "rule_id",
    violation_message: "message",
    timestamp: "2026-02-25T00:00:00.000Z",
  });

  fromDataAccess.push({ mutated: true });
  assert.equal(dataAccess.listAssignmentViolationAuditLogs().length, 1);

  const svc = createAssignmentRuleValidationService({ dataAccess });
  assert.equal(svc.listViolationAuditLogs().length, 1);

  dataAccess.addAssignmentViolationAuditLog();
  const logsAfterEmpty = dataAccess.listAssignmentViolationAuditLogs();
  assert.deepEqual(logsAfterEmpty[1], {
    editor_id: "",
    paper_id: "",
    violated_rule_id: "",
    violation_message: "",
    timestamp: "",
  });
});

test("UC-10 controller constructor and auth branches", async () => {
  assert.throws(() => createAssignmentRulesController(), /assignmentRuleValidationService is required/);

  const controller = createAssignmentRulesController({
    assignmentRuleValidationService: {
      async validateAndSave() {
        return { type: "success", paperId: "P1", assignmentCount: 3 };
      },
      listViolationAuditLogs() {
        return [];
      },
    },
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_editor") {
          return { user_id: "u_editor", role: "editor" };
        }
        if (sessionId === "sid_admin") {
          return { user_id: "u_admin", role: "admin" };
        }
        if (sessionId === "sid_author") {
          return { user_id: "u_author", role: "author" };
        }
        return null;
      },
    },
  });

  const unauthPost = await controller.handlePostReviewerAssignments({
    headers: { accept: "application/json" },
    params: { paperId: "P1" },
    body: { reviewerIds: ["R1", "R2", "R3"] },
  });
  assert.equal(unauthPost.status, 401);

  const forbiddenPost = await controller.handlePostReviewerAssignments({
    headers: { cookie: "cms_session=sid_author" },
    params: { paperId: "P1" },
    body: { reviewerIds: ["R1", "R2", "R3"] },
  });
  assert.equal(forbiddenPost.status, 403);

  const forbiddenLogs = await controller.handleGetViolationAuditLogs({
    headers: { cookie: "cms_session=sid_editor" },
  });
  assert.equal(forbiddenLogs.status, 403);
});

test("UC-10 controller handlePostReviewerAssignments covers payload normalization and all result branches", async () => {
  const calls = [];
  const results = [
    { type: "success", paperId: "P1", assignmentCount: 3 },
    { type: "violations", violations: [{ violated_rule_id: "r1" }] },
    { type: "validation_unavailable", message: "Validation cannot be completed now and the assignment is not saved." },
    { type: "validation_error", status: 409, errorCode: "x", message: "y" },
  ];
  const controller = createAssignmentRulesController({
    assignmentRuleValidationService: {
      async validateAndSave(input) {
        calls.push(input);
        return results.shift();
      },
      listViolationAuditLogs() {
        return [{ id: "log1" }];
      },
    },
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_editor") {
          return { user_id: "u_editor", role: "editor" };
        }
        if (sessionId === "sid_admin") {
          return { user_id: "u_admin", role: "admin" };
        }
        return null;
      },
    },
  });

  const ok = await controller.handlePostReviewerAssignments({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paperId: "P1" },
    body: { reviewerIds: ["R1", "R2", "R3"] },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls[0].reviewerIds, ["R1", "R2", "R3"]);

  const violations = await controller.handlePostReviewerAssignments({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: ["R1", "R2"] },
  });
  assert.equal(violations.status, 422);
  assert.deepEqual(calls[1].reviewerIds, ["R1", "R2"]);

  const unavailable = await controller.handlePostReviewerAssignments({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paperId: "P1" },
    body: { reviewerIds: "R1" },
  });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(calls[2].reviewerIds, ["R1"]);

  const fallback = await controller.handlePostReviewerAssignments({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paperId: "P1" },
    body: {},
  });
  assert.equal(fallback.status, 409);
  assert.deepEqual(calls[3].reviewerIds, []);

  const logs = await controller.handleGetViolationAuditLogs({
    headers: { cookie: "cms_session=sid_admin" },
  });
  assert.equal(logs.status, 200);
  assert.equal(JSON.parse(logs.body).entries.length, 1);
});

test("UC-10 controller fallback/default argument branches are covered", async () => {
  let receivedInput = null;
  const controller = createAssignmentRulesController({
    assignmentRuleValidationService: {
      async validateAndSave(input) {
        receivedInput = input;
        return {};
      },
      listViolationAuditLogs() {
        return [];
      },
    },
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_editor") {
          return { user_id: "u_editor", role: "editor" };
        }
        return null;
      },
    },
  });

  const fallback = await controller.handlePostReviewerAssignments({
    headers: { cookie: "cms_session=sid_editor" },
  });
  assert.equal(fallback.status, 400);
  assert.deepEqual(JSON.parse(fallback.body), {
    errorCode: "validation_error",
    message: "Validation error.",
  });
  assert.deepEqual(receivedInput, {
    paperId: "",
    reviewerIds: [],
    editorId: "u_editor",
  });

  const unauthLogs = await controller.handleGetViolationAuditLogs();
  assert.equal(unauthLogs.status, 401);

  const unauthPostNoArgs = await controller.handlePostReviewerAssignments();
  assert.equal(unauthPostNoArgs.status, 401);
});

test("UC-10 routes cover new matcher and handler branches", async () => {
  const routesWithoutController = createRoutes({});
  assert.equal(
    routesWithoutController.isReviewerAssignmentsPost(
      { method: "POST" },
      { pathname: "/papers/P1/reviewer-assignments" }
    ),
    true
  );
  assert.equal(
    routesWithoutController.isReviewerAssignmentsPost(
      { method: "GET" },
      { pathname: "/papers/P1/reviewer-assignments" }
    ),
    false
  );
  assert.equal(
    routesWithoutController.isViolationAuditLogsGet(
      { method: "GET" },
      { pathname: "/assignment-violations/audit-logs" }
    ),
    true
  );
  assert.equal(
    routesWithoutController.isViolationAuditLogsGet(
      { method: "GET" },
      { pathname: "/assignment-violations/other" }
    ),
    false
  );

  const missingPost = await routesWithoutController.handleReviewerAssignmentsPost(
    { headers: {} },
    { pathname: "/papers/P1/reviewer-assignments" },
    { reviewerIds: ["R1", "R2", "R3"] }
  );
  assert.equal(missingPost.status, 404);

  const missingLogs = await routesWithoutController.handleViolationAuditLogsGet({ headers: {} });
  assert.equal(missingLogs.status, 404);

  const forwarded = [];
  const routesWithController = createRoutes({
    assignmentRulesController: {
      async handlePostReviewerAssignments(input) {
        forwarded.push(["post", input]);
        return { status: 200, headers: {}, body: "ok" };
      },
      async handleGetViolationAuditLogs(input) {
        forwarded.push(["logs", input]);
        return { status: 200, headers: {}, body: "ok" };
      },
    },
  });

  const post = await routesWithController.handleReviewerAssignmentsPost(
    { headers: { a: 1 } },
    { pathname: "/papers/P42/reviewer-assignments" },
    { reviewerIds: ["R1", "R2", "R3"] }
  );
  assert.equal(post.status, 200);
  assert.equal(forwarded[0][0], "post");
  assert.equal(forwarded[0][1].params.paperId, "P42");

  const postWithEmptyPaper = await routesWithController.handleReviewerAssignmentsPost(
    { headers: { c: 1 } },
    { pathname: "/papers//reviewer-assignments" },
    { reviewerIds: ["R1"] }
  );
  assert.equal(postWithEmptyPaper.status, 200);
  assert.equal(forwarded[1][0], "post");
  assert.equal(forwarded[1][1].params.paperId, "");

  const logs = await routesWithController.handleViolationAuditLogsGet({ headers: { b: 1 } });
  assert.equal(logs.status, 200);
  assert.equal(forwarded[2][0], "logs");
});
