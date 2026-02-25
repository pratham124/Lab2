const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WorkloadVerificationError,
  countAssignmentsForReviewerConference,
  getReviewerConferenceWorkload,
  isAtOrAboveWorkloadLimit,
} = require("../../src/models/workload_count");
const { createAssignment, createAssignmentWithWorkloadGuard } = require("../../src/models/assignment");
const { listSelectableReviewers } = require("../../src/models/reviewer");
const { paperBelongsToConference } = require("../../src/models/paper");
const { renderSelectableReviewerList } = require("../../src/views/reviewer_selection_view");
const {
  workloadLimitMessage,
  workloadVerificationMessage,
  concurrencyConflictMessage,
  successPayload,
} = require("../../src/views/reviewer_assignment_view");
const { createWorkloadLoggingController } = require("../../src/controllers/logging");
const { createReviewerSelectionController } = require("../../src/controllers/reviewer_selection_controller");
const { createReviewerAssignmentController } = require("../../src/controllers/reviewer_assignment_controller");
const { createDataAccess } = require("../../src/services/data_access");
const { createRoutes } = require("../../src/controllers/routes");

function createSessionService(roleById = {}) {
  return {
    validate(sessionId) {
      if (!sessionId) {
        return null;
      }
      return { id: sessionId, role: roleById[sessionId] || "editor" };
    },
  };
}

test("UC-09 workload_count covers verification error branches and key normalization", async () => {
  await assert.rejects(
    () => getReviewerConferenceWorkload({ reviewerId: "R1", conferenceId: "C1" }),
    (error) => error instanceof WorkloadVerificationError
  );

  await assert.rejects(
    () =>
      getReviewerConferenceWorkload({
        reviewerId: "R1",
        conferenceId: "C1",
        loadAssignments() {
          throw new Error("DB_DOWN");
        },
      }),
    (error) => error instanceof WorkloadVerificationError
  );

  await assert.rejects(
    () =>
      getReviewerConferenceWorkload({
        reviewerId: "R1",
        conferenceId: "C1",
        loadAssignments: async () => ({ not: "an array" }),
      }),
    (error) => error instanceof WorkloadVerificationError
  );

  const count = countAssignmentsForReviewerConference(
    [
      { reviewer_id: "R1", conference_id: "C1" },
      { reviewerId: "R1", conferenceId: "C1" },
      { reviewerId: "R1", conferenceId: "C2" },
    ],
    { reviewerId: "R1", conferenceId: "C1" }
  );
  assert.equal(count, 2);
  assert.equal(isAtOrAboveWorkloadLimit(4, 5), false);
  assert.equal(isAtOrAboveWorkloadLimit(5, 5), true);
  assert.equal(isAtOrAboveWorkloadLimit(undefined, 5), false);
  assert.equal(isAtOrAboveWorkloadLimit(5, 0), true);
});

test("UC-09 assignment model covers createAssignment defaults and guard input validation", async () => {
  const created = createAssignment({ id: " A1 ", paperId: " P1 ", reviewerId: " R1 ", conferenceId: " C1 " });
  assert.equal(created.id, "A1");
  assert.equal(created.paperId, "P1");
  assert.equal(created.reviewerId, "R1");
  assert.equal(created.conferenceId, "C1");

  const fallback = createAssignment();
  assert.equal(typeof fallback.id, "string");
  assert.equal(fallback.paperId, "");
  assert.equal(fallback.reviewerId, "");
  assert.equal(fallback.conferenceId, "");

  await assert.rejects(
    () => createAssignmentWithWorkloadGuard({ persistAssignment: async () => ({}) }),
    /loadAssignments is required/
  );
  await assert.rejects(
    () => createAssignmentWithWorkloadGuard({ loadAssignments: async () => [] }),
    /persistAssignment is required/
  );
});

