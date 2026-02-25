const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const { createAssignmentController } = require("../../src/controllers/assignment_controller");
const { parseCookies, getSession, wantsJson, json } = require("../../src/controllers/controller_utils");
const { getValidationError, VALIDATION_ERRORS } = require("../../src/services/validation_errors");
const { createRoutes } = require("../../src/controllers/routes");
const { createPaper } = require("../../src/models/paper");
const { createReviewer } = require("../../src/models/reviewer");
const { createAssignment } = require("../../src/models/assignment");

function makeController({ assignResult, sessionRole, hasPaper = true } = {}) {
  const calls = [];
  const assignmentService = {
    async assignReviewers(input) {
      calls.push(input);
      return (
        assignResult || {
          type: "success",
          paperId: "P1",
          assignmentCount: 3,
        }
      );
    },
  };

  const dataAccess = {
    getPaperById(paperId) {
      if (!hasPaper) {
        return null;
      }
      return { id: paperId || "P1", title: "Paper 1" };
    },
    listEligibleReviewers() {
      return [
        { id: "R1", name: "Rev 1", currentAssignmentCount: 1, eligibilityStatus: true },
        { id: "R2", name: "Rev 2", currentAssignmentCount: 2, eligibilityStatus: true },
      ];
    },
    getAssignmentsByPaperId() {
      return [{ id: "A1", paperId: "P1", reviewerId: "R1" }];
    },
  };

  const sessionService = {
    validate(sessionId) {
      if (sessionId === "sid_editor") {
        return { user_id: "u1", role: "editor" };
      }
      if (sessionId === "sid_user") {
        return { user_id: "u2", role: sessionRole || "author" };
      }
      return null;
    },
  };

  const controller = createAssignmentController({ assignmentService, sessionService, dataAccess });
  return { controller, calls };
}

test("UC-08 models and validation_errors expose expected defaults and fallback branches", () => {
  const paperWithId = createPaper({ id: " P1 " });
  assert.equal(paperWithId.id, "P1");
  assert.equal(paperWithId.status, "submitted");
  const paperDefaults = createPaper();
  assert.equal(paperDefaults.id, "");
  assert.equal(paperDefaults.status, "submitted");
  assert.equal(createPaper({ status: "assigned" }).status, "assigned");
  assert.equal(createPaper({ status: "   " }).status, "submitted");
  assert.equal(createReviewer({ id: "R1", eligibilityStatus: false }).eligibilityStatus, false);
  assert.equal(createReviewer({ id: "R2", eligibilityStatus: "false" }).eligibilityStatus, false);
  assert.equal(createReviewer({ id: "R3", eligibilityStatus: true }).eligibilityStatus, true);
  assert.equal(createReviewer({ id: " R4 " }).id, "R4");
  assert.equal(createReviewer().id, "");
  assert.equal(createReviewer({ eligibilityStatus: "true" }).eligibilityStatus, true);
  assert.equal(createReviewer({ eligibilityStatus: undefined }).eligibilityStatus, true);
  const providedAssignment = createAssignment({ paperId: "P1", reviewerId: "R1" });
  assert.equal(providedAssignment.paperId, "P1");
  assert.equal(providedAssignment.reviewerId, "R1");
  const fallbackAssignment = createAssignment();
  assert.equal(fallbackAssignment.paperId, "");
  assert.equal(fallbackAssignment.reviewerId, "");

  assert.equal(getValidationError("invalidPaper").code, VALIDATION_ERRORS.invalidPaper.code);
  assert.deepEqual(getValidationError("unknown"), { code: "validation_error", message: "Validation error." });
});

test("UC-08 controller_utils covers parseCookies/getSession/wantsJson/json branches", () => {
  const cookies = parseCookies({ cookie: "a=1; cms_session=sid%20editor; bare" });
  assert.equal(cookies.a, "1");
  assert.equal(cookies.cms_session, "sid editor");
  assert.equal(cookies.bare, "");

  const sessionFromUndefinedHeaders = getSession(undefined, { validate: (id) => ({ id }) });
  assert.deepEqual(sessionFromUndefinedHeaders, { id: "" });

  assert.equal(getSession({}, null), null);
  const session = getSession({ cookie: "cms_session=sid_editor" }, { validate: (id) => ({ id }) });
  assert.deepEqual(session, { id: "sid_editor" });

  assert.equal(wantsJson({ accept: "application/json" }), true);
  assert.equal(wantsJson({ "content-type": "application/json" }), true);
  assert.equal(wantsJson({ accept: "text/html" }), false);

  const response = json(201, { ok: true });
  assert.equal(response.status, 201);
  assert.equal(response.headers["Content-Type"], "application/json");
  assert.equal(response.body, JSON.stringify({ ok: true }));
});

