const test = require("node:test");
const assert = require("node:assert/strict");

const { createAssignedPapersController } = require("../../src/controllers/assigned_papers_controller");
const { createAssignmentService } = require("../../src/services/assignment_service");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createDataAccess } = require("../../src/services/data_access");
const { createSecurityLogService } = require("../../src/services/security_log_service");
const { buildErrorResponse } = require("../../src/services/error_response");
const { createRoutes } = require("../../src/controllers/routes");

function makeSessionService(map = {}) {
  return {
    validate(sessionId) {
      return map[sessionId] || null;
    },
  };
}

function parseBody(response) {
  return JSON.parse(response.body);
}

function buildDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: "P1", title: "Paper 1", status: "submitted" },
        { id: "P2", title: "Paper 2", status: "submitted" },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer 1", eligibilityStatus: true, currentAssignmentCount: 0 },
        { id: "R2", name: "Reviewer 2", eligibilityStatus: true, currentAssignmentCount: 0 },
      ],
      assignments: [{ id: "A1", paperId: "P1", reviewerId: "R1", conferenceId: "C1" }],
      manuscripts: [{ manuscriptId: "M1", paperId: "P1", availability: "available", content: "Body P1" }],
    },
  });
}

test("UC-12 controller constructor requires assignmentService", () => {
  assert.throws(() => createAssignedPapersController(), /assignmentService is required/);
});

test("UC-12 controller handleList default-arg and unauth branch coverage", async () => {
  const controller = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent() {
        return { type: "forbidden" };
      },
    },
    sessionService: makeSessionService(),
  });

  const noArgs = await controller.handleList();
  assert.equal(noArgs.status, 302);

  const unauthJson = await controller.handleList({ headers: { "content-type": "application/json" } });
  assert.equal(unauthJson.status, 401);
});