test("UC-09 assignment model covers all workload guard outcome branches", async () => {
  const firstReadFail = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments() {
      throw new Error("FAIL");
    },
    persistAssignment: async () => ({}),
  });
  assert.equal(firstReadFail.type, "verification_error");

  const limitReached = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments: async () => new Array(5).fill(null).map((_, i) => ({ reviewerId: "R1", conferenceId: "C1", paperId: `P${i}` })),
    persistAssignment: async () => ({}),
  });
  assert.equal(limitReached.type, "limit_error");

  let call = 0;
  const secondReadFail = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments: async () => {
      call += 1;
      if (call === 1) {
        return [{ reviewerId: "R1", conferenceId: "C1" }];
      }
      throw new Error("FAIL_2");
    },
    persistAssignment: async () => ({}),
  });
  assert.equal(secondReadFail.type, "verification_error");

  let secondLimitCall = 0;
  const secondReadLimit = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments: async () => {
      secondLimitCall += 1;
      if (secondLimitCall === 1) {
        return [{ reviewerId: "R1", conferenceId: "C1" }];
      }
      return new Array(5).fill(null).map((_, i) => ({ reviewerId: "R1", conferenceId: "C1", paperId: `P${i}` }));
    },
    persistAssignment: async () => ({}),
  });
  assert.equal(secondReadLimit.type, "concurrency_conflict");

  const persistConflict = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments: async () => [],
    persistAssignment: async () => {
      const error = new Error("conflict");
      error.code = "workload_conflict";
      throw error;
    },
  });
  assert.equal(persistConflict.type, "concurrency_conflict");

  const persistUnknown = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments: async () => [],
    persistAssignment: async () => {
      throw new Error("unknown");
    },
  });
  assert.equal(persistUnknown.type, "verification_error");

  const success = await createAssignmentWithWorkloadGuard({
    reviewerId: "R1",
    conferenceId: "C1",
    paperId: "P1",
    loadAssignments: async () => [{ reviewerId: "R1", conferenceId: "C1" }],
    persistAssignment: async ({ conferenceId, paperId, reviewerId }) => ({
      id: "A1",
      conferenceId,
      paperId,
      reviewerId,
      assignedAt: "2026-02-25T00:00:00.000Z",
    }),
  });
  assert.equal(success.type, "success");
  assert.equal(success.workloadCount, 2);
});

