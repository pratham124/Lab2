const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_REVIEWER_WORKLOAD,
  countAssignmentsForReviewerConference,
  getReviewerConferenceWorkload,
} = require("../../src/models/workload_count");
const { createDataAccess: createServiceDataAccess } = require("../../src/services/data_access");
const { renderSelectableReviewerList } = require("../../src/views/reviewer_selection_view");
const { createReviewerSelectionController } = require("../../src/controllers/reviewer_selection_controller");
const { createReviewerAssignmentController } = require("../../src/controllers/reviewer_assignment_controller");

function createSessionService(role = "editor") {
  return {
    validate() {
      return { id: "session_1", role };
    },
  };
}

function createDataAccess() {
  const assignments = [
    { id: "A1", conferenceId: "C1", paperId: "P0", reviewerId: "R5", assignedAt: new Date().toISOString() },
    { id: "A2", conferenceId: "C1", paperId: "P01", reviewerId: "R5", assignedAt: new Date().toISOString() },
    { id: "A3", conferenceId: "C1", paperId: "P02", reviewerId: "R5", assignedAt: new Date().toISOString() },
    { id: "A4", conferenceId: "C1", paperId: "P03", reviewerId: "R5", assignedAt: new Date().toISOString() },
    { id: "A5", conferenceId: "C1", paperId: "P04", reviewerId: "R5", assignedAt: new Date().toISOString() },
  ];
  const papers = new Map([["P1", { id: "P1", conferenceId: "C1", title: "Paper 1", status: "submitted" }]]);
  const reviewers = new Map([
    ["R4", { id: "R4", name: "Reviewer 4", eligibilityStatus: true, currentAssignmentCount: 4 }],
    ["R5", { id: "R5", name: "Reviewer 5", eligibilityStatus: true, currentAssignmentCount: 5 }],
  ]);

  return {
    getPaperByConferenceAndId(conferenceId, paperId) {
      const paper = papers.get(paperId);
      return paper && paper.conferenceId === conferenceId ? paper : null;
    },
    listReviewersByConferenceId() {
      return Array.from(reviewers.values());
    },
    listAssignmentsByConference(conferenceId) {
      return assignments.filter((item) => item.conferenceId === conferenceId);
    },
    getReviewerById(reviewerId) {
      return reviewers.get(reviewerId) || null;
    },
    createSingleAssignment({ conferenceId, paperId, reviewerId }) {
      const count = assignments.filter(
        (item) => item.conferenceId === conferenceId && item.reviewerId === reviewerId
      ).length;
      if (count >= MAX_REVIEWER_WORKLOAD) {
        const error = new Error("workload_conflict");
        error.code = "workload_conflict";
        throw error;
      }
      const created = {
        id: `A${assignments.length + 1}`,
        conferenceId,
        paperId,
        reviewerId,
        assignedAt: new Date().toISOString(),
      };
      assignments.push(created);
      return created;
    },
  };
}

test("UC-09 workload model counts reviewer assignments by conference", async () => {
  const count = countAssignmentsForReviewerConference(
    [
      { reviewerId: "R1", conferenceId: "C1" },
      { reviewerId: "R1", conferenceId: "C1" },
      { reviewerId: "R1", conferenceId: "C2" },
      { reviewerId: "R2", conferenceId: "C1" },
    ],
    { reviewerId: "R1", conferenceId: "C1" }
  );
  assert.equal(count, 2);

  await assert.rejects(
    () =>
      getReviewerConferenceWorkload({
        reviewerId: "R1",
        conferenceId: "C1",
      }),
    /Workload loader is not configured/
  );
});

test("UC-09 reviewer selection controller hides reviewers already at workload limit", async () => {
  const controller = createReviewerSelectionController({
    sessionService: createSessionService("editor"),
    dataAccess: createDataAccess(),
  });

  const response = await controller.handleGetSelectableReviewers({
    headers: { cookie: "cms_session=s1", accept: "application/json" },
    params: { conference_id: "C1", paper_id: "P1" },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(Array.isArray(payload), true);
  assert.equal(payload.some((item) => item.reviewer_id === "R4"), true);
  assert.equal(payload.some((item) => item.reviewer_id === "R5"), false);
});

test("UC-09 reviewer assignment controller blocks assignment at limit", async () => {
  const controller = createReviewerAssignmentController({
    sessionService: createSessionService("editor"),
    dataAccess: createDataAccess(),
  });

  const response = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=s1", accept: "application/json" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: { reviewer_id: "R5" },
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.code, "WORKLOAD_LIMIT_REACHED");
});

test("UC-09 reviewer assignment controller allows assignment under limit", async () => {
  const controller = createReviewerAssignmentController({
    sessionService: createSessionService("editor"),
    dataAccess: createDataAccess(),
  });

  const response = await controller.handlePostAssignment({
    headers: { cookie: "cms_session=s1", accept: "application/json" },
    params: { conference_id: "C1", paper_id: "P1" },
    body: { reviewer_id: "R4" },
  });

  assert.equal(response.status, 201);
  const payload = JSON.parse(response.body);
  assert.equal(payload.reviewer_id, "R4");
  assert.equal(payload.conference_id, "C1");
});

test("UC-09 data_access createSingleAssignment normalizes ids and uses effective conference fallback", () => {
  const access = createServiceDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });

  const assignment = access.createSingleAssignment({
    conferenceId: " C1 ",
    paperId: " P1 ",
    reviewerId: " R1 ",
  });

  assert.equal(assignment.paperId, "P1");
  assert.equal(assignment.reviewerId, "R1");
  assert.equal(assignment.conferenceId, "C1");
});

test("UC-09 reviewer_selection_view renders mapped reviewer fields and handles non-array input", () => {
  const mapped = renderSelectableReviewerList([{ id: " R1 ", name: " Reviewer One " }]);
  assert.deepEqual(mapped, [{ reviewer_id: "R1", name: "Reviewer One" }]);

  const fallback = renderSelectableReviewerList(null);
  assert.deepEqual(fallback, []);
});