test("UC-12 controller covers escape/param-fallback branches", async () => {
  const controller = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [{ paperId: "P'1", title: "Paper 'Title'" }];
      },
      getAssignedPaperContent() {
        return {
          type: "success",
          paperId: "P1",
          title: "Paper 'Title'",
          content: "It's content",
          reviewInfo: { viewOnly: true },
        };
      },
    },
    sessionService: makeSessionService({ sid_ok: { user_id: "R1", role: "reviewer" } }),
  });

  const listHtml = await controller.handleList({
    headers: { cookie: "cms_session=sid_ok", accept: "text/html" },
  });
  assert.equal(listHtml.status, 200);
  assert.equal(listHtml.body.includes("Paper &#39;Title&#39;"), true);
  assert.equal(listHtml.body.includes("P&#39;1"), true);

  const unauthJson = await controller.handleView({
    headers: { "content-type": "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(unauthJson.status, 401);

  const successWithMissingParams = await controller.handleView({
    headers: { cookie: "cms_session=sid_ok", accept: "application/json" },
  });
  assert.equal(successWithMissingParams.status, 200);
  assert.equal(parseBody(successWithMissingParams).paperId, "P1");
});

test("UC-12 controller list branches: unauth html/json, success html/json, error html/json", async () => {
  const service = {
    listAssignedPapers() {
      return [{ paperId: "P1", title: "Paper 1" }];
    },
    getAssignedPaperContent() {
      return { type: "forbidden" };
    },
  };
  const sessionService = makeSessionService({ sid_ok: { user_id: "R1", role: "reviewer" } });
  const controller = createAssignedPapersController({ assignmentService: service, sessionService });

  const unauthHtml = await controller.handleList({ headers: { accept: "text/html" } });
  assert.equal(unauthHtml.status, 302);

  const unauthJson = await controller.handleList({ headers: { accept: "application/json" } });
  assert.equal(unauthJson.status, 401);

  const okJson = await controller.handleList({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
  });
  assert.equal(okJson.status, 200);
  assert.deepEqual(parseBody(okJson).items, [{ paperId: "P1", title: "Paper 1" }]);

  const okHtml = await controller.handleList({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
  });
  assert.equal(okHtml.status, 200);
  assert.equal(okHtml.body.includes("/reviewer/assignments/P1"), true);

  const emptyService = {
    listAssignedPapers() {
      return [];
    },
    getAssignedPaperContent() {
      return { type: "forbidden" };
    },
  };
  const emptyController = createAssignedPapersController({
    assignmentService: emptyService,
    sessionService,
  });
  const emptyHtml = await emptyController.handleList({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
  });
  assert.equal(emptyHtml.body.includes("No papers are currently assigned."), true);

  const failingService = {
    listAssignedPapers() {
      throw new Error("LIST_BROKEN");
    },
    getAssignedPaperContent() {
      return { type: "forbidden" };
    },
  };
  const failingController = createAssignedPapersController({
    assignmentService: failingService,
    sessionService,
  });
  const failJson = await failingController.handleList({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
  });
  assert.equal(failJson.status, 500);
  assert.equal(parseBody(failJson).errorCode, "assigned_papers_unavailable");

  const failHtml = await failingController.handleList({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
  });
  assert.equal(failHtml.status, 500);
  assert.equal(failHtml.body.includes("Unable to load assigned papers."), true);
  assert.equal(failHtml.body.includes("/reviewer/assignments"), true);
});

test("UC-12 controller explicit wantsJson branch pairs for success and catch paths", async () => {
  const alwaysSession = makeSessionService({
    any: { user_id: "R1", role: "reviewer" },
  });
  alwaysSession.validate = function validate() {
    return { user_id: "R1", role: "reviewer" };
  };

  const successController = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [{ paperId: "P1", title: "Paper 1" }];
      },
      getAssignedPaperContent() {
        return {
          type: "success",
          paperId: "P1",
          title: "Paper 1",
          content: "Body",
          reviewInfo: { viewOnly: true },
        };
      },
    },
    sessionService: alwaysSession,
  });

  const listJson = await successController.handleList({ headers: { "content-type": "application/json" } });
  assert.equal(listJson.status, 200);
  const listHtml = await successController.handleList({ headers: null });
  assert.equal(listHtml.status, 200);

  const viewJson = await successController.handleView({
    headers: { "content-type": "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(viewJson.status, 200);
  const viewHtml = await successController.handleView({
    headers: null,
    params: { paper_id: "P1" },
  });
  assert.equal(viewHtml.status, 200);

  const failingController = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        throw new Error("LIST_FAIL");
      },
      getAssignedPaperContent() {
        throw new Error("VIEW_FAIL");
      },
    },
    sessionService: alwaysSession,
  });

  const listFailJson = await failingController.handleList({
    headers: { "content-type": "application/json" },
  });
  assert.equal(listFailJson.status, 500);
  const listFailHtml = await failingController.handleList({ headers: null });
  assert.equal(listFailHtml.status, 500);

  const viewFailJson = await failingController.handleView({
    headers: { "content-type": "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(viewFailJson.status, 500);
  const viewFailHtml = await failingController.handleView({
    headers: null,
    params: { paper_id: "P1" },
  });
  assert.equal(viewFailHtml.status, 500);
});

test("UC-12 controller view branches: unauth, forbidden, unavailable, success, catch", async () => {
  const sessionService = makeSessionService({ sid_ok: { user_id: "R1", role: "reviewer" } });
  const baseController = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent({ paperId }) {
        if (paperId === "forbidden") {
          return { type: "forbidden" };
        }
        if (paperId === "missing") {
          return { type: "manuscript_unavailable" };
        }
        return {
          type: "success",
          paperId,
          title: "Paper Title",
          content: "<b>Body</b>",
          reviewInfo: { viewOnly: true },
        };
      },
    },
    sessionService,
  });

  assert.equal(
    (await baseController.handleView({ headers: { accept: "text/html" }, params: { paper_id: "P1" } })).status,
    302
  );
  assert.equal(
    (
      await baseController.handleView({
        headers: { accept: "application/json" },
        params: { paper_id: "P1" },
      })
    ).status,
    401
  );

  const forbiddenJson = await baseController.handleView({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "forbidden" },
  });
  assert.equal(forbiddenJson.status, 403);
  assert.equal(parseBody(forbiddenJson).errorCode, "access_denied");

  const forbiddenHtml = await baseController.handleView({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
    params: { paper_id: "forbidden" },
  });
  assert.equal(forbiddenHtml.status, 403);
  assert.equal(forbiddenHtml.body.includes("Access denied."), true);

  const missingJson = await baseController.handleView({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "missing" },
  });
  assert.equal(missingJson.status, 409);
  assert.equal(parseBody(missingJson).errorCode, "manuscript_unavailable");

  const missingHtml = await baseController.handleView({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
    params: { paper_id: "missing" },
  });
  assert.equal(missingHtml.status, 409);
  assert.equal(missingHtml.body.includes("Manuscript unavailable."), true);

  const okJson = await baseController.handleView({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "P1" },
  });
  assert.equal(okJson.status, 200);
  assert.equal(parseBody(okJson).paperId, "P1");

  const okHtml = await baseController.handleView({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
    params: { paper_id: "P1" },
  });
  assert.equal(okHtml.status, 200);
  assert.equal(okHtml.body.includes("&lt;b&gt;Body&lt;/b&gt;"), true);

  const failingController = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent() {
        throw new Error("VIEW_FAILED");
      },
    },
    sessionService,
  });
  const failJson = await failingController.handleView({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "P1" },
  });
  assert.equal(failJson.status, 500);
  assert.equal(parseBody(failJson).errorCode, "paper_retrieval_failed");

  const failHtml = await failingController.handleView({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
    params: { paper_id: "P1" },
  });
  assert.equal(failHtml.status, 500);
  assert.equal(failHtml.body.includes("Unable to load assigned papers."), true);
});