test("UC-09 reviewer/paper/view/logging helpers cover branch behavior", () => {
  const selectable = listSelectableReviewers({
    reviewers: [
      { id: "R1", eligibilityStatus: true },
      { id: "R2", eligibilityStatus: false },
      { id: "R3", eligibilityStatus: true },
    ],
    workloadCountsByReviewerId: { R1: 4, R2: 1, R3: 5 },
    limit: 5,
  });
  assert.deepEqual(
    selectable.map((r) => r.id),
    ["R1"]
  );
  assert.deepEqual(listSelectableReviewers({ reviewers: null }), []);

  assert.equal(paperBelongsToConference(null, "C1"), false);
  assert.equal(paperBelongsToConference({ conferenceId: "C1" }, ""), true);
  assert.equal(paperBelongsToConference({ conferenceId: "" }, "C1"), true);
  assert.equal(paperBelongsToConference({ conferenceId: "C1" }, "C1"), true);
  assert.equal(paperBelongsToConference({ conferenceId: "C2" }, "C1"), false);

  const rendered = renderSelectableReviewerList([{ id: " R1 ", name: " Name " }]);
  assert.deepEqual(rendered, [{ reviewer_id: "R1", name: "Name" }]);
  assert.deepEqual(renderSelectableReviewerList(undefined), []);

  assert.equal(workloadLimitMessage(5).includes("5"), true);
  assert.equal(workloadVerificationMessage().includes("cannot be verified"), true);
  assert.equal(concurrencyConflictMessage(5).includes("5"), true);
  assert.equal(successPayload({ id: " A1 ", reviewerId: " R1 ", paperId: " P1 ", conferenceId: " C1 ", assignedAt: "T" }).assignment_id, "A1");
  assert.equal(typeof successPayload({}).assigned_at, "string");

  const entries = [];
  const logger = createWorkloadLoggingController({
    logger: {
      error(entry) {
        entries.push(entry);
      },
    },
  });
  const entry = logger.logVerificationFailure({ conferenceId: " C1 ", paperId: " P1 ", reviewerId: " R1 ", reason: "" });
  assert.equal(entry.reason, "WORKLOAD_VERIFICATION_FAILED");
  assert.equal(entries.length, 1);

  const originalConsoleError = console.error;
  const consoleEntries = [];
  console.error = (payload) => {
    consoleEntries.push(payload);
  };
  try {
    const defaultLogger = createWorkloadLoggingController({ logger: {} });
    const defaultEntry = defaultLogger.logVerificationFailure();
    assert.equal(defaultEntry.conference_id, "");
    assert.equal(defaultEntry.paper_id, "");
    assert.equal(defaultEntry.reviewer_id, "");
    assert.equal(defaultEntry.reason, "WORKLOAD_VERIFICATION_FAILED");
    assert.equal(consoleEntries.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

test("UC-09 reviewer selection controller covers auth, paper, verification, and success branches", async () => {
  assert.throws(() => createReviewerSelectionController(), /dataAccess is required/);

  const sessionService = createSessionService({ sid_author: "author" });
  const baseDataAccess = {
    getPaperByConferenceAndId(conferenceId, paperId) {
      if (conferenceId === "C1" && paperId === "P1") {
        return { id: "P1", conferenceId: "C1" };
      }
      return null;
    },
    listReviewersByConferenceId() {
      return [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }];
    },
    listAssignmentsByConference() {
      return [];
    },
  };

  const controller = createReviewerSelectionController({ sessionService, dataAccess: baseDataAccess });

  const unauthorized = await controller.handleGetSelectableReviewers({ headers: {}, params: {} });
  assert.equal(unauthorized.status, 401);

  const forbidden = await controller.handleGetSelectableReviewers({
    headers: { cookie: "cms_session=sid_author" },
    params: {},
  });
  assert.equal(forbidden.status, 403);

  const missingPaper = await controller.handleGetSelectableReviewers({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "PX" },
  });
  assert.equal(missingPaper.status, 404);

  const listFailController = createReviewerSelectionController({
    sessionService,
    dataAccess: {
      ...baseDataAccess,
      getPaperByConferenceAndId() {
        return { id: "P1", conferenceId: "C1" };
      },
      listAssignmentsByConference() {
        throw new Error("DB_FAIL");
      },
    },
  });
  const listFail = await listFailController.handleGetSelectableReviewers({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "P1" },
  });
  assert.equal(listFail.status, 400);

  const verifyFailController = createReviewerSelectionController({
    sessionService,
    dataAccess: {
      ...baseDataAccess,
      getPaperByConferenceAndId() {
        return { id: "P1", conferenceId: "C1" };
      },
      listAssignmentsByConference() {
        return { bad: "shape" };
      },
    },
  });
  const verifyFail = await verifyFailController.handleGetSelectableReviewers({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conferenceId: "C1", paperId: "P1" },
  });
  assert.equal(verifyFail.status, 400);

  const ok = await controller.handleGetSelectableReviewers({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conferenceId: "C1", paperId: "P1" },
  });
  assert.equal(ok.status, 200);

  const defaultsController = createReviewerSelectionController({
    sessionService: {
      validate() {
        return { user_id: "u_default", role: "editor" };
      },
    },
    dataAccess: {
      getPaperByConferenceAndId(conferenceId, paperId) {
        if (conferenceId === "" && paperId === "") {
          return { id: "P_EMPTY", conferenceId: "" };
        }
        return null;
      },
      listReviewersByConferenceId() {
        return [{}, { id: "R_OK", name: "Reviewer", eligibilityStatus: true }];
      },
      listAssignmentsByConference() {
        return [];
      },
    },
  });
  const defaultsResponse = await defaultsController.handleGetSelectableReviewers();
  assert.equal(defaultsResponse.status, 200);
});

