const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionService } = require("../../src/services/session-service");
const { createDataAccess } = require("../../src/services/data_access");
const { createReviewModel } = require("../../src/models/review_model");
const { createReviewService } = require("../../src/controllers/review_service");
const { createCompletedReviewsController } = require("../../src/controllers/completed_reviews_controller");

const FIXED_NOW = new Date("2026-02-24T12:00:00.000Z");
const PAPER_ID = "P1";
const OTHER_PAPER_ID = "P9";
const EDITOR_ID = "editor_1";
const OTHER_EDITOR_ID = "editor_2";

function jsonHeaders(sessionId) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    cookie: `cms_session=${sessionId}`,
  };
}

function htmlHeaders(sessionId) {
  return {
    accept: "text/html",
    cookie: `cms_session=${sessionId}`,
  };
}

function createHarness({ seedOverrides = {}, now = () => FIXED_NOW, reviewServiceOverride } = {}) {
  const sessionService = createSessionService();
  const editorSession = sessionService.create(EDITOR_ID);

  const dataAccess = createDataAccess({
    seed: {
      papers: [
        {
          id: PAPER_ID,
          conferenceId: "C1",
          title: "Completed Review Paper",
          status: "submitted",
          assignedReviewerCount: 2,
          assignedEditorId: EDITOR_ID,
        },
        {
          id: OTHER_PAPER_ID,
          conferenceId: "C1",
          title: "Unauthorized Paper",
          status: "submitted",
          assignedReviewerCount: 1,
          assignedEditorId: OTHER_EDITOR_ID,
        },
      ],
      reviewers: [
        {
          id: "R1",
          name: "Reviewer One",
          email: "reviewer1@example.com",
          currentAssignmentCount: 1,
          eligibilityStatus: true,
        },
        {
          id: "R2",
          name: "Reviewer Two",
          email: "reviewer2@example.com",
          currentAssignmentCount: 1,
          eligibilityStatus: true,
        },
        {
          id: "R3",
          name: "Reviewer Three",
          email: "reviewer3@example.com",
          currentAssignmentCount: 1,
          eligibilityStatus: true,
        },
      ],
      ...seedOverrides,
    },
  });

  const store = { reviews: [] };
  const reviewModel = createReviewModel({ store, now });
  const reviewService =
    reviewServiceOverride || createReviewService({ reviewModel, dataAccess });

  const errorLogEntries = [];
  const errorLog = {
    recordReviewRetrievalFailure(payload) {
      errorLogEntries.push(payload);
      return "error_123";
    },
  };

  const completedReviewsController = createCompletedReviewsController({
    sessionService,
    dataAccess,
    reviewService,
    errorLog,
  });

  return {
    editorSessionId: editorSession.session_id,
    reviewModel,
    store,
    completedReviewsController,
    errorLogEntries,
  };
}

function createSubmittedReview({ reviewModel, reviewerId, paperId, comment, notes } = {}) {
  return reviewModel.create({
    reviewerId,
    paperId,
    requiredFields: { comment },
    optionalFields: { notes },
  });
}

test("AT-UC14-01 — Editor Can View Completed Reviews (Main Success Scenario)", async () => {
  const harness = createHarness();

  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R1",
    paperId: PAPER_ID,
    comment: "Strengths: clear methodology.",
    notes: "Suggested minor edits.",
  });

  const response = await harness.completedReviewsController.handleGet({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.paperId, PAPER_ID);
  assert.equal(payload.completedReviews.length, 1);
  assert.equal(payload.completedReviews[0].reviewerId, "R1");
  assert.equal(payload.completedReviews[0].reviewerName, "Reviewer One");
  assert.equal(payload.completedReviews[0].content.comment, "Strengths: clear methodology.");
});

test("AT-UC14-02 — All Completed Reviews Are Shown (Completeness Check)", async () => {
  const harness = createHarness();

  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R1",
    paperId: PAPER_ID,
    comment: "Completed review one.",
  });
  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R2",
    paperId: PAPER_ID,
    comment: "Completed review two.",
  });
  harness.store.reviews.push({
    review_id: "pending_1",
    paper_id: PAPER_ID,
    reviewer_id: "R3",
    required_fields: { comment: "Pending review." },
    optional_fields: {},
    status: "pending",
    submitted_at: "",
  });

  const response = await harness.completedReviewsController.handleGet({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.completedReviews.length, 2);
  const reviewerIds = payload.completedReviews.map((review) => review.reviewerId).sort();
  assert.deepEqual(reviewerIds, ["R1", "R2"]);
});

test("AT-UC14-03 — No Completed Reviews Message (Extension 2a)", async () => {
  const harness = createHarness();

  const response = await harness.completedReviewsController.handleGet({
    headers: htmlHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(response.status, 200);
  assert.match(response.body, /No completed reviews are available yet\./);
});

test("AT-UC14-04 — Handle Retrieval Error Gracefully (Extension 6a)", async () => {
  const failingService = {
    listCompletedReviews() {
      return {
        type: "failure",
        message: "Review retrieval failed.",
        error: new Error("DB_DOWN"),
      };
    },
  };
  const harness = createHarness({ reviewServiceOverride: failingService });

  const response = await harness.completedReviewsController.handleGet({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(response.status, 500);
  const payload = JSON.parse(response.body);
  assert.equal(
    payload.message,
    "Completed reviews cannot be retrieved at this time."
  );
  assert.equal(payload.errorId, "error_123");
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, "completedReviews"));
  assert.equal(harness.errorLogEntries.length, 1);
});

test("AT-UC14-05 — Authorization: Editor Cannot View Reviews for Unauthorized Paper (Extension 3a)", async () => {
  const harness = createHarness();

  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R1",
    paperId: OTHER_PAPER_ID,
    comment: "Unauthorized content.",
  });

  const response = await harness.completedReviewsController.handleGet({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: OTHER_PAPER_ID },
  });

  assert.equal(response.status, 403);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Access denied.");
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, "completedReviews"));
});

test("AT-UC14-06 — Review Content Matches What Reviewers Submitted", async () => {
  const harness = createHarness();

  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R2",
    paperId: PAPER_ID,
    comment: "Strengths: robust results.",
    notes: "Include additional references.",
  });

  const response = await harness.completedReviewsController.handleGet({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.completedReviews.length, 1);
  assert.equal(payload.completedReviews[0].content.comment, "Strengths: robust results.");
  assert.equal(payload.completedReviews[0].content.notes, "Include additional references.");
});

test("AT-UC14-07 — Multiple Reviews Displayed Without Duplication", async () => {
  const harness = createHarness();

  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R1",
    paperId: PAPER_ID,
    comment: "Review A content.",
  });
  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R2",
    paperId: PAPER_ID,
    comment: "Review B content.",
  });
  createSubmittedReview({
    reviewModel: harness.reviewModel,
    reviewerId: "R3",
    paperId: PAPER_ID,
    comment: "Review C content.",
  });

  const response = await harness.completedReviewsController.handleGet({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.completedReviews.length, 3);
  const ids = payload.completedReviews.map((review) => review.id);
  const unique = new Set(ids);
  assert.equal(unique.size, 3);
});