test("UC-12 controller explicit wantsJson branch pairs for forbidden/unavailable paths", async () => {
  const alwaysSession = makeSessionService();
  alwaysSession.validate = function validate() {
    return { user_id: "R1", role: "reviewer" };
  };

  const forbiddenController = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent() {
        return { type: "forbidden" };
      },
    },
    sessionService: alwaysSession,
  });

  const forbiddenJson = await forbiddenController.handleView({
    headers: { "content-type": "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(forbiddenJson.status, 403);
  const forbiddenHtml = await forbiddenController.handleView({
    headers: null,
    params: { paper_id: "P1" },
  });
  assert.equal(forbiddenHtml.status, 403);

  const unavailableController = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent() {
        return { type: "manuscript_unavailable" };
      },
    },
    sessionService: alwaysSession,
  });

  const unavailableJson = await unavailableController.handleView({
    headers: { "content-type": "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(unavailableJson.status, 409);
  const unavailableHtml = await unavailableController.handleView({
    headers: null,
    params: { paper_id: "P1" },
  });
  assert.equal(unavailableHtml.status, 409);
});

test("UC-12 controller download branches: json and plain text", async () => {
  const controller = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent() {
        return { type: "forbidden" };
      },
    },
    sessionService: makeSessionService(),
  });

  const jsonResponse = await controller.handleDownloadAttempt({ headers: { accept: "application/json" } });
  assert.equal(jsonResponse.status, 404);
  assert.equal(parseBody(jsonResponse).errorCode, "download_not_available");

  const plain = await controller.handleDownloadAttempt({ headers: { accept: "text/plain" } });
  assert.equal(plain.status, 404);
  assert.equal(plain.body, "Download is not available.");

  const plainFromDefaultHeaders = await controller.handleDownloadAttempt();
  assert.equal(plainFromDefaultHeaders.status, 404);
  assert.equal(plainFromDefaultHeaders.body, "Download is not available.");
});

