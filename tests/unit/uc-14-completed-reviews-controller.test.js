const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionService } = require("../../src/services/session-service");
const { createCompletedReviewsController } = require("../../src/controllers/completed_reviews_controller");

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

function createHarness({
  paper,
  reviewResult,
  errorLogOverride,
} = {}) {
  const sessionService = createSessionService();
  const session = sessionService.create("editor_1");

  const dataAccess = {
    getPaperById(id) {
      if (!paper) {
        return null;
      }
      if (id === paper.id) {
        return paper;
      }
      return null;
    },
  };

  const reviewService = {
    listCompletedReviews() {
      return reviewResult;
    },
  };

  const errorLog =
    errorLogOverride ||
    {
      recordReviewRetrievalFailure() {
        return "error_123";
      },
    };

  const controller = createCompletedReviewsController({
    sessionService,
    dataAccess,
    reviewService,
    errorLog,
  });

  return { controller, sessionId: session.session_id };
}

test("completed_reviews_controller returns 401 when unauthenticated", async () => {
  const { controller } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(""),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 401);
});

test("completed_reviews_controller requires dataAccess.getPaperById", () => {
  assert.throws(
    () =>
      createCompletedReviewsController({
        sessionService: createSessionService(),
        dataAccess: {},
        reviewService: { listCompletedReviews() { return { type: "success", items: [] }; } },
      }),
    /dataAccess.getPaperById/
  );
});

test("completed_reviews_controller requires reviewService.listCompletedReviews", () => {
  assert.throws(
    () =>
      createCompletedReviewsController({
        sessionService: createSessionService(),
        dataAccess: { getPaperById() { return null; } },
        reviewService: {},
      }),
    /reviewService.listCompletedReviews/
  );
});

test("completed_reviews_controller redirects when unauthenticated for HTML", async () => {
  const { controller } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: htmlHeaders(""),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/login.html");
});

test("completed_reviews_controller validates missing paperId", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(sessionId),
    params: {},
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Paper id is required.");
});

test("completed_reviews_controller renders HTML for missing paperId", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: htmlHeaders(sessionId),
    params: {},
  });

  assert.equal(response.status, 400);
  assert.match(response.body, /Missing Paper/);
});

test("completed_reviews_controller returns 404 when paper missing", async () => {
  const { controller, sessionId } = createHarness({
    paper: null,
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(sessionId),
    params: { paper_id: "P404" },
  });

  assert.equal(response.status, 404);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Paper not found.");
});

test("completed_reviews_controller renders HTML when paper missing", async () => {
  const { controller, sessionId } = createHarness({
    paper: null,
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: htmlHeaders(sessionId),
    params: { paper_id: "P404" },
  });

  assert.equal(response.status, 404);
  assert.match(response.body, /Paper Not Found/);
});

test("completed_reviews_controller denies access for non-assigned editor", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_2", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(sessionId),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 403);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Access denied.");
});

test("completed_reviews_controller renders HTML access denial", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_2", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: htmlHeaders(sessionId),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 403);
  assert.match(response.body, /Access Denied/);
});

test("completed_reviews_controller handles retrieval failure", async () => {
  const errorLogEntries = [];
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "failure", message: "Review retrieval failed.", error: new Error("DB") },
    errorLogOverride: {
      recordReviewRetrievalFailure(payload) {
        errorLogEntries.push(payload);
        return "error_999";
      },
    },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(sessionId),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 500);
  const payload = JSON.parse(response.body);
  assert.equal(payload.errorId, "error_999");
  assert.equal(errorLogEntries.length, 1);
});

test("completed_reviews_controller renders HTML on retrieval failure", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "failure", message: "Review retrieval failed.", error: new Error("DB") },
  });

  const response = await controller.handleGet({
    headers: htmlHeaders(sessionId),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 500);
  assert.match(response.body, /Completed Reviews Unavailable/);
});

test("completed_reviews_controller uses default error log when none provided", async () => {
  const sessionService = createSessionService();
  const session = sessionService.create("editor_1");
  const controller = createCompletedReviewsController({
    sessionService,
    dataAccess: { getPaperById() { return { id: "P1", assignedEditorId: "editor_1", title: "Paper" }; } },
    reviewService: { listCompletedReviews() { return { type: "failure", message: "fail", error: new Error("DB") }; } },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 500);
});

test("completed_reviews_controller returns completed reviews for assigned editor", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "success", items: [{ id: "r1" }] },
  });

  const response = await controller.handleGet({
    headers: jsonHeaders(sessionId),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.completedReviews.length, 1);
});

test("completed_reviews_controller renders empty-state HTML", async () => {
  const { controller, sessionId } = createHarness({
    paper: { id: "P1", assignedEditorId: "editor_1", title: "Paper" },
    reviewResult: { type: "success", items: [] },
  });

  const response = await controller.handleGet({
    headers: htmlHeaders(sessionId),
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 200);
  assert.match(response.body, /No completed reviews are available yet\./);
});