test("UC-08 assignment_controller constructor validates required dependencies", () => {
  assert.throws(() => createAssignmentController({ dataAccess: {} }), /assignmentService is required/);
  assert.throws(() => createAssignmentController({ assignmentService: {} }), /dataAccess is required/);
});

test("UC-08 assignment_controller get form covers unauth, forbidden, not found, and success", async () => {
  const { controller } = makeController();

  const unauthJson = await controller.handleGetForm({
    headers: { accept: "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(unauthJson.status, 401);

  const unauthHtml = await controller.handleGetForm({
    headers: { accept: "text/html" },
    params: { paper_id: "P1" },
  });
  assert.equal(unauthHtml.status, 302);

  const { controller: forbiddenController } = makeController({ sessionRole: "author" });
  const forbidden = await forbiddenController.handleGetForm({
    headers: { accept: "text/html", cookie: "cms_session=sid_user" },
    params: { paper_id: "P1" },
  });
  assert.equal(forbidden.status, 403);

  const { controller: missingPaperController } = makeController({ hasPaper: false });
  const missingPaper = await missingPaperController.handleGetForm({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
  });
  assert.equal(missingPaper.status, 404);

  const success = await controller.handleGetForm({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
  });
  assert.equal(success.status, 200);
  assert.equal(success.body.includes("Assign Reviewers"), true);
});

test("UC-08 assignment_controller eligible and assignments endpoints cover auth/not-found/success", async () => {
  const { controller } = makeController();

  const unauth = await controller.handleGetEligibleReviewers({
    headers: {},
    params: { paper_id: "P1" },
  });
  assert.equal(unauth.status, 401);

  const { controller: missingPaperController } = makeController({ hasPaper: false });
  const missingPaper = await missingPaperController.handleGetEligibleReviewers({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
  });
  assert.equal(missingPaper.status, 404);

  const eligible = await controller.handleGetEligibleReviewers({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
  });
  assert.equal(eligible.status, 200);

  const assignments = await controller.handleGetAssignments({
    headers: { cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
  });
  assert.equal(assignments.status, 200);
  assert.equal(JSON.parse(assignments.body).assignments.length, 1);
});

test("UC-08 assignment_controller post covers validation/system/success and reviewer-id normalization branches", async () => {
  const validationResult = {
    type: "validation_error",
    status: 422,
    errorCode: "invalid_reviewer_count",
    message: "Exactly 3 reviewers are required.",
  };
  const { controller: validationController, calls: validationCalls } = makeController({
    assignResult: validationResult,
  });

  const validationJson = await validationController.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: "R1" },
  });
  assert.equal(validationJson.status, 422);
  assert.deepEqual(validationCalls[0].reviewerIds, ["R1"]);

  const validationHtml = await validationController.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: { reviewerIds: ["R1", "R2"] },
  });
  assert.equal(validationHtml.status, 422);
  assert.equal(validationHtml.body.includes("Exactly 3 reviewers are required."), true);

  const systemResult = {
    type: "system_error",
    errorCode: "assignment_save_failed",
    message: "Could not save reviewer assignments at this time.",
  };
  const { controller: systemController, calls: systemCalls } = makeController({ assignResult: systemResult });

  const systemJson = await systemController.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: {},
  });
  assert.equal(systemJson.status, 500);
  assert.deepEqual(systemCalls[0].reviewerIds, []);

  const systemHtml = await systemController.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: {},
  });
  assert.equal(systemHtml.status, 500);

  const successResult = {
    type: "success",
    paperId: "P1",
    assignmentCount: 3,
    warningCode: "invitation_partial_failure",
    warningMessage: "warn",
  };
  const { controller: successController } = makeController({ assignResult: successResult });

  const successJson = await successController.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: ["R1", "R2", "R3"] },
  });
  assert.equal(successJson.status, 200);
  assert.equal(JSON.parse(successJson.body).warningCode, "invitation_partial_failure");

  const successHtml = await successController.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: ["R1", "R2", "R3"] },
  });
  assert.equal(successHtml.status, 200);
  assert.equal(successHtml.body.includes("Reviewers assigned successfully."), true);
});