test("UC-12 assignment service listAssignedPapers and getAssignedPaperContent branches", () => {
  const dataAccess = buildDataAccess();
  const authz = createAuthorizationService({ dataAccess });
  const service = createAssignmentService({ dataAccess, authorizationService: authz });

  assert.deepEqual(service.listAssignedPapers({}), []);
  assert.deepEqual(service.listAssignedPapers({ reviewerId: "R2" }), []);
  assert.deepEqual(service.listAssignedPapers({ reviewerId: " R1 " }), [{ paperId: "P1", title: "Paper 1" }]);

  const noListMethodService = createAssignmentService({
    dataAccess: {
      getPaperById() {
        return null;
      },
    },
    authorizationService: authz,
  });
  assert.deepEqual(noListMethodService.listAssignedPapers({ reviewerId: "R1" }), []);

  const nullPaperFilteringService = createAssignmentService({
    dataAccess: {
      listAssignmentsByReviewerId() {
        return [{ paperId: "P_MISSING" }];
      },
      getPaperById() {
        return null;
      },
      getManuscriptByPaperId() {
        return null;
      },
    },
  });
  assert.deepEqual(nullPaperFilteringService.listAssignedPapers({ reviewerId: "R1" }), []);

  assert.deepEqual(service.getAssignedPaperContent({ reviewerId: "", paperId: "P1" }), { type: "forbidden" });
  assert.deepEqual(service.getAssignedPaperContent({ reviewerId: "R1", paperId: "" }), { type: "forbidden" });
  assert.deepEqual(service.getAssignedPaperContent({ reviewerId: "R2", paperId: "P1" }), { type: "forbidden" });

  const noManuscriptMethodService = createAssignmentService({
    dataAccess: {
      getPaperById() {
        return { id: "P1", title: "Paper 1" };
      },
    },
    authorizationService: {
      canAccessAssignedPaper() {
        return true;
      },
    },
  });
  assert.equal(
    noManuscriptMethodService.getAssignedPaperContent({ reviewerId: "R1", paperId: "P1" }).type,
    "manuscript_unavailable"
  );

  const missingPaperService = createAssignmentService({
    dataAccess: {
      getPaperById() {
        return null;
      },
      getManuscriptByPaperId() {
        return { availability: "available", content: "x" };
      },
    },
    authorizationService: {
      canAccessAssignedPaper() {
        return true;
      },
    },
  });
  assert.equal(
    missingPaperService.getAssignedPaperContent({ reviewerId: "R1", paperId: "P1" }).type,
    "manuscript_unavailable"
  );

  const unavailableManuscriptService = createAssignmentService({
    dataAccess: {
      getPaperById() {
        return { id: "P1", title: "Paper 1" };
      },
      getManuscriptByPaperId() {
        return { availability: "unavailable", content: "x" };
      },
    },
    authorizationService: {
      canAccessAssignedPaper() {
        return true;
      },
    },
  });
  assert.equal(
    unavailableManuscriptService.getAssignedPaperContent({ reviewerId: "R1", paperId: "P1" }).type,
    "manuscript_unavailable"
  );

  const ok = service.getAssignedPaperContent({ reviewerId: "R1", paperId: "P1" });
  assert.equal(ok.type, "success");
  assert.equal(ok.reviewInfo.viewOnly, true);

  const defaultAuthzService = createAssignmentService({
    dataAccess: {
      getPaperById() {
        return { id: "P_ANY", title: "Paper Any" };
      },
      getManuscriptByPaperId() {
        return { availability: "available", content: "Body Any" };
      },
    },
    authorizationService: {},
  });
  const defaultAuthzResult = defaultAuthzService.getAssignedPaperContent({
    reviewerId: "R_ANY",
    paperId: "P_ANY",
  });
  assert.equal(defaultAuthzResult.type, "success");
});

test("UC-12 authorization service branches for assigned paper access", () => {
  const logs = [];
  const authzWithoutData = createAuthorizationService({
    securityLogService: {
      logUnauthorizedAccess() {},
      logUnauthorizedPaperAccess(entry) {
        logs.push(entry);
      },
    },
  });

  assert.equal(authzWithoutData.canAccessAssignedPaper({ reviewerId: "", paperId: "" }), false);
  assert.equal(authzWithoutData.canAccessAssignedPaper({ reviewerId: "R1", paperId: "" }), false);
  assert.equal(logs.length, 1);
  assert.equal(authzWithoutData.canAccessAssignedPaper({ reviewerId: "R1", paperId: "P1" }), false);
  assert.equal(logs.length, 2);

  const methodlessDataAuthz = createAuthorizationService({
    dataAccess: {},
    securityLogService: {
      logUnauthorizedAccess() {},
      logUnauthorizedPaperAccess(entry) {
        logs.push(entry);
      },
    },
  });
  assert.equal(methodlessDataAuthz.canAccessAssignedPaper({ reviewerId: "R1", paperId: "P1" }), false);

  const authzWithData = createAuthorizationService({
    dataAccess: {
      isPaperAssignedToReviewer({ reviewerId, paperId }) {
        return reviewerId === "R1" && paperId === "P1";
      },
    },
    securityLogService: {
      logUnauthorizedAccess() {},
      logUnauthorizedPaperAccess(entry) {
        logs.push(entry);
      },
    },
  });
  assert.equal(authzWithData.canAccessAssignedPaper({ reviewerId: "R1", paperId: "P1" }), true);
  assert.equal(authzWithData.canAccessAssignedPaper({ reviewerId: "R2", paperId: "P1" }), false);
});

