const test = require("node:test");
const assert = require("node:assert/strict");

const { createRepository } = require("../../src/services/repository");
const { createReviewStatusService } = require("../../src/services/review_status_service");
const { createDecisionService } = require("../../src/services/decision_service");
const { createDecisionNotificationService } = require("../../src/services/notification_service");
const { createDecisionController } = require("../../src/controllers/decision_controller");

function createHarness({ failDecisionSaveForPaperId, notificationFailureFor } = {}) {
  const deliveryLog = [];

  const store = {
    submissions: [
      {
        submission_id: "P1",
        title: "Paper P1",
        author_id: "author_p1_a",
        required_review_count: 2,
        authors: [
          { id: "author_p1_a", email: "p1.a@example.com" },
          { id: "author_p1_b", email: "p1.b@example.com" },
        ],
      },
      {
        submission_id: "P2",
        title: "Paper P2",
        author_id: "author_p2_a",
        required_review_count: 2,
        authors: [
          { id: "author_p2_a", email: "p2.a@example.com" },
          { id: "author_p2_b", email: "p2.b@example.com" },
        ],
      },
      {
        submission_id: "P3",
        title: "Paper P3",
        author_id: "author_p3_a",
        required_review_count: 2,
        authors: [
          { id: "author_p3_a", email: "p3.a@example.com" },
          { id: "author_p3_b", email: "p3.b@example.com" },
        ],
      },
      {
        submission_id: "P4",
        title: "Paper P4",
        author_id: "author_p4_a",
        required_review_count: 2,
        authors: [
          { id: "author_p4_a", email: "p4.a@example.com" },
          { id: "author_p4_b", email: "p4.b@example.com" },
        ],
      },
      {
        submission_id: "P5",
        title: "Paper P5",
        author_id: "author_p5_a",
        required_review_count: 2,
        authors: [
          { id: "author_p5_a", email: "p5.a@example.com" },
          { id: "author_p5_b", email: "p5.b@example.com" },
        ],
      },
      {
        submission_id: "P6",
        title: "Paper P6",
        author_id: "author_p6_a",
        required_review_count: 2,
        authors: [
          { id: "author_p6_a", email: "p6.a@example.com" },
          { id: "author_p6_b", email: "p6.b@example.com" },
        ],
      },
      {
        submission_id: "P7",
        title: "Paper P7",
        author_id: "author_p7_a",
        required_review_count: 2,
        authors: [
          { id: "author_p7_a", email: "p7.a@example.com" },
          { id: "author_p7_b", email: "p7.b@example.com" },
        ],
      },
    ],
    reviewAssignments: [
      { paperId: "P1", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P1", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P2", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P2", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P3", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P3", reviewerId: "r2", status: "pending", required: true },
      { paperId: "P4", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P4", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P5", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P5", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P6", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P6", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P7", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P7", reviewerId: "r2", status: "submitted", required: true },
    ],
    notificationAttempts: [],
  };

  const submissionRepository = {
    async findById(submissionId) {
      return store.submissions.find((entry) => entry.submission_id === submissionId) || null;
    },
    async upsertDecision({ submission_id, decision }) {
      if (submission_id === failDecisionSaveForPaperId) {
        throw new Error("DB_WRITE_FAILURE");
      }

      const submission = store.submissions.find((entry) => entry.submission_id === submission_id);
      if (!submission) {
        return null;
      }

      submission.final_decision = {
        ...(submission.final_decision || {}),
        ...decision,
      };
      return submission.final_decision;
    },
  };

  const repository = createRepository({ submissionRepository, store });
  const reviewStatusService = createReviewStatusService({ repository });
  const notificationService = createDecisionNotificationService({
    repository,
    notifier: {
      async sendDecisionNotification({ paper, author, decision }) {
        deliveryLog.push({
          paperId: paper.id,
          paperTitle: paper.title,
          authorId: author.id,
          authorEmail: author.email,
          outcome: decision.outcome,
        });

        if (typeof notificationFailureFor === "function" && notificationFailureFor({ paper, author })) {
          throw new Error("NOTIFICATION_DOWN");
        }
      },
    },
  });

  const decisionService = createDecisionService({
    repository,
    reviewStatusService,
    notificationService,
  });

  const decisionController = createDecisionController({ decisionService });

  return {
    store,
    deliveryLog,
    repository,
    decisionService,
    decisionController,
  };
}

function editorHeaders() {
  return {
    "x-user-id": "E1",
    "x-user-role": "editor",
    accept: "application/json",
    "content-type": "application/json",
  };
}

function authorHeaders(authorId) {
  return {
    "x-user-id": authorId,
    "x-user-role": "author",
    accept: "application/json",
    "content-type": "application/json",
  };
}

test("AT-UC15-01 — Send Acceptance Decision Successfully (Main Success Scenario)", async () => {
  const harness = createHarness();

  const response = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P1" },
    body: { outcome: "accept" },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.final, true);
  assert.equal(payload.notificationStatus, "sent");

  const saved = harness.store.submissions.find((entry) => entry.submission_id === "P1").final_decision;
  assert.equal(saved.decision_value, "Accepted");
  assert.equal(Boolean(saved.published_at), true);

  assert.equal(harness.deliveryLog.length, 2);
  assert.deepEqual(
    harness.deliveryLog.map((entry) => entry.authorId).sort(),
    ["author_p1_a", "author_p1_b"]
  );
});

test("AT-UC15-02 — Send Rejection Decision Successfully", async () => {
  const harness = createHarness();

  const response = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P2" },
    body: { outcome: "reject" },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.final, true);
  assert.equal(payload.notificationStatus, "sent");

  const saved = harness.store.submissions.find((entry) => entry.submission_id === "P2").final_decision;
  assert.equal(saved.decision_value, "Rejected");
  assert.equal(harness.deliveryLog.length, 2);
});

