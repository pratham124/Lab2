const test = require("node:test");
const assert = require("node:assert/strict");

const { createRepository } = require("../../src/services/repository");
const { createReviewStatusService } = require("../../src/services/review_status_service");
const { createDecisionService } = require("../../src/services/decision_service");
const { createDecisionNotificationService } = require("../../src/services/notification_service");
const { createDecisionController } = require("../../src/controllers/decision_controller");
const { createNotificationResendController } = require("../../src/controllers/notification_resend_controller");

function buildHarness({ notifierOverride, reviewAssignments } = {}) {
  const store = {
    submissions: [
      {
        submission_id: "P15",
        author_id: "author_1",
        title: "UC-15 Paper",
        required_review_count: 2,
        authors: [
          { id: "author_1", email: "a1@example.com" },
          { id: "author_2", email: "a2@example.com" },
        ],
      },
    ],
    notifications: [],
    notificationAttempts: [],
    reviewAssignments:
      reviewAssignments ||
      [
        { paperId: "P15", reviewerId: "r1", status: "submitted", required: true },
        { paperId: "P15", reviewerId: "r2", status: "submitted", required: true },
      ],
  };

  const submissionRepository = {
    async findById(id) {
      return store.submissions.find((entry) => entry.submission_id === id) || null;
    },
    async upsertDecision({ submission_id, decision }) {
      const paper = store.submissions.find((entry) => entry.submission_id === submission_id);
      if (!paper) {
        return null;
      }
      paper.final_decision = {
        ...(paper.final_decision || {}),
        ...decision,
      };
      return paper.final_decision;
    },
  };

  const repository = createRepository({ submissionRepository, store });
  const reviewStatusService = createReviewStatusService({ repository });
  const notificationService = createDecisionNotificationService({
    repository,
    notifier:
      notifierOverride ||
      {
        async sendDecisionNotification() {
          return { delivered: true };
        },
      },
  });
  const decisionService = createDecisionService({
    repository,
    notificationService,
    reviewStatusService,
  });

  return {
    store,
    repository,
    decisionService,
  };
}

test("UC-15 stores a final decision and prevents duplicate send", async () => {
  const harness = buildHarness();

  const first = await harness.decisionService.recordDecision({
    paperId: "P15",
    outcome: "accept",
    actor: { id: "editor_1", role: "editor" },
  });
  assert.equal(first.type, "success");
  assert.equal(first.final, true);

  const second = await harness.decisionService.recordDecision({
    paperId: "P15",
    outcome: "reject",
    actor: { id: "editor_1", role: "editor" },
  });
  assert.equal(second.type, "conflict");
  assert.equal(second.status, 409);
});

test("UC-15 blocks decision when required reviews are incomplete", async () => {
  const harness = buildHarness({
    reviewAssignments: [
      { paperId: "P15", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P15", reviewerId: "r2", status: "pending", required: true },
    ],
  });

  const result = await harness.decisionService.recordDecision({
    paperId: "P15",
    outcome: "accept",
    actor: { id: "editor_1", role: "editor" },
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
});

test("UC-15 uses sent/partial/failed notification statuses and resend targets failed only", async () => {
  let sendCount = 0;
  const harness = buildHarness({
    notifierOverride: {
      async sendDecisionNotification({ author }) {
        sendCount += 1;
        if (author.id === "author_2") {
          throw new Error("SMTP_DOWN");
        }
      },
    },
  });

  const initial = await harness.decisionService.recordDecision({
    paperId: "P15",
    outcome: "accept",
    actor: { id: "editor_1", role: "editor" },
  });
  assert.equal(initial.notificationStatus, "partial");
  assert.deepEqual(initial.failedAuthors, ["author_2"]);

  const resend = await harness.decisionService.resendFailedNotifications({
    paperId: "P15",
    actor: { id: "editor_1", role: "editor" },
  });
  assert.equal(resend.notificationStatus, "failed");
  assert.deepEqual(resend.failedAuthors, ["author_2"]);
  assert.equal(sendCount, 3);
});

test("UC-15 author decision view includes required fields only", async () => {
  const harness = buildHarness();
  await harness.decisionService.recordDecision({
    paperId: "P15",
    outcome: "reject",
    actor: { id: "editor_1", role: "editor" },
  });

  const view = await harness.decisionService.getDecisionView({
    paperId: "P15",
    actor: { id: "author_1", role: "author" },
  });

  assert.equal(view.type, "success");
  assert.deepEqual(Object.keys(view.decision).sort(), [
    "final",
    "outcome",
    "paperId",
    "paperTitle",
    "recordedAt",
  ]);
});

test("UC-15 controllers enforce authorization and map responses", async () => {
  const harness = buildHarness();
  const decisionController = createDecisionController({
    decisionService: harness.decisionService,
  });
  const resendController = createNotificationResendController({
    decisionService: harness.decisionService,
  });

  const blocked = await decisionController.handlePostDecision({
    headers: { "x-user-id": "author_1", "x-user-role": "author" },
    params: { paper_id: "P15" },
    body: { outcome: "accept" },
  });
  assert.equal(blocked.status, 403);

  const posted = await decisionController.handlePostDecision({
    headers: { "x-user-id": "editor_1", "x-user-role": "editor" },
    params: { paper_id: "P15" },
    body: { outcome: "accept" },
  });
  assert.equal(posted.status, 200);

  const fetched = await decisionController.handleGetDecision({
    headers: { "x-user-id": "author_1", "x-user-role": "author" },
    params: { paper_id: "P15" },
  });
  assert.equal(fetched.status, 200);

  const resent = await resendController.handlePostResend({
    headers: { "x-user-id": "editor_1", "x-user-role": "editor" },
    params: { paper_id: "P15" },
  });
  assert.equal(resent.status === 200 || resent.status === 404, true);
});

test("UC-15 controllers parse encoded cookies via sessionService and normalize fallback role", async () => {
  const harness = buildHarness();
  const decisionController = createDecisionController({
    decisionService: harness.decisionService,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid encoded") {
          return { user_id: "editor_1", role: "editor" };
        }
        return null;
      },
    },
  });
  const resendController = createNotificationResendController({
    decisionService: harness.decisionService,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid encoded") {
          return { user_id: "editor_1", role: "editor" };
        }
        return null;
      },
    },
  });

  const postWithEncodedCookie = await decisionController.handlePostDecision({
    headers: { cookie: "broken_token; cms_session=sid%20encoded" },
    params: { paper_id: "P15" },
    body: { outcome: "accept" },
  });
  assert.equal(postWithEncodedCookie.status, 200);

  const resendWithEncodedCookie = await resendController.handlePostResend({
    headers: { cookie: "invalid_cookie; cms_session=sid%20encoded" },
    params: { paper_id: "P15" },
  });
  assert.equal(resendWithEncodedCookie.status === 200 || resendWithEncodedCookie.status === 404, true);

  const fallbackRoleDecision = await decisionController.handlePostDecision({
    headers: {
      "x-user-id": "author_1",
      "x-user-role": "  AUTHOR  ",
    },
    params: { paper_id: "P15" },
    body: { outcome: "accept" },
  });
  assert.equal(fallbackRoleDecision.status, 403);

  const fallbackRoleResend = await resendController.handlePostResend({
    headers: {
      "x-user-id": "author_1",
      "x-user-role": "  AUTHOR  ",
    },
    params: { paper_id: "P15" },
  });
  assert.equal(fallbackRoleResend.status, 403);
});