test("UC-08 assignment_controller covers remaining post/getAssignments auth and missing-paper branches", async () => {
  const { controller } = makeController();

  const postUnauthHtml = await controller.handlePostAssignment({
    headers: { accept: "text/html" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: ["R1", "R2", "R3"] },
  });
  assert.equal(postUnauthHtml.status, 302);
  assert.equal(postUnauthHtml.headers.Location, "/login.html");

  const postForbiddenHtml = await controller.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_user" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: ["R1", "R2", "R3"] },
  });
  assert.equal(postForbiddenHtml.status, 403);
  assert.equal(postForbiddenHtml.body, "Forbidden");

  const postForbiddenJson = await controller.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_user" },
    params: { paper_id: "P1" },
    body: { reviewer_ids: ["R1", "R2", "R3"] },
  });
  assert.equal(postForbiddenJson.status, 403);
  assert.equal(JSON.parse(postForbiddenJson.body).errorCode, "forbidden");

  const getAssignmentsUnauth = await controller.handleGetAssignments({
    headers: { accept: "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(getAssignmentsUnauth.status, 401);
  assert.equal(JSON.parse(getAssignmentsUnauth.body).errorCode, "session_expired");

  const { controller: noPaperController } = makeController({ hasPaper: false });
  const getAssignmentsMissingPaper = await noPaperController.handleGetAssignments({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P1" },
  });
  assert.equal(getAssignmentsMissingPaper.status, 404);
  assert.equal(JSON.parse(getAssignmentsMissingPaper.body).errorCode, "invalid_paper");
});

test("UC-08 assignment_controller covers missing headers/params/body fallback expressions", async () => {
  const validationResult = {
    type: "validation_error",
    errorCode: "invalid_reviewer_count",
    message: "Exactly 3 reviewers are required.",
  };
  const { controller } = makeController({ assignResult: validationResult });

  const postWithMissingParamsAndBody = await controller.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
  });
  assert.equal(postWithMissingParamsAndBody.status, 400);
  assert.equal(JSON.parse(postWithMissingParamsAndBody.body).errorCode, "invalid_reviewer_count");

  const getAssignmentsWithoutHeaders = await controller.handleGetAssignments({
    params: { paper_id: "P1" },
  });
  assert.equal(getAssignmentsWithoutHeaders.status, 401);
  assert.equal(JSON.parse(getAssignmentsWithoutHeaders.body).errorCode, "session_expired");

  const { controller: missingPaperController } = makeController({ hasPaper: false });
  const getAssignmentsWithoutParams = await missingPaperController.handleGetAssignments({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
  });
  assert.equal(getAssignmentsWithoutParams.status, 404);
  assert.equal(JSON.parse(getAssignmentsWithoutParams.body).errorCode, "invalid_paper");
});

