const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionService } = require("../../src/services/session-service");
const { createDataAccess } = require("../../src/services/data_access");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createReviewModel, REVIEW_MESSAGES, MIN_COMMENT_LENGTH } = require("../../src/models/review_model");
const { createReviewController } = require("../../src/controllers/review_controller");

const PAPER_ID = "P1";
const REVIEWER_ID = "R1";
const EDITOR_ID = "E1";
const FIXED_NOW = new Date("2026-02-24T12:00:00.000Z");

function jsonHeaders(sessionId) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    cookie: `cms_session=${sessionId}`,
  };
}

function createHarness({ seedOverrides = {}, now = () => FIXED_NOW } = {}) {
  const sessionService = createSessionService();
  const reviewerSession = sessionService.create(REVIEWER_ID);
  const editorSession = sessionService.create(EDITOR_ID);

  const dataAccess = createDataAccess({
    seed: {
      papers: [
        {
          id: PAPER_ID,
          conferenceId: "C1",
          title: "Deterministic Review Paper",
          status: "assigned",
          assignedReviewerCount: 1,
        },
        {
          id: "P9",
          conferenceId: "C1",
          title: "Unassigned Paper",
          status: "assigned",
          assignedReviewerCount: 0,
        },
      ],
      reviewers: [
        {
          id: REVIEWER_ID,
          name: "Reviewer One",
          email: "reviewer1@example.com",
          currentAssignmentCount: 1,
          eligibilityStatus: true,
        },
      ],
      assignments: [
        {
          id: "A100",
          conferenceId: "C1",
          paperId: PAPER_ID,
          reviewerId: REVIEWER_ID,
          assignedAt: FIXED_NOW.toISOString(),
        },
      ],
      reviewInvitations: [
        {
          id: "INV_P1_R1",
          reviewerId: REVIEWER_ID,
          paperId: PAPER_ID,
          status: "accepted",
          respondedAt: FIXED_NOW.toISOString(),
        },
      ],
      ...seedOverrides,
    },
  });

  const authorizationService = createAuthorizationService({
    dataAccess,
    securityLogService: { logUnauthorizedPaperAccess() {}, logUnauthorizedAccess() {} },
  });

  const store = { reviews: [] };
  const reviewModel = createReviewModel({ store, now });
  const reviewController = createReviewController({
    sessionService,
    reviewModel,
    dataAccess,
    authorizationService,
  });

  return {
    reviewerSessionId: reviewerSession.session_id,
    editorSessionId: editorSession.session_id,
    store,
    reviewController,
  };
}

function validReviewPayload({ comment, notes } = {}) {
  return {
    requiredFields: {
      comment: comment ?? "This is a valid review comment.",
    },
    optionalFields: {
      notes: notes ?? "Optional notes for the editor.",
    },
  };
}

test("AT-UC13-01 Successful Review Submission (Main Success Scenario)", async () => {
  const harness = createHarness();

  const response = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload(),
  });

  assert.equal(response.status, 201);
  const payload = JSON.parse(response.body);
  assert.equal(payload.status, "Submitted");
  assert.equal(harness.store.reviews.length, 1);
});

test("AT-UC13-02 Editor Can View Submitted Review (Availability to Editor)", async () => {
  const harness = createHarness();

  await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload({ comment: "Editor-visible review comment." }),
  });

  const list = await harness.reviewController.handleList({
    headers: jsonHeaders(harness.editorSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(list.status, 200);
  const payload = JSON.parse(list.body);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].required_fields.comment, "Editor-visible review comment.");
  assert.equal(payload.items[0].submitted_at, FIXED_NOW.toISOString());
});

test("AT-UC13-03 Reject Submission With Missing Required Fields (Extension 5a)", async () => {
  const harness = createHarness();

  const response = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload({ comment: "" }),
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.fieldErrors.comment, REVIEW_MESSAGES.COMMENT_REQUIRED);
  assert.equal(harness.store.reviews.length, 0);
});

test("AT-UC13-03b Block Resubmission After Successful Submission (Extension 6b)", async () => {
  const harness = createHarness();

  const first = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload(),
  });
  assert.equal(first.status, 201);

  const second = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload({ comment: "Another attempt" }),
  });

  assert.equal(second.status, 409);
  const payload = JSON.parse(second.body);
  assert.equal(payload.message, REVIEW_MESSAGES.DUPLICATE);
  assert.equal(harness.store.reviews.length, 1);
});

test("AT-UC13-04 Reject Submission With Invalid Field Values (Extension 5a)", async () => {
  const harness = createHarness();

  const response = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload({ comment: "short" }),
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.fieldErrors.comment, REVIEW_MESSAGES.COMMENT_TOO_SHORT);
  assert.equal(harness.store.reviews.length, 0);
});

test("AT-UC13-05 Handle System/Database Failure During Save (Extension 6a)", async () => {
  const harness = createHarness();

  const response = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: {
      ...validReviewPayload(),
      simulate_failure: "1",
    },
  });

  assert.equal(response.status, 500);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, REVIEW_MESSAGES.SAVE_FAILURE);
  assert.equal(harness.store.reviews.length, 0);
});

test("AT-UC13-06 Unauthorized Submission Blocked for Unassigned Paper (Extension 3a)", async () => {
  const harness = createHarness();

  const response = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: "P9" },
    body: validReviewPayload({ comment: "Attempt for unassigned paper" }),
  });

  assert.equal(response.status, 403);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "You are not authorized to submit a review for this paper.");
  assert.equal(harness.store.reviews.length, 0);
});

test("AT-UC13-07 Prevent Duplicate Reviews on Double-Submit", async () => {
  const harness = createHarness();

  const payload = validReviewPayload({ comment: "Double submit review comment." });
  const first = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: payload,
  });
  const second = await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: payload,
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.equal(harness.store.reviews.length, 1);
});

test("AT-UC13-08 Post-Submission State: Review Marked Submitted and Not Editable", async () => {
  const harness = createHarness();

  await harness.reviewController.handlePost({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
    body: validReviewPayload(),
  });

  const form = await harness.reviewController.handleGetForm({
    headers: jsonHeaders(harness.reviewerSessionId),
    params: { paper_id: PAPER_ID },
  });

  assert.equal(form.status, 200);
  const payload = JSON.parse(form.body);
  assert.equal(payload.alreadySubmitted, true);
});
