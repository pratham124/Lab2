const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createAssignmentService } = require("../../src/services/assignment_service");
const { createAssignedPapersController } = require("../../src/controllers/assigned_papers_controller");

function createSessionService(sessionMap = {}) {
  return {
    validate(sessionId) {
      return sessionMap[sessionId] || null;
    },
  };
}

function buildUc12Harness() {
  const dataAccess = createDataAccess({
    seed: {
      papers: [
        { id: "P1", title: "Assigned Paper 1", status: "submitted" },
        { id: "P2", title: "Assigned Paper 2", status: "submitted" },
        { id: "P3", title: "Assigned Paper 3", status: "submitted" },
        { id: "P9", title: "Unassigned Paper 9", status: "submitted" },
        { id: "P10", title: "Assigned Paper Missing Manuscript", status: "submitted" },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer 1", eligibilityStatus: true },
        { id: "R2", name: "Reviewer 2", eligibilityStatus: true },
        { id: "R3", name: "Reviewer 3", eligibilityStatus: true },
      ],
      assignments: [
        { id: "A1", paperId: "P1", reviewerId: "R1", conferenceId: "C1" },
        { id: "A2", paperId: "P2", reviewerId: "R1", conferenceId: "C1" },
        { id: "A3", paperId: "P3", reviewerId: "R1", conferenceId: "C1" },
        { id: "A4", paperId: "P10", reviewerId: "R1", conferenceId: "C1" },
      ],
      manuscripts: [
        { manuscriptId: "M1", paperId: "P1", availability: "available", content: "Manuscript P1 Body" },
        { manuscriptId: "M2", paperId: "P2", availability: "available", content: "Manuscript P2 Body" },
        { manuscriptId: "M3", paperId: "P3", availability: "available", content: "Manuscript P3 Body" },
        { manuscriptId: "M9", paperId: "P9", availability: "available", content: "Manuscript P9 Body" },
        { manuscriptId: "M10", paperId: "P10", availability: "unavailable", content: "" },
      ],
    },
  });

  const authorizationService = createAuthorizationService({ dataAccess });
  const service = createAssignmentService({ dataAccess, authorizationService });
  const controller = createAssignedPapersController({
    assignmentService: service,
    sessionService: createSessionService({
      sid_r1: { user_id: "R1", role: "reviewer" },
      sid_r2: { user_id: "R2", role: "reviewer" },
      sid_r3: { user_id: "R3", role: "reviewer" },
    }),
  });

  return {
    dataAccess,
    service,
    controller,
  };
}

function parseJsonBody(response) {
  return JSON.parse(response.body);
}

test("AT-UC12-01 - View Assigned Papers List (Main Success Scenario)", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
  });

  assert.equal(response.status, 200);
  const payload = parseJsonBody(response);
  assert.deepEqual(
    payload.items.map((item) => item.paperId),
    ["P1", "P2", "P3", "P10"]
  );
  assert.equal(payload.items.every((item) => typeof item.title === "string" && item.title.length > 0), true);
  assert.equal(
    payload.items.every((item) => Object.keys(item).sort().join(",") === "paperId,title"),
    true
  );
});

test("AT-UC12-02 - Open an Assigned Paper and View Content (Main Success Scenario)", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleView({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
    params: { paper_id: "P1" },
  });

  assert.equal(response.status, 200);
  const payload = parseJsonBody(response);
  assert.equal(payload.paperId, "P1");
  assert.equal(payload.title, "Assigned Paper 1");
  assert.equal(payload.content, "Manuscript P1 Body");
  assert.equal(payload.reviewInfo.viewOnly, true);
});

test("AT-UC12-03 - No Assigned Papers Message (Extension 3a)", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r2", accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("No papers are currently assigned."), true);
  assert.equal(response.body.includes("/reviewer/assignments/"), false);
});

test("AT-UC12-04 - Handle Retrieval Error for Assigned Papers List (Extension 4a)", async () => {
  const serviceWithFailure = {
    listAssignedPapers() {
      throw new Error("DB_STACKTRACE_SHOULD_NOT_LEAK");
    },
    getAssignedPaperContent() {
      return { type: "forbidden" };
    },
  };
  const controller = createAssignedPapersController({
    assignmentService: serviceWithFailure,
    sessionService: createSessionService({ sid_r1: { user_id: "R1", role: "reviewer" } }),
  });
  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1", accept: "text/html" },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.includes("Unable to load assigned papers."), true);
  assert.equal(response.body.includes("Please try again later."), true);
  assert.equal(response.body.includes("/reviewer/assignments"), true);
  assert.equal(response.body.includes("DB_STACKTRACE_SHOULD_NOT_LEAK"), false);
});

test("AT-UC12-05 - Unauthorized Access Blocked for Unassigned Paper (Extension 6a)", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleView({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
    params: { paper_id: "P9" },
  });

  assert.equal(response.status, 403);
  const payload = parseJsonBody(response);
  assert.equal(payload.message, "Access denied.");
  assert.equal(payload.backLink, "/reviewer/assignments");
  assert.equal(typeof payload.content, "undefined");
});

test("AT-UC12-06 - Authorization: Assigned Papers Are Private Per Reviewer", async () => {
  const { controller } = buildUc12Harness();
  const allowed = await controller.handleView({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(allowed.status, 200);

  const blocked = await controller.handleView({
    headers: { cookie: "cms_session=sid_r3", accept: "application/json" },
    params: { paper_id: "P1" },
  });
  assert.equal(blocked.status, 403);
  const payload = parseJsonBody(blocked);
  assert.equal(payload.message, "Access denied.");
});

test("AT-UC12-07 - Multiple Assigned Papers Listed Correctly", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
  });
  assert.equal(response.status, 200);

  const payload = parseJsonBody(response);
  const ids = payload.items.map((item) => item.paperId);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  assert.deepEqual(ids, ["P1", "P2", "P3", "P10"]);
});

test("AT-UC12-08 - Paper Exists but Manuscript Not Available (Robustness)", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleView({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
    params: { paper_id: "P10" },
  });
  assert.equal(response.status, 409);

  const payload = parseJsonBody(response);
  assert.equal(payload.message, "Manuscript unavailable.");
  assert.equal(
    payload.nextStep,
    "Please try again later or contact the conference administrator."
  );
  assert.equal(payload.backLink, "/reviewer/assignments");
});

test("AT-UC12-09 - Download Attempt Is Not Available (Extension 6b)", async () => {
  const { controller } = buildUc12Harness();
  const response = await controller.handleDownloadAttempt({
    headers: { cookie: "cms_session=sid_r1", accept: "application/json" },
  });
  assert.equal(response.status, 404);

  const payload = parseJsonBody(response);
  assert.equal(payload.errorCode, "download_not_available");
  assert.equal(payload.message, "Download is not available for assigned papers.");
});