test("UC-08 assignment_controller covers c8 branch combos for post/getAssignments line markers", async () => {
  const calls = [];
  const assignmentService = {
    async assignReviewers(input) {
      calls.push(input);
      if (input.paperId === "P_VALIDATION") {
        return {
          type: "validation_error",
          status: 422,
          errorCode: "invalid_reviewer_count",
          message: "Exactly 3 reviewers are required.",
        };
      }
      if (input.paperId === "P_VALIDATION_FALLBACK") {
        return {
          type: "validation_error",
          errorCode: "invalid_reviewer_count",
          message: "Exactly 3 reviewers are required.",
        };
      }
      if (input.paperId === "P_SYSTEM") {
        return {
          type: "system_error",
          errorCode: "assignment_save_failed",
          message: "Could not save reviewer assignments at this time.",
        };
      }
      return {
        type: "success",
        paperId: input.paperId || "P_SUCCESS",
        assignmentCount: 3,
      };
    },
  };

  const dataAccess = {
    getPaperById(paperId) {
      if (!paperId || paperId === "MISSING") {
        return null;
      }
      return { id: paperId, title: paperId };
    },
    listEligibleReviewers() {
      return [{ id: "R1", name: "R1", currentAssignmentCount: 0, eligibilityStatus: true }];
    },
    getAssignmentsByPaperId(paperId) {
      return paperId ? [{ id: "A1", reviewerId: "R1" }] : [];
    },
  };

  const sessionService = {
    validate(id) {
      return id === "sid_editor" ? { user_id: "u1", role: "editor" } : null;
    },
  };

  const controller = createAssignmentController({ assignmentService, sessionService, dataAccess });

  const postValidationJsonByContentType = await controller.handlePostAssignment({
    headers: { "content-type": "application/json", cookie: "cms_session=sid_editor" },
    params: { paperId: "P_VALIDATION" },
    body: { reviewerIds: ["R1"] },
  });
  assert.equal(postValidationJsonByContentType.status, 422);

  const postValidationHtmlWithFallbackStatus = await controller.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P_VALIDATION_FALLBACK" },
    body: { reviewer_ids: ["R1"] },
  });
  assert.equal(postValidationHtmlWithFallbackStatus.status, 400);

  const postSystemJson = await controller.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P_SYSTEM" },
    body: {},
  });
  assert.equal(postSystemJson.status, 500);

  const postSuccessJsonByAccept = await controller.handlePostAssignment({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paperId: "P_SUCCESS_A" },
    body: { reviewer_ids: ["R1"] },
  });
  assert.equal(postSuccessJsonByAccept.status, 200);

  const postSuccessHtml = await controller.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "P_SUCCESS_B" },
    body: { reviewer_ids: ["R1"] },
  });
  assert.equal(postSuccessHtml.status, 200);

  const getAssignmentsPaperIdVariant = await controller.handleGetAssignments({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paperId: "P_ASSIGNMENTS" },
  });
  assert.equal(getAssignmentsPaperIdVariant.status, 200);

  const getAssignmentsMissingExplicit = await controller.handleGetAssignments({
    headers: { accept: "application/json", cookie: "cms_session=sid_editor" },
    params: { paper_id: "MISSING" },
  });
  assert.equal(getAssignmentsMissingExplicit.status, 404);

  assert.equal(calls.some((call) => call.paperId === "P_VALIDATION"), true);
  assert.equal(calls.some((call) => call.paperId === "P_VALIDATION_FALLBACK"), true);
  assert.equal(calls.some((call) => call.paperId === "P_SYSTEM"), true);
});

test("UC-08 assignment_controller covers headers||{} branch sides in validation/system/success/getAssignments", async () => {
  const assignmentService = {
    async assignReviewers({ paperId }) {
      if (paperId === "P_VALIDATION") {
        return {
          type: "validation_error",
          errorCode: "invalid_reviewer_count",
          message: "Exactly 3 reviewers are required.",
        };
      }
      if (paperId === "P_SYSTEM") {
        return {
          type: "system_error",
          errorCode: "assignment_save_failed",
          message: "Could not save reviewer assignments at this time.",
        };
      }
      return {
        type: "success",
        paperId: paperId || "P_SUCCESS",
        assignmentCount: 3,
      };
    },
  };

  const dataAccess = {
    getPaperById(paperId) {
      return paperId ? { id: paperId, title: paperId } : null;
    },
    listEligibleReviewers() {
      return [];
    },
    getAssignmentsByPaperId() {
      return [];
    },
  };

  // Deliberately returns an editor session even for empty/undefined token to exercise headers||{} RHS.
  const sessionService = {
    validate() {
      return { user_id: "u_editor", role: "editor" };
    },
  };

  const controller = createAssignmentController({ assignmentService, sessionService, dataAccess });

  const validationWithUndefinedHeaders = await controller.handlePostAssignment({
    params: { paper_id: "P_VALIDATION" },
    body: {},
  });
  assert.equal(validationWithUndefinedHeaders.status, 400);

  const systemWithUndefinedHeaders = await controller.handlePostAssignment({
    params: { paper_id: "P_SYSTEM" },
    body: {},
  });
  assert.equal(systemWithUndefinedHeaders.status, 500);

  const successWithUndefinedHeaders = await controller.handlePostAssignment({
    params: { paper_id: "P_SUCCESS" },
    body: {},
  });
  assert.equal(successWithUndefinedHeaders.status, 200);

  const assignmentsWithUndefinedHeaders = await controller.handleGetAssignments({
    params: { paper_id: "P_SUCCESS" },
  });
  assert.equal(assignmentsWithUndefinedHeaders.status, 200);
});