test("UC-09 reviewer assignment controller covers auth/validation/error/success branches", async () => {
  assert.throws(() => createReviewerAssignmentController(), /dataAccess is required/);

  const logs = [];
  const baseDataAccess = {
    getPaperByConferenceAndId(conferenceId, paperId) {
      return conferenceId === "C1" && paperId ? { id: paperId, conferenceId: "C1" } : null;
    },
    getReviewerById(reviewerId) {
      if (!reviewerId) {
        return null;
      }
      return { id: reviewerId, eligibilityStatus: true };
    },
    listAssignmentsByConference() {
      return [];
    },
    createSingleAssignment({ conferenceId, paperId, reviewerId }) {
      return { id: "A1", conferenceId, paperId, reviewerId, assignedAt: "T" };
    },
  };

  const sessionService = createSessionService({ sid_author: "author" });
  const controller = createReviewerAssignmentController({
    sessionService,
    dataAccess: baseDataAccess,
    workloadLogger: {
      logVerificationFailure(entry) {
        logs.push(entry);
      },
    },
  });

  const unauthorized = await controller.handlePostAssignment({ headers: {}, params: {}, body: {} });
  assert.equal(unauthorized.status, 401);

  const forbidden = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=sid_author" },
    params: {},
    body: {},
  });
  assert.equal(forbidden.status, 403);

  const paperMissing = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "" },
    body: {},
  });
  assert.equal(paperMissing.status, 404);

  const reviewerMissing = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: {},
  });
  assert.equal(reviewerMissing.status, 400);

  const verifyFailController = createReviewerAssignmentController({
    sessionService,
    dataAccess: {
      ...baseDataAccess,
      listAssignmentsByConference() {
        throw new Error("READ_FAIL");
      },
    },
    workloadLogger: {
      logVerificationFailure(entry) {
        logs.push(entry);
      },
    },
  });
  const verifyFail = await verifyFailController.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: { reviewer_id: "R1" },
  });
  assert.equal(verifyFail.status, 400);
  assert.equal(logs.length > 0, true);

  const limitController = createReviewerAssignmentController({
    sessionService,
    dataAccess: {
      ...baseDataAccess,
      listAssignmentsByConference() {
        return new Array(5).fill(null).map((_, i) => ({ reviewerId: "R_LIMIT", conferenceId: "C1", paperId: `P${i}` }));
      },
    },
  });
  const limit = await limitController.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: { reviewerId: "R_LIMIT" },
  });
  assert.equal(limit.status, 400);

  let counter = 0;
  const conflictController = createReviewerAssignmentController({
    sessionService,
    dataAccess: {
      ...baseDataAccess,
      listAssignmentsByConference() {
        counter += 1;
        if (counter === 1) {
          return [{ reviewerId: "R2", conferenceId: "C1", paperId: "P0" }];
        }
        return new Array(5).fill(null).map((_, i) => ({ reviewerId: "R2", conferenceId: "C1", paperId: `P${i}` }));
      },
    },
  });
  const conflict = await conflictController.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: { reviewer_id: "R2" },
  });
  assert.equal(conflict.status, 409);

  const success = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conferenceId: "C1", paperId: "P1" },
    body: { reviewerId: "R3" },
  });
  assert.equal(success.status, 201);

  const undefinedInputController = createReviewerAssignmentController({
    sessionService: {
      validate() {
        return { user_id: "u_auto", role: "editor" };
      },
    },
    dataAccess: baseDataAccess,
  });
  const undefinedInputResponse = await undefinedInputController.handlePostAssignment();
  assert.equal(undefinedInputResponse.status, 404);
});