test("AT-UC15-03 — Block Sending Decision When Reviews Are Incomplete (Extension 5a)", async () => {
  const harness = createHarness();

  const response = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P3" },
    body: { outcome: "accept" },
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(
    payload.message,
    "Decision cannot be sent until all required reviews are submitted."
  );

  const saved = harness.store.submissions.find((entry) => entry.submission_id === "P3").final_decision;
  assert.equal(saved, undefined);
  assert.equal(harness.deliveryLog.length, 0);
});

test("AT-UC15-04 — Notification Failure After Decision Stored (Extension 7a)", async () => {
  const harness = createHarness({
    notificationFailureFor: ({ paper }) => paper.id === "P4",
  });

  const response = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P4" },
    body: { outcome: "accept" },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.notificationStatus, "failed");
  assert.deepEqual(payload.failedAuthors.sort(), ["author_p4_a", "author_p4_b"]);

  const saved = harness.store.submissions.find((entry) => entry.submission_id === "P4").final_decision;
  assert.equal(saved.decision_value, "Accepted");
  assert.equal(saved.final, true);

  const attempts = harness.store.notificationAttempts.filter((entry) => entry.paperId === "P4");
  assert.equal(attempts.length, 2);
  assert.equal(attempts.every((entry) => entry.status === "failed"), true);
});

test("AT-UC15-05 — Database/Storage Failure Prevents Saving and Sending (Extension 6a)", async () => {
  const harness = createHarness({
    failDecisionSaveForPaperId: "P5",
  });

  const response = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P5" },
    body: { outcome: "reject" },
  });

  assert.equal(response.status, 500);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Decision could not be saved or sent at this time.");

  const saved = harness.store.submissions.find((entry) => entry.submission_id === "P5").final_decision;
  assert.equal(saved, undefined);
  assert.equal(harness.deliveryLog.length, 0);
  assert.equal(harness.store.notificationAttempts.length, 0);
});

test("AT-UC15-06 — Author Receives Decision Notification", async () => {
  const harness = createHarness();

  const response = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P1" },
    body: { outcome: "accept" },
  });

  assert.equal(response.status, 200);
  assert.equal(harness.deliveryLog.length, 2);

  const notificationTargets = harness.deliveryLog.map((entry) => entry.authorEmail).sort();
  assert.deepEqual(notificationTargets, ["p1.a@example.com", "p1.b@example.com"]);
  assert.equal(harness.deliveryLog.every((entry) => entry.paperId === "P1"), true);
  assert.equal(harness.deliveryLog.every((entry) => entry.outcome === "accept"), true);
});

test("AT-UC15-07 — Decision Visible to Author in CMS After Sending", async () => {
  const harness = createHarness({
    notificationFailureFor: ({ paper, author }) => paper.id === "P6" && author.id === "author_p6_b",
  });

  const sent = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P6" },
    body: { outcome: "reject" },
  });
  assert.equal(sent.status, 200);

  const detail = await harness.decisionController.handleGetDecision({
    headers: authorHeaders("author_p6_a"),
    params: { paper_id: "P6" },
  });
  assert.equal(detail.status, 200);

  const payload = JSON.parse(detail.body);
  assert.equal(payload.paperId, "P6");
  assert.equal(payload.paperTitle, "Paper P6");
  assert.equal(payload.outcome, "reject");
  assert.equal(typeof payload.recordedAt, "string");
  assert.equal(payload.final, true);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "reviewerComments"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "reviewerIdentities"), false);
});

test("AT-UC15-08 — Authorization: Non-Editor Cannot Send Decisions", async () => {
  const harness = createHarness();

  const response = await harness.decisionController.handlePostDecision({
    headers: authorHeaders("author_p1_a"),
    params: { paper_id: "P1" },
    body: { outcome: "accept" },
  });

  assert.equal(response.status, 403);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Only editors can send decisions.");

  const saved = harness.store.submissions.find((entry) => entry.submission_id === "P1").final_decision;
  assert.equal(saved, undefined);
  assert.equal(harness.deliveryLog.length, 0);
});

test("AT-UC15-09 — Prevent Duplicate Notifications on Double-Click Send", async () => {
  const harness = createHarness();

  const first = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P7" },
    body: { outcome: "accept" },
  });
  const second = await harness.decisionController.handlePostDecision({
    headers: editorHeaders(),
    params: { paper_id: "P7" },
    body: { outcome: "accept" },
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 409);

  const attempts = harness.store.notificationAttempts.filter((entry) => entry.paperId === "P7");
  assert.equal(attempts.length, 2);
  const uniqueAuthors = new Set(attempts.map((entry) => entry.authorId));
  assert.equal(uniqueAuthors.size, 2);
});