test("UC-08 assignment_controller covers get-form/get-eligible default-expression branch markers", async () => {
  const assignmentService = {
    async assignReviewers() {
      return {
        type: "validation_error",
        errorCode: "invalid_reviewer_count",
        message: "Exactly 3 reviewers are required.",
      };
    },
  };

  const dataAccess = {
    getPaperById(paperId) {
      if (paperId === "HAS_TITLE") {
        return { id: paperId, title: "Has Title" };
      }
      if (paperId === "NO_TITLE") {
        return { id: paperId, title: "" };
      }
      return null;
    },
    listEligibleReviewers() {
      return [{ id: "R1", name: "Rev 1", currentAssignmentCount: 0, eligibilityStatus: true }];
    },
    getAssignmentsByPaperId() {
      return [];
    },
  };

  const sessionService = {
    validate() {
      return { user_id: "u_editor", role: "editor" };
    },
  };

  const controller = createAssignmentController({ assignmentService, sessionService, dataAccess });

  // headers undefined -> hits headers||{} paths in handleGetForm (line 90/92), params.paperId path (line 101)
  const getFormNoHeaders = await controller.handleGetForm({
    params: { paperId: "HAS_TITLE" },
  });
  assert.equal(getFormNoHeaders.status, 200);
  assert.equal(getFormNoHeaders.body.includes("Has Title"), true);

  // params missing -> line 101 fallback and not-found branch
  const getFormNoParams = await controller.handleGetForm({
    headers: { accept: "application/json" },
  });
  assert.equal(getFormNoParams.status, 404);

  // handleGetEligibleReviewers with headers undefined + params.paperId branch (line 115/120)
  const eligibleNoHeaders = await controller.handleGetEligibleReviewers({
    params: { paperId: "HAS_TITLE" },
  });
  assert.equal(eligibleNoHeaders.status, 200);

  // line 120 fallback to empty string and not-found
  const eligibleMissingParams = await controller.handleGetEligibleReviewers({
    headers: { accept: "application/json" },
  });
  assert.equal(eligibleMissingParams.status, 404);

  // renderForm with missing paper title path (line 80) and selectedIds fallback (line 66) via HTML validation response.
  const postHtmlValidationNoTitle = await controller.handlePostAssignment({
    headers: { accept: "text/html" },
    params: { paper_id: "NO_TITLE" },
    body: {},
  });
  assert.equal(postHtmlValidationNoTitle.status, 400);
  assert.equal(postHtmlValidationNoTitle.body.includes("Unknown paper"), true);
});

test("UC-08 assignment_controller closes remaining c8 branch markers (20-21,66,92,135)", async () => {
  const assignmentService = {
    async assignReviewers() {
      return {
        type: "validation_error",
        errorCode: "invalid_reviewer_count",
        message: "Exactly 3 reviewers are required.",
      };
    },
  };

  const dataAccess = {
    getPaperById(paperId) {
      if (paperId === "") {
        return { id: "", title: "" };
      }
      if (paperId === "T1") {
        return { id: "T1", title: "Title 1" };
      }
      return null;
    },
    listEligibleReviewers() {
      return [{ id: "R1", name: "Rev 1", currentAssignmentCount: 0, eligibilityStatus: true }];
    },
    getAssignmentsByPaperId() {
      return [];
    },
  };

  const sessionService = {
    validate(token) {
      if (token === "sid_editor") {
        return { user_id: "u_editor", role: "editor" };
      }
      return null;
    },
  };

  const controller = createAssignmentController({ assignmentService, sessionService, dataAccess });

  // line 92: !auth + headers undefined => headers||{} RHS path
  const getFormUnauthNoHeaders = await controller.handleGetForm();
  assert.equal(getFormUnauthNoHeaders.status, 302);

  // line 92: !auth + headers object JSON => wantsJson true path
  const getFormUnauthJson = await controller.handleGetForm({
    headers: { accept: "application/json" },
    params: { paper_id: "T1" },
  });
  assert.equal(getFormUnauthJson.status, 401);

  // line 20/21 fallback sides: empty paperId/title path while still rendering form
  const getFormEmptyValues = await controller.handleGetForm({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "" },
  });
  assert.equal(getFormEmptyValues.status, 200);

  // line 20/21 truthy sides
  const getFormTruthyValues = await controller.handleGetForm({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "T1" },
  });
  assert.equal(getFormTruthyValues.status, 200);
  assert.equal(getFormTruthyValues.body.includes("Title 1"), true);

  // line 135: !auth + headers undefined => headers||{} RHS path
  const postUnauthNoHeaders = await controller.handlePostAssignment({
    params: { paper_id: "T1" },
    body: { reviewer_ids: ["R1"] },
  });
  assert.equal(postUnauthNoHeaders.status, 302);

  // line 135: !auth + headers object JSON => wantsJson true path
  const postUnauthJson = await controller.handlePostAssignment({
    headers: { accept: "application/json" },
    params: { paper_id: "T1" },
    body: { reviewer_ids: ["R1"] },
  });
  assert.equal(postUnauthJson.status, 401);

  // line 66 truthy selectedIds path through HTML validation render
  const postHtmlValidationWithSelectedIds = await controller.handlePostAssignment({
    headers: { accept: "text/html", cookie: "cms_session=sid_editor" },
    params: { paper_id: "T1" },
    body: { reviewer_ids: ["R1"] },
  });
  assert.equal(postHtmlValidationWithSelectedIds.status, 400);
  assert.equal(postHtmlValidationWithSelectedIds.body.includes("checked"), true);
});