test("UC-12 data access branches for reviewer assignments and manuscripts", () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }],
      assignments: [{ id: "A1", paperId: "P1", reviewerId: "R1", conferenceId: "C1" }],
      manuscripts: [{ manuscriptId: "M1", paperId: " P1 ", availability: " AVAILABLE ", content: " text " }],
    },
  });

  assert.equal(dataAccess.listAssignmentsByReviewerId("R1").length, 1);
  assert.equal(dataAccess.listAssignmentsByReviewerId("R2").length, 0);
  assert.equal(dataAccess.isPaperAssignedToReviewer({ reviewerId: "R1", paperId: "P1" }), true);
  assert.equal(dataAccess.isPaperAssignedToReviewer({ reviewerId: "R1", paperId: "P2" }), false);
  assert.equal(dataAccess.isPaperAssignedToReviewer({ reviewerId: "", paperId: "P1" }), false);
  assert.equal(dataAccess.isPaperAssignedToReviewer({ reviewerId: "R1", paperId: "" }), false);
  assert.equal(dataAccess.getManuscriptByPaperId("P1").availability, "available");
  assert.equal(dataAccess.getManuscriptByPaperId("missing"), null);
});

test("UC-12 data access manuscript normalization fallback branches", () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [],
      reviewers: [],
      assignments: [],
      manuscripts: [
        {
          paperId: " P2 ",
          manuscriptId: "",
          availability: "",
          content: "",
          version: "",
        },
      ],
    },
  });
  const manuscript = dataAccess.getManuscriptByPaperId("P2");
  assert.equal(manuscript.paperId, "P2");
  assert.equal(manuscript.manuscriptId, "");
  assert.equal(manuscript.availability, "available");
  assert.equal(manuscript.content, "");
  assert.equal(manuscript.version, "");
  assert.equal(dataAccess.listAssignmentsByReviewerId(" R1 ").length, 0);
  assert.equal(dataAccess.getManuscriptByPaperId(" P2 ").paperId, "P2");
});

test("UC-12 error response fallback/default line coverage", () => {
  const defaults = buildErrorResponse();
  assert.equal(defaults.errorCode, "assigned_papers_unavailable");
  assert.equal(defaults.message, "Unable to load assigned papers.");
  assert.equal(defaults.nextStep, "Please try again later.");
  assert.equal(defaults.backLink, "/reviewer/assignments");

  const fallback = buildErrorResponse({
    errorCode: "   ",
    message: "",
    nextStep: " ",
    backLink: "",
  });
  assert.equal(fallback.errorCode, "assigned_papers_unavailable");
  assert.equal(fallback.message, "Unable to load assigned papers.");
  assert.equal(fallback.nextStep, "Please try again later.");
  assert.equal(fallback.backLink, "/reviewer/assignments");

  const explicit = buildErrorResponse({
    errorCode: "paper_retrieval_failed",
    message: "Custom message",
    nextStep: "Custom next step",
    backLink: "/custom",
  });
  assert.equal(explicit.errorCode, "paper_retrieval_failed");
  assert.equal(explicit.nextStep, "Custom next step");

  const nullFallback = buildErrorResponse({
    errorCode: null,
    message: null,
    nextStep: null,
    backLink: null,
  });
  assert.equal(nullFallback.errorCode, "assigned_papers_unavailable");
  assert.equal(nullFallback.nextStep, "Please try again later.");
});

test("UC-12 security log service branches for explicit and fallback logger", () => {
  const entries = [];
  const service = createSecurityLogService({
    logger: {
      warn(line) {
        entries.push(JSON.parse(line));
      },
    },
  });

  service.logUnauthorizedPaperAccess({ userId: " R1 ", paperId: " P1 " });
  assert.equal(entries[0].event, "unauthorized_assigned_paper_access");
  assert.equal(entries[0].user_id, "R1");
  assert.equal(entries[0].paper_id, "P1");
  service.logUnauthorizedPaperAccess();
  assert.equal(entries[1].user_id, "");
  assert.equal(entries[1].paper_id, "");

  const fallback = createSecurityLogService();
  assert.doesNotThrow(() => fallback.logUnauthorizedPaperAccess({ userId: "R2", paperId: "P2" }));
});

