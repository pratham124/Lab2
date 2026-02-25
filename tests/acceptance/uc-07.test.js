const test = require("node:test");
const assert = require("node:assert/strict");

const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { createDecisionService } = require("../../src/services/decision-service");
const { createDecisionController } = require("../../src/controllers/decision-controller");
const { createNotificationService } = require("../../src/services/notification-service");

const PAPER_ID = "P1";
const AUTHOR_A = {
  id: "author_a",
  email: "author.a@example.com",
};
const AUTHOR_B = {
  id: "author_b",
  email: "author.b@example.com",
};

function createHarness({
  initialDecision,
  notifierOverride,
  repositoryOverride,
  sessionsOverride,
} = {}) {
  const store = {
    submissions: [
      {
        submission_id: PAPER_ID,
        author_id: AUTHOR_A.id,
        title: "Deterministic Final Decision Paper",
        contact_email: AUTHOR_A.email,
        final_decision: initialDecision || null,
      },
    ],
    notifications: [],
  };

  const submissionRepository = repositoryOverride || createSubmissionRepository({ store });
  const notificationService = createNotificationService({
    submissionRepository,
    notifier:
      notifierOverride ||
      {
        async sendEmail() {},
      },
  });
  const decisionService = createDecisionService({
    submissionRepository,
    notificationService,
  });

  const sessions =
    sessionsOverride ||
    new Map([
      ["sid_author_a", { user_id: AUTHOR_A.id, role: "author" }],
      ["sid_author_a_later", { user_id: AUTHOR_A.id, role: "author" }],
      ["sid_author_b", { user_id: AUTHOR_B.id, role: "author" }],
    ]);

  const sessionService = {
    validate(sessionId) {
      return sessions.get(String(sessionId || "")) || null;
    },
  };

  const decisionController = createDecisionController({
    decisionService,
    sessionService,
  });

  function jsonHeaders(sessionId) {
    return {
      accept: "application/json",
      "content-type": "application/json",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
    };
  }

  async function publishAccepted({ publishedAt = "2026-02-01T10:00:00.000Z" } = {}) {
    return decisionService.publishDecision({
      paper_id: PAPER_ID,
      decision_value: "Accepted",
      published_at: publishedAt,
    });
  }

  async function publishRejected({ publishedAt = "2026-02-01T10:00:00.000Z" } = {}) {
    return decisionService.publishDecision({
      paper_id: PAPER_ID,
      decision_value: "Rejected",
      published_at: publishedAt,
    });
  }

  async function listPapers(sessionId) {
    return decisionController.handleListPapers({
      headers: jsonHeaders(sessionId),
    });
  }

  async function getDecision(sessionId) {
    return decisionController.handleGetDecision({
      headers: jsonHeaders(sessionId),
      params: { paper_id: PAPER_ID },
    });
  }

  return {
    store,
    sessions,
    submissionRepository,
    decisionService,
    decisionController,
    publishAccepted,
    publishRejected,
    listPapers,
    getDecision,
  };
}

test("AT-UC07-01 — Submitting Author Can View Final Decision Only After Publish", async () => {
  const harness = createHarness({
    initialDecision: {
      paper_id: PAPER_ID,
      decision_value: "Accepted",
      published_at: null,
    },
  });

  const beforePublish = await harness.listPapers("sid_author_a");
  assert.equal(beforePublish.status, 200);
  const beforePayload = JSON.parse(beforePublish.body);
  assert.equal(beforePayload.items.length, 1);
  assert.equal(beforePayload.items[0].paperId, PAPER_ID);
  assert.equal(beforePayload.items[0].decisionStatus, null);
  assert.equal(beforePayload.items[0].decisionPublished, false);

  const published = await harness.publishAccepted();
  assert.equal(published.status, 200);

  const afterPublish = await harness.listPapers("sid_author_a");
  assert.equal(afterPublish.status, 200);
  const afterPayload = JSON.parse(afterPublish.body);
  assert.equal(afterPayload.items[0].decisionStatus, "Accepted");
  assert.equal(afterPayload.items[0].decisionPublished, true);

  const detail = await harness.getDecision("sid_author_a");
  assert.equal(detail.status, 200);
  const detailPayload = JSON.parse(detail.body);
  assert.equal(detailPayload.paper_id, PAPER_ID);
  assert.equal(detailPayload.decision_value, "Accepted");
});

test("AT-UC07-02 — Notification Sent to Submitting Author Only at Publish Time", async () => {
  const deliveries = [];
  const harness = createHarness({
    initialDecision: {
      paper_id: PAPER_ID,
      decision_value: "Accepted",
      published_at: null,
    },
    notifierOverride: {
      async sendEmail(message) {
        deliveries.push(message);
      },
    },
  });

  const published = await harness.publishAccepted();
  assert.equal(published.status, 200);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, AUTHOR_A.email);
  assert.equal(deliveries[0].to === AUTHOR_B.email, false);

  const notifications = await harness.submissionRepository.findNotificationsBySubmissionId(PAPER_ID);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipient_author_id, AUTHOR_A.id);
  assert.equal(notifications[0].recipient_author_id === AUTHOR_B.id, false);
  assert.equal(notifications[0].status, "sent");
});