test("UC-09 reviewer assignment controller covers default workload logger no-op function", async () => {
  const controller = createReviewerAssignmentController({
    sessionService: {
      validate() {
        return { user_id: "u_default", role: "editor" };
      },
    },
    dataAccess: {
      getPaperByConferenceAndId() {
        return { id: "P1", conferenceId: "C1" };
      },
      getReviewerById() {
        return { id: "R1", eligibilityStatus: true };
      },
      listAssignmentsByConference() {
        throw new Error("READ_FAIL");
      },
      createSingleAssignment() {
        throw new Error("unused");
      },
    },
  });

  const response = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: { reviewer_id: "R1" },
  });
  assert.equal(response.status, 400);
  assert.equal(JSON.parse(response.body).code, "WORKLOAD_VERIFICATION_FAILED");
});

test("UC-09 data_access new conference-scoped helpers cover branches", () => {
  const access = createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: "C1", status: "submitted", assignedReviewerCount: 0 },
        { id: "P2", conferenceId: "C2", status: "submitted", assignedReviewerCount: 0 },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer 1", eligibilityStatus: true, currentAssignmentCount: 4 },
        { id: "R2", name: "Reviewer 2", eligibilityStatus: false, currentAssignmentCount: 1 },
      ],
      assignments: [
        { id: "A1", conferenceId: "C1", paperId: "P1", reviewerId: "R1" },
        { id: "A2", paperId: "P2", reviewerId: "R1" },
      ],
    },
  });

  assert.equal(access.getPaperByConferenceAndId("C1", "P1").id, "P1");
  assert.equal(access.getPaperByConferenceAndId("C9", "P1"), null);
  assert.equal(access.getPaperByConferenceAndId("", "P1").id, "P1");

  const c1Assignments = access.listAssignmentsByConference("C1");
  assert.equal(c1Assignments.length, 1);
  const allAssignments = access.listAssignmentsByConference("");
  assert.equal(allAssignments.length >= 2, true);

  assert.throws(
    () => access.createSingleAssignment({ conferenceId: "C1", paperId: "P404", reviewerId: "R1" }),
    (error) => error.code === "invalid_paper"
  );
  assert.throws(
    () => access.createSingleAssignment({ conferenceId: "C1", paperId: "P1", reviewerId: "R2" }),
    (error) => error.code === "ineligible_reviewer"
  );

  const success = access.createSingleAssignment({ conferenceId: "C1", paperId: "P1", reviewerId: "R1" });
  assert.equal(success.paperId, "P1");
  assert.equal(access.getPaperById("P1").status, "assigned");
  assert.equal(access.getReviewerById("R1").currentAssignmentCount, 5);

  const conflictAccess = createDataAccess({
    seed: {
      papers: [{ id: "PC", conferenceId: "C1", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true, currentAssignmentCount: 5 }],
      assignments: [
        { id: "C1", conferenceId: "C1", paperId: "C1P1", reviewerId: "R1" },
        { id: "C2", conferenceId: "C1", paperId: "C1P2", reviewerId: "R1" },
        { id: "C3", conferenceId: "C1", paperId: "C1P3", reviewerId: "R1" },
        { id: "C4", conferenceId: "C1", paperId: "C1P4", reviewerId: "R1" },
        { id: "C5", conferenceId: "C1", paperId: "C1P5", reviewerId: "R1" },
      ],
    },
  });
  assert.throws(
    () => conflictAccess.createSingleAssignment({ conferenceId: "C1", paperId: "PC", reviewerId: "R1" }),
    (error) => error.code === "workload_conflict"
  );

  const fallbackConferenceAccess = createDataAccess({
    seed: {
      papers: [{ id: "PN", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "RN", name: "Reviewer N", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [{ id: "AN1", paperId: "PN", reviewerId: "RN" }],
    },
  });
  assert.equal(fallbackConferenceAccess.getPaperByConferenceAndId("C1", "PN").id, "PN");
  assert.equal(fallbackConferenceAccess.listAssignmentsByConference("C1").length, 0);

  const line89Access = createDataAccess({
    seed: {
      papers: [{ id: "PC1", conferenceId: "C1", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [{ id: "AX", paperId: "PC1", reviewerId: "R1" }],
    },
  });
  assert.equal(line89Access.listAssignmentsByConference("C1").length, 1);

  const normalizedSingleAccess = createDataAccess({
    seed: {
      papers: [{ id: "PS", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "RS", name: "Reviewer S", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });
  const normalizedSingle = normalizedSingleAccess.createSingleAssignment({
    conferenceId: " C1 ",
    paperId: " PS ",
    reviewerId: " RS ",
  });
  assert.equal(normalizedSingle.conferenceId, "C1");
  assert.equal(normalizedSingle.reviewerId, "RS");
});

test("UC-09 routes cover new conference route predicates and handlers", async () => {
  const routesWithoutControllers = createRoutes({});
  assert.equal(
    routesWithoutControllers.isConferenceSelectableReviewersGet(
      { method: "GET" },
      { pathname: "/conferences/C1/papers/P1/reviewers/selectable" }
    ),
    true
  );
  assert.equal(
    routesWithoutControllers.isConferenceAssignmentPost(
      { method: "POST" },
      { pathname: "/conferences/C1/papers/P1/assignments" }
    ),
    true
  );
  assert.equal(
    routesWithoutControllers.isConferenceAssignmentPost(
      { method: "GET" },
      { pathname: "/conferences/C1/papers/P1/assignments" }
    ),
    false
  );

  const missingSelectable = await routesWithoutControllers.handleConferenceSelectableReviewersGet(
    { headers: {} },
    { pathname: "/conferences/C1/papers/P1/reviewers/selectable" }
  );
  assert.equal(missingSelectable.status, 404);

  const missingAssignment = await routesWithoutControllers.handleConferenceAssignmentPost(
    { headers: {} },
    { pathname: "/conferences/C1/papers/P1/assignments" },
    {}
  );
  assert.equal(missingAssignment.status, 404);

  const calls = [];
  const routes = createRoutes({
    reviewerSelectionController: {
      async handleGetSelectableReviewers(input) {
        calls.push({ type: "select", input });
        return { status: 200, headers: {}, body: "[]" };
      },
    },
    reviewerAssignmentController: {
      async handlePostAssignment(input) {
        calls.push({ type: "assign", input });
        return { status: 201, headers: {}, body: "{}" };
      },
    },
  });

  const okSelect = await routes.handleConferenceSelectableReviewersGet(
    { headers: { a: "b" } },
    { pathname: "/conferences/C77/papers/P88/reviewers/selectable" }
  );
  assert.equal(okSelect.status, 200);

  const okAssign = await routes.handleConferenceAssignmentPost(
    { headers: { c: "d" } },
    { pathname: "/conferences/C77/papers/P88/assignments" },
    { reviewer_id: "R1" }
  );
  assert.equal(okAssign.status, 201);

  assert.deepEqual(calls[0].input.params, { conference_id: "C77", paper_id: "P88" });
  assert.deepEqual(calls[1].input.params, { conference_id: "C77", paper_id: "P88" });
  assert.deepEqual(calls[1].input.body, { reviewer_id: "R1" });

  const fallbackSelect = await routes.handleConferenceSelectableReviewersGet(
    { headers: {} },
    { pathname: "/conferences" }
  );
  assert.equal(fallbackSelect.status, 200);

  const fallbackAssign = await routes.handleConferenceAssignmentPost(
    { headers: {} },
    { pathname: "/conferences" },
    {}
  );
  assert.equal(fallbackAssign.status, 201);
  assert.deepEqual(calls[2].input.params, { conference_id: "", paper_id: "" });
  assert.deepEqual(calls[3].input.params, { conference_id: "", paper_id: "" });
});