test("UC-08 assignment_controller hits remaining c8 falsy branches for line 20 and 66", async () => {
  const assignmentService = {
    async assignReviewers() {
      return {
        type: "validation_error",
        errorCode: "invalid_reviewer_count",
        message: "Exactly 3 reviewers are required.",
      };
    },
  };

  const dataAccess = {
    getPaperById(paperId) {
      if (paperId === "U") {
        return { id: "U", title: undefined };
      }
      return { id: paperId || "P1", title: "Named Paper" };
    },
    listEligibleReviewers() {
      return [{ id: "R1", name: "Rev 1", currentAssignmentCount: 0, eligibilityStatus: true }];
    },
    getAssignmentsByPaperId() {
      return [];
    },
  };

  const sessionService = {
    validate() {
      return { user_id: "u_editor", role: "editor" };
    },
  };

  const controller = createAssignmentController({ assignmentService, sessionService, dataAccess });

  const formWithUndefinedTitle = await controller.handleGetForm({
    headers: { accept: "text/html" },
    params: { paper_id: "U" },
  });
  assert.equal(formWithUndefinedTitle.status, 200);
  assert.equal(formWithUndefinedTitle.body.includes("Unknown paper"), true);

  const postWithNullSelectedId = await controller.handlePostAssignment({
    headers: { accept: "text/html" },
    params: { paper_id: "U" },
    body: { reviewer_ids: [null] },
  });
  assert.equal(postWithNullSelectedId.status, 400);
});

test("UC-08 assignment_controller covers renderTemplate branch when {{paperTitle}} token is absent", async () => {
  const modulePath = require.resolve("../../src/controllers/assignment_controller");
  const originalReadFileSync = fs.readFileSync;

  try {
    fs.readFileSync = function patchedReadFileSync(filePath, encoding) {
      const asString = String(filePath || "");
      if (asString.endsWith("assign_reviewers.html")) {
        return "<html><body>{{paperId}}{{successMessage}}{{errorMessage}}{{warningMessage}}{{reviewerOptions}}</body></html>";
      }
      return originalReadFileSync.call(fs, filePath, encoding);
    };

    delete require.cache[modulePath];
    const { createAssignmentController: createFreshAssignmentController } = require("../../src/controllers/assignment_controller");

    const controller = createFreshAssignmentController({
      assignmentService: {
        async assignReviewers() {
          return { type: "success", paperId: "P1", assignmentCount: 3 };
        },
      },
      sessionService: {
        validate() {
          return { user_id: "u_editor", role: "editor" };
        },
      },
      dataAccess: {
        getPaperById() {
          return { id: "P1", title: "Ignored Title" };
        },
        listEligibleReviewers() {
          return [];
        },
        getAssignmentsByPaperId() {
          return [];
        },
      },
    });

    const response = await controller.handleGetForm({
      headers: { accept: "text/html" },
      params: { paper_id: "P1" },
    });

    assert.equal(response.status, 200);
  } finally {
    fs.readFileSync = originalReadFileSync;
    delete require.cache[modulePath];
    require("../../src/controllers/assignment_controller");
  }
});