test("AT-UC07-03 — Decision Available Even If Notification Fails (Extension 3a)", async () => {
  const harness = createHarness({
    initialDecision: {
      paper_id: PAPER_ID,
      decision_value: "Accepted",
      published_at: null,
    },
    notifierOverride: {
      async sendEmail() {
        throw new Error("EMAIL_DOWN");
      },
    },
  });

  const published = await harness.publishAccepted();
  assert.equal(published.status, 200);
  assert.equal(published.notification.type, "failed");

  const notifications = await harness.submissionRepository.findNotificationsBySubmissionId(PAPER_ID);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].status, "failed");
  assert.equal(notifications[0].failure_reason.includes("EMAIL_DOWN"), true);

  const detail = await harness.getDecision("sid_author_a");
  assert.equal(detail.status, 200);
  assert.equal(JSON.parse(detail.body).decision_value, "Accepted");
});

test("AT-UC07-04 — Delayed Viewing: Decision Persists Over Time (Extension 4a)", async () => {
  const harness = createHarness({
    initialDecision: {
      paper_id: PAPER_ID,
      decision_value: "Rejected",
      published_at: "2026-01-31T08:00:00.000Z",
    },
  });

  const laterSession = harness.sessions.get("sid_author_a_later");
  assert.equal(Boolean(laterSession), true);

  const listResponse = await harness.listPapers("sid_author_a_later");
  assert.equal(listResponse.status, 200);
  const listPayload = JSON.parse(listResponse.body);
  assert.equal(listPayload.items[0].decisionStatus, "Rejected");

  const detail = await harness.getDecision("sid_author_a_later");
  assert.equal(detail.status, 200);
  const detailPayload = JSON.parse(detail.body);
  assert.equal(detailPayload.decision_value, "Rejected");
  assert.equal(detailPayload.published_at, "2026-01-31T08:00:00.000Z");
});

test("AT-UC07-05 — Authorization: Only the Submitting Author Can View Decision", async () => {
  const harness = createHarness({
    initialDecision: {
      paper_id: PAPER_ID,
      decision_value: "Accepted",
      published_at: "2026-02-01T09:00:00.000Z",
    },
  });

  const denied = await harness.getDecision("sid_author_b");
  assert.equal(denied.status === 403 || denied.status === 404, true);

  const owner = await harness.getDecision("sid_author_a");
  assert.equal(owner.status, 200);
  assert.equal(JSON.parse(owner.body).decision_value, "Accepted");
});

test("AT-UC07-06 — Handle Retrieval Error Gracefully (Extension 7a)", async () => {
  const retrievalLogs = [];
  const repository = {
    async findByAuthorId(authorId) {
      retrievalLogs.push({ action: "list", authorId, code: "READ_FAIL" });
      throw new Error("READ_FAIL");
    },
    async findById(submissionId) {
      retrievalLogs.push({ action: "detail", submissionId, code: "READ_FAIL" });
      throw new Error("READ_FAIL");
    },
    async upsertDecision() {
      return null;
    },
    async recordNotification() {},
    async findNotificationsBySubmissionId() {
      return [];
    },
  };

  const harness = createHarness({
    repositoryOverride: repository,
  });

  const listFailure = await harness.listPapers("sid_author_a");
  assert.equal(listFailure.status, 503);
  const listBody = JSON.parse(listFailure.body);
  assert.equal(listBody.message, "Decision temporarily unavailable. Please try again later.");
  assert.equal(listFailure.body.toLowerCase().includes("stack"), false);
  assert.equal(listFailure.body.includes("Accepted"), false);
  assert.equal(listFailure.body.includes("Rejected"), false);

  const detailFailure = await harness.getDecision("sid_author_a");
  assert.equal(detailFailure.status, 503);
  const detailBody = JSON.parse(detailFailure.body);
  assert.equal(detailBody.message, "Decision temporarily unavailable. Please try again later.");
  assert.equal(detailFailure.body.toLowerCase().includes("stack"), false);
  assert.equal(detailFailure.body.includes("Accepted"), false);
  assert.equal(detailFailure.body.includes("Rejected"), false);

  assert.equal(retrievalLogs.length >= 2, true);
});

test("AT-UC07-07 — Decision Correctness: Decision Matches Stored Value", async () => {
  const harness = createHarness({
    initialDecision: {
      paper_id: PAPER_ID,
      decision_value: "Accepted",
      published_at: "2026-02-01T12:00:00.000Z",
      reviewer_comments: "never expose",
    },
  });

  const response = await harness.getDecision("sid_author_a");
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.decision_value, "Accepted");
  assert.equal(payload.decision_value === "Rejected", false);
  assert.equal(payload.decision_value === "Pending", false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "reviewer_comments"), false);
});
