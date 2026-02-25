const test = require("node:test");
const assert = require("node:assert/strict");

const { canViewDecision } = require("../../src/lib/decision-visibility");
const { ERROR_MESSAGES } = require("../../src/lib/error-messages");
const { createNotificationService } = require("../../src/services/notification-service");
const { createDecisionService } = require("../../src/services/decision-service");
const { createDecisionController } = require("../../src/controllers/decision-controller");
const { createRoutes } = require("../../src/controllers/routes");
const { createSubmissionRepository } = require("../../src/services/submission_repository");

test("decision visibility predicate requires publish timestamp and submitting author ownership", () => {
  assert.equal(
    canViewDecision({
      decision: { published_at: "2026-02-01T00:00:00.000Z" },
      requestingAuthorId: "author_1",
      submittingAuthorId: "author_1",
    }),
    true
  );

  assert.equal(
    canViewDecision({
      decision: { published_at: null },
      requestingAuthorId: "author_1",
      submittingAuthorId: "author_1",
    }),
    false
  );

  assert.equal(
    canViewDecision({
      decision: { published_at: "2026-02-01T00:00:00.000Z" },
      requestingAuthorId: "author_2",
      submittingAuthorId: "author_1",
    }),
    false
  );
});

test("decision service enforces publish-gated visibility and strips reviewer comments", async () => {
  const repo = createSubmissionRepository({
    store: {
      submissions: [
        {
          submission_id: "paper_1",
          author_id: "author_1",
          title: "Paper One",
          contact_email: "author1@example.com",
          final_decision: {
            decision_value: "Accepted",
            published_at: null,
            reviewer_comments: "private",
          },
        },
      ],
    },
  });

  const service = createDecisionService({ submissionRepository: repo });
  const beforePublish = await service.listDecisionsForAuthor({ author_id: "author_1" });
  assert.equal(beforePublish.items[0].decisionStatus, null);
  assert.equal(beforePublish.items[0].decisionPublished, false);

  await repo.upsertDecision({
    submission_id: "paper_1",
    decision: {
      decision_value: "Accepted",
      published_at: "2026-02-01T01:00:00.000Z",
      reviewer_comments: "still private",
    },
  });

  const afterPublish = await service.getDecisionForPaper({
    paper_id: "paper_1",
    author_id: "author_1",
  });

  assert.equal(afterPublish.type, "success");
  assert.equal(afterPublish.decision.decision_value, "Accepted");
  assert.equal(afterPublish.decision.reviewer_comments, undefined);
});

test("decision service publish sends one email to submitting author and persists notification", async () => {
  const delivered = [];
  const repo = createSubmissionRepository({
    store: {
      submissions: [
        {
          submission_id: "paper_2",
          author_id: "author_2",
          title: "Paper Two",
          contact_email: "submitter@example.com",
        },
      ],
      notifications: [],
    },
  });

  const notificationService = createNotificationService({
    submissionRepository: repo,
    notifier: {
      async sendEmail(input) {
        delivered.push(input);
      },
    },
  });
  const service = createDecisionService({
    submissionRepository: repo,
    notificationService,
  });

  const result = await service.publishDecision({
    paper_id: "paper_2",
    decision_value: "Rejected",
    published_at: "2026-02-01T03:00:00.000Z",
  });

  assert.equal(result.type, "success");
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].to, "submitter@example.com");

  const savedNotifications = await repo.findNotificationsBySubmissionId("paper_2");
  assert.equal(savedNotifications.length, 1);
  assert.equal(savedNotifications[0].recipient_author_id, "author_2");
});

test("decision service returns forbidden for non-submitting author", async () => {
  const repo = createSubmissionRepository({
    store: {
      submissions: [
        {
          submission_id: "paper_3",
          author_id: "author_3",
          title: "Paper Three",
          final_decision: {
            decision_value: "Accepted",
            published_at: "2026-02-01T00:00:00.000Z",
          },
        },
      ],
    },
  });
  const service = createDecisionService({ submissionRepository: repo });
  const result = await service.getDecisionForPaper({
    paper_id: "paper_3",
    author_id: "other_author",
  });
  assert.equal(result.type, "forbidden");
  assert.equal(result.status, 403);
});

test("decision controller uses approved retrieval-failure message without internal ids", async () => {
  const controller = createDecisionController({
    decisionService: {
      async listDecisionsForAuthor() {
        return { type: "retrieval_error", status: 503 };
      },
      async getDecisionForPaper() {
        return { type: "retrieval_error", status: 503 };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "author_1" };
      },
    },
  });

  const listResponse = await controller.handleListPapers({
    headers: { accept: "application/json", cookie: "cms_session=sid_1" },
  });
  assert.equal(listResponse.status, 503);
  assert.equal(JSON.parse(listResponse.body).message, ERROR_MESSAGES.DECISION_TEMPORARILY_UNAVAILABLE);

  const detailResponse = await controller.handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_1" },
    params: { paper_id: "paper_x" },
  });
  assert.equal(detailResponse.status, 503);
  assert.equal(JSON.parse(detailResponse.body).message, ERROR_MESSAGES.DECISION_TEMPORARILY_UNAVAILABLE);
});

test("routes expose papers list and paper decision endpoints", async () => {
  const routes = createRoutes({
    submissionController: {},
    draftController: {},
    decisionController: {
      async handleListPapers() {
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [] }),
        };
      },
      async handleGetDecision(req) {
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paper_id: req.params.paper_id }),
        };
      },
    },
  });

  const listReq = { method: "GET", headers: {} };
  const listUrl = new URL("http://localhost/papers");
  assert.equal(routes.isPapersList(listReq, listUrl), true);
  assert.equal((await routes.handlePapersList(listReq)).status, 200);

  const detailReq = { method: "GET", headers: {} };
  const detailUrl = new URL("http://localhost/papers/paper_4/decision");
  assert.equal(routes.isPaperDecisionGet(detailReq, detailUrl), true);
  const detailResponse = await routes.handlePaperDecisionGet(detailReq, detailUrl);
  assert.equal(detailResponse.status, 200);
  assert.equal(JSON.parse(detailResponse.body).paper_id, "paper_4");
});