test("UC-08 routes cover assignment route predicates, fallbacks, and forwarding", async () => {
  const routesNoController = createRoutes({ submissionController: {}, draftController: {}, decisionController: {} });

  assert.equal(
    routesNoController.isAssignReviewersFormGet({ method: "GET" }, { pathname: "/papers/P1/assign-reviewers" }),
    true
  );
  assert.equal(
    routesNoController.isEligibleReviewersGet({ method: "GET" }, { pathname: "/papers/P1/eligible-reviewers" }),
    true
  );
  assert.equal(
    routesNoController.isAssignReviewersPost({ method: "POST" }, { pathname: "/papers/P1/assign-reviewers" }),
    true
  );
  assert.equal(
    routesNoController.isAssignmentsGet({ method: "GET" }, { pathname: "/papers/P1/assignments" }),
    true
  );

  const notFound = await routesNoController.handleAssignReviewersFormGet(
    { headers: {} },
    { pathname: "/papers/P1/assign-reviewers" }
  );
  assert.equal(notFound.status, 404);

  const notFoundEligible = await routesNoController.handleEligibleReviewersGet(
    { headers: {} },
    { pathname: "/papers/P1/eligible-reviewers" }
  );
  assert.equal(notFoundEligible.status, 404);

  const notFoundPost = await routesNoController.handleAssignReviewersPost(
    { headers: {} },
    { pathname: "/papers/P1/assign-reviewers" },
    { reviewer_ids: ["R1"] }
  );
  assert.equal(notFoundPost.status, 404);

  const notFoundAssignments = await routesNoController.handleAssignmentsGet(
    { headers: {} },
    { pathname: "/papers/P1/assignments" }
  );
  assert.equal(notFoundAssignments.status, 404);

  const forwardedCalls = [];
  const assignmentController = {
    async handleGetForm(input) {
      forwardedCalls.push(["getForm", input]);
      return { status: 200, headers: {}, body: "ok" };
    },
    async handleGetEligibleReviewers(input) {
      forwardedCalls.push(["eligible", input]);
      return { status: 200, headers: {}, body: "ok" };
    },
    async handlePostAssignment(input) {
      forwardedCalls.push(["post", input]);
      return { status: 200, headers: {}, body: "ok" };
    },
    async handleGetAssignments(input) {
      forwardedCalls.push(["assignments", input]);
      return { status: 200, headers: {}, body: "ok" };
    },
  };

  const routes = createRoutes({
    submissionController: {},
    draftController: {},
    decisionController: {},
    assignmentController,
  });

  await routes.handleAssignReviewersFormGet({ headers: { a: 1 } }, { pathname: "/papers/P1/assign-reviewers" });
  await routes.handleEligibleReviewersGet({ headers: { b: 1 } }, { pathname: "/papers/P1/eligible-reviewers" });
  await routes.handleAssignReviewersPost(
    { headers: { c: 1 } },
    { pathname: "/papers/P1/assign-reviewers" },
    { reviewer_ids: ["R1"] }
  );
  await routes.handleAssignmentsGet({ headers: { d: 1 } }, { pathname: "/papers/P1/assignments" });

  assert.equal(forwardedCalls.length, 4);
  assert.equal(forwardedCalls[0][1].params.paper_id, "P1");
  assert.equal(forwardedCalls[2][1].body.reviewer_ids[0], "R1");

  // Force empty paper-id segment so `split()[2] || ""` fallback branches are executed.
  await routes.handleAssignReviewersFormGet(
    { headers: { e: 1 } },
    { pathname: "/papers//assign-reviewers" }
  );
  await routes.handleEligibleReviewersGet(
    { headers: { f: 1 } },
    { pathname: "/papers//eligible-reviewers" }
  );
  await routes.handleAssignReviewersPost(
    { headers: { g: 1 } },
    { pathname: "/papers//assign-reviewers" },
    { reviewer_ids: [] }
  );
  await routes.handleAssignmentsGet(
    { headers: { h: 1 } },
    { pathname: "/papers//assignments" }
  );

  assert.equal(forwardedCalls[4][1].params.paper_id, "");
  assert.equal(forwardedCalls[5][1].params.paper_id, "");
  assert.equal(forwardedCalls[6][1].params.paper_id, "");
  assert.equal(forwardedCalls[7][1].params.paper_id, "");
});