test("UC-12 routes guard branches for missing assignedPapersController", async () => {
  const routes = createRoutes({});

  const list = await routes.handleReviewerAssignedPapersList({ headers: {} });
  assert.equal(list.status, 404);

  const view = await routes.handleReviewerAssignedPaperView(
    { headers: {} },
    new URL("http://x/reviewer/assignments/P1")
  );
  assert.equal(view.status, 404);

  const download = await routes.handleReviewerAssignedPaperDownload({ headers: {} });
  assert.equal(download.status, 404);
});

test("UC-12 routes view handler covers paperId fallback extraction", async () => {
  const calls = [];
  const routes = createRoutes({
    assignedPapersController: {
      async handleList() {
        return { status: 200, headers: {}, body: "" };
      },
      async handleView(input) {
        calls.push(input);
        return { status: 200, headers: {}, body: "" };
      },
      async handleDownloadAttempt() {
        return { status: 404, headers: {}, body: "" };
      },
    },
  });

  await routes.handleReviewerAssignedPaperView(
    { headers: { cookie: "x" } },
    new URL("http://x/reviewer/assignments/P1")
  );
  await routes.handleReviewerAssignedPaperView(
    { headers: { cookie: "x" } },
    new URL("http://x/reviewer/assignments/")
  );
  assert.equal(calls[0].params.paper_id, "P1");
  assert.equal(calls[1].params.paper_id, "");
});

test("UC-12 controller default-argument branch for handleView", async () => {
  const controller = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [];
      },
      getAssignedPaperContent() {
        return { type: "forbidden" };
      },
    },
    sessionService: makeSessionService(),
  });
  const response = await controller.handleView();
  assert.equal(response.status, 302);
});

test("UC-12 controller escapeHtml fallback branch with undefined paper fields", async () => {
  const controller = createAssignedPapersController({
    assignmentService: {
      listAssignedPapers() {
        return [{ paperId: undefined, title: undefined }];
      },
      getAssignedPaperContent() {
        return {
          type: "success",
          paperId: "P1",
          title: undefined,
          content: undefined,
          reviewInfo: { viewOnly: true },
        };
      },
    },
    sessionService: makeSessionService({ sid_ok: { user_id: "R1", role: "reviewer" } }),
  });

  const listHtml = await controller.handleList({
    headers: { cookie: "cms_session=sid_ok", accept: "text/html" },
  });
  assert.equal(listHtml.status, 200);
  assert.equal(listHtml.body.includes("/reviewer/assignments/"), true);

  const viewHtml = await controller.handleView({
    headers: { cookie: "cms_session=sid_ok", accept: "text/html" },
    params: { paper_id: "P1" },
  });
  assert.equal(viewHtml.status, 200);
  assert.equal(viewHtml.body.includes("<pre></pre>"), true);
});

test("UC-12 data access branch coverage for missing manuscript paperId and lookups", () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [],
      reviewers: [],
      assignments: [],
      manuscripts: [
        { manuscriptId: "M_EMPTY_KEY", availability: "UNAVAILABLE", content: "x", version: "v2" },
      ],
    },
  });

  assert.equal(dataAccess.getManuscriptByPaperId("").manuscriptId, "M_EMPTY_KEY");
  assert.equal(dataAccess.getManuscriptByPaperId().manuscriptId, "M_EMPTY_KEY");
  assert.equal(dataAccess.getManuscriptByPaperId("").availability, "unavailable");
  assert.equal(dataAccess.listAssignmentsByReviewerId().length, 0);
});

test("UC-12 data access availability normalization covers truthy and fallback paths", () => {
  const dataAccess = createDataAccess({
    seed: {
      manuscripts: [
        { paperId: "P_TRUTHY", availability: "AVAILABLE" },
        { paperId: "P_FALLBACK", availability: "   " },
      ],
    },
  });

  assert.equal(dataAccess.getManuscriptByPaperId("P_TRUTHY").availability, "available");
  assert.equal(dataAccess.getManuscriptByPaperId("P_FALLBACK").availability, "available");
});
