const test = require("node:test");
const assert = require("node:assert/strict");

const { createDecisionService } = require("../../src/services/decision-service");
const { createNotificationService } = require("../../src/services/notification-service");
const { createDecisionController } = require("../../src/controllers/decision-controller");
const { createRoutes } = require("../../src/controllers/routes");
const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { canViewDecision } = require("../../src/lib/decision-visibility");

test("decision_service constructor and list retrieval error branches", async () => {
  assert.throws(() => createDecisionService(), /submissionRepository is required/);

  const service = createDecisionService({
    submissionRepository: {
      async findByAuthorId() {
        throw new Error("READ_FAIL");
      },
    },
  });
  const result = await service.listDecisionsForAuthor({ author_id: "a1" });
  assert.equal(result.type, "retrieval_error");
  assert.equal(result.status, 503);
});

test("decision_service getDecisionForPaper validation/not_found/unpublished/visibility/retrieval branches", async () => {
  const serviceValidation = createDecisionService({
    submissionRepository: {
      async findById() {
        return null;
      },
    },
  });
  assert.equal((await serviceValidation.getDecisionForPaper({ paper_id: "", author_id: "a1" })).status, 400);

  assert.equal(
    (
      await serviceValidation.getDecisionForPaper({
        paper_id: "p1",
        author_id: "a1",
      })
    ).status,
    404
  );

  const serviceNoDecision = createDecisionService({
    submissionRepository: {
      async findById() {
        return { submission_id: "p1", author_id: "a1" };
      },
    },
  });
  assert.equal((await serviceNoDecision.getDecisionForPaper({ paper_id: "p1", author_id: "a1" })).status, 404);

  const serviceUnpublished = createDecisionService({
    submissionRepository: {
      async findById() {
        return {
          submission_id: "p1",
          author_id: "a1",
          final_decision: { decision_value: "Accepted", published_at: null },
        };
      },
    },
  });
  assert.equal((await serviceUnpublished.getDecisionForPaper({ paper_id: "p1", author_id: "a1" })).status, 409);

  const serviceVisibilityFalse = createDecisionService({
    submissionRepository: {
      async findById() {
        return {
          submission_id: "p1",
          author_id: "a1",
          final_decision: { decision_value: "Accepted", published_at: "2026-02-01T00:00:00.000Z" },
        };
      },
    },
    visibilityPredicate() {
      return false;
    },
  });
  assert.equal(
    (await serviceVisibilityFalse.getDecisionForPaper({ paper_id: "p1", author_id: "a1" })).status,
    403
  );

  const serviceReadFail = createDecisionService({
    submissionRepository: {
      async findById() {
        throw new Error("READ_FAIL");
      },
    },
  });
  assert.equal((await serviceReadFail.getDecisionForPaper({ paper_id: "p1", author_id: "a1" })).status, 503);
});

test("decision_service publishDecision validation/not_found/no-notifier/default-publishedAt/retrieval and status mapping branches", async () => {
  const repo = createSubmissionRepository({
    store: {
      submissions: [{ submission_id: "p1", author_id: "a1", contact_email: "a1@example.com" }],
    },
  });
  const service = createDecisionService({ submissionRepository: repo });

  assert.equal((await service.publishDecision({ paper_id: "", decision_value: "Accepted" })).status, 400);
  assert.equal((await service.publishDecision({ paper_id: "p1", decision_value: "Maybe" })).status, 400);
  assert.equal((await service.publishDecision({ paper_id: "missing", decision_value: "Accepted" })).status, 404);

  const published = await service.publishDecision({ paper_id: "p1", decision_value: "Accepted" });
  assert.equal(published.status, 200);
  assert.equal(published.notification, null);
  assert.equal(typeof published.decision.published_at, "string");

  const list = await service.listDecisionsForAuthor({ author_id: "a1" });
  assert.equal(list.status, 200);
  assert.equal(list.items[0].decisionStatus, "Accepted");

  await repo.upsertDecision({
    submission_id: "p1",
    decision: { decision_value: "Unknown", published_at: "2026-02-01T00:00:00.000Z" },
  });
  const listUnknown = await service.listDecisionsForAuthor({ author_id: "a1" });
  assert.equal(listUnknown.items[0].decisionStatus, null);

  const serviceWriteFail = createDecisionService({
    submissionRepository: {
      async findById() {
        return { submission_id: "p2", author_id: "a2", contact_email: "a2@example.com" };
      },
      async upsertDecision() {
        throw new Error("WRITE_FAIL");
      },
    },
  });
  assert.equal((await serviceWriteFail.publishDecision({ paper_id: "p2", decision_value: "Accepted" })).status, 503);
});

test("decision_service covers author/decision fallback normalization branches", async () => {
  const service = createDecisionService({
    submissionRepository: {
      async findByAuthorId(authorId) {
        assert.equal(authorId, "");
        return [{ submission_id: "p1", title: "T1", author_id: "a1" }];
      },
      async findById(paperId) {
        if (paperId === "p1") {
          return {
            submission_id: "p1",
            title: "T1",
            author_id: "a1",
            contact_email: "a1@example.com",
            final_decision: {
              decision_value: "Accepted",
              published_at: "2026-02-01T00:00:00.000Z",
            },
          };
        }
        if (paperId === "p2") {
          return {
            submission_id: undefined,
            title: "T2",
            author_id: "a2",
            contact_email: "a2@example.com",
            final_decision: {
              decision_value: "Rejected",
              published_at: "2026-02-02T00:00:00.000Z",
            },
          };
        }
        return null;
      },
      async upsertDecision() {
        return {};
      },
    },
  });

  const list = await service.listDecisionsForAuthor();
  assert.equal(list.status, 200);
  assert.equal(list.items[0].decisionPublished, false);
  assert.equal(list.items[0].decisionStatus, null);

  const forbidden = await service.getDecisionForPaper({ paper_id: "p1", author_id: "a2" });
  assert.equal(forbidden.status, 403);

  const published = await service.publishDecision({
    paper_id: "p2",
    decision_value: " Accepted ",
    published_at: "2026-02-03T00:00:00.000Z",
  });
  assert.equal(published.status, 200);
  assert.equal(published.decision.paper_id, "p2");
  assert.equal(published.decision.decision_value, "Accepted");
});

test("decision_service covers remaining short-circuit fallback branches", async () => {
  const blankStringObject = {
    toString() {
      return "";
    },
  };

  const service = createDecisionService({
    submissionRepository: {
      async findByAuthorId(authorId) {
        assert.equal(authorId, "");
        return [{ submission_id: "p1", title: "Paper 1", author_id: "a1" }];
      },
      async findById(paperId) {
        if (paperId === "p1") {
          return {
            submission_id: "p1",
            author_id: "a1",
            final_decision: {
              decision_value: "Accepted",
              published_at: "2026-02-01T00:00:00.000Z",
            },
          };
        }
        if (paperId === "p2") {
          return {
            submission_id: undefined,
            author_id: undefined,
            final_decision: {
              decision_value: "Rejected",
              published_at: "2026-02-01T00:00:00.000Z",
            },
          };
        }
        return null;
      },
      async upsertDecision() {
        return {};
      },
    },
  });

  const list = await service.listDecisionsForAuthor();
  assert.equal(list.status, 200);
  assert.equal(list.items[0].decisionStatus, null);

  const missingAuthor = await service.getDecisionForPaper({ paper_id: "p1" });
  assert.equal(missingAuthor.status, 403);

  const fallbackAuthorAndPaper = await service.getDecisionForPaper({ paper_id: "p2", author_id: "" });
  assert.equal(fallbackAuthorAndPaper.status, 200);
  assert.equal(fallbackAuthorAndPaper.decision.paper_id, "");

  const invalidWithoutDecisionValue = await service.publishDecision({ paper_id: "p1" });
  assert.equal(invalidWithoutDecisionValue.status, 400);

  const publishedWithBlankTimestamp = await service.publishDecision({
    paper_id: "p1",
    decision_value: "Accepted",
    published_at: blankStringObject,
  });
  assert.equal(publishedWithBlankTimestamp.status, 200);
  assert.equal(publishedWithBlankTimestamp.decision.published_at, null);
});

test("notification_service constructor, validation, default notifier, failure branches", async () => {
  assert.throws(() => createNotificationService(), /submissionRepository is required/);

  const recorded = [];
  const repo = {
    async recordNotification(entry) {
      recorded.push(entry);
      return entry;
    },
  };

  const service = createNotificationService({ submissionRepository: repo });
  assert.equal((await service.notifyDecisionPublished({ paper_id: "", submitting_author: {} })).status, 400);
  assert.equal((await service.notifyDecisionPublished({ paper_id: "p0" })).status, 400);

  const sent = await service.notifyDecisionPublished({
    paper_id: "p1",
    submitting_author: { id: "a1", email: "a1@example.com" },
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.type, "sent");
  assert.equal(recorded[0].status, "sent");

  const failedService = createNotificationService({
    submissionRepository: repo,
    notifier: {
      async sendEmail() {
        throw {};
      },
    },
  });
  const failed = await failedService.notifyDecisionPublished({
    paper_id: "p2",
    submitting_author: { id: "a2", email: "a2@example.com" },
  });
  assert.equal(failed.status, 503);
  assert.equal(failed.type, "failed");
  assert.equal(failed.notification.failure_reason, "notification_failed");

  const failedWithMessageService = createNotificationService({
    submissionRepository: repo,
    notifier: {
      async sendEmail() {
        throw new Error("SMTP_DOWN");
      },
    },
  });
  const failedWithMessage = await failedWithMessageService.notifyDecisionPublished({
    paper_id: "p3",
    submitting_author: { id: "a3", email: "a3@example.com" },
  });
  assert.equal(failedWithMessage.status, 503);
  assert.equal(failedWithMessage.notification.failure_reason, "SMTP_DOWN");
});

test("decision_controller constructor and list branches (unauth json/html, success html, failure html)", async () => {
  assert.throws(() => createDecisionController({ sessionService: {} }), /decisionService is required/);
  assert.throws(() => createDecisionController({ decisionService: {} }), /sessionService is required/);

  const controller = createDecisionController({
    decisionService: {
      async listDecisionsForAuthor() {
        return {
          type: "success",
          items: [{ title: "T", decisionStatus: "Accepted" }],
        };
      },
      async getDecisionForPaper() {
        return { type: "retrieval_error" };
      },
    },
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_ok") {
          return { user_id: "a1" };
        }
        return null;
      },
    },
  });

  const unauthJson = await controller.handleListPapers({
    headers: { accept: "application/json", cookie: "cms_session=sid_missing" },
  });
  assert.equal(unauthJson.status, 401);

  const unauthHtml = await controller.handleListPapers({
    headers: { accept: "text/html", cookie: "cms_session=sid_missing" },
  });
  assert.equal(unauthHtml.status, 302);

  const successHtml = await controller.handleListPapers({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
  });
  assert.equal(successHtml.status, 200);
  assert.equal(successHtml.body.includes("Accepted"), true);

  const failureHtmlController = createDecisionController({
    decisionService: {
      async listDecisionsForAuthor() {
        return { type: "retrieval_error" };
      },
      async getDecisionForPaper() {
        return { type: "retrieval_error" };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "a1" };
      },
    },
  });
  const failureHtml = await failureHtmlController.handleListPapers({
    headers: { accept: "text/html", cookie: "cms_session=sid_ok" },
  });
  assert.equal(failureHtml.status, 503);
  assert.equal(failureHtml.body.includes("Decision temporarily unavailable. Please try again later."), true);
  assert.equal(failureHtml.body.includes("Accepted"), false);
});

test("decision_controller getDecision branches", async () => {
  function makeController(resultType) {
    return createDecisionController({
      decisionService: {
        async listDecisionsForAuthor() {
          return { type: "success", items: [] };
        },
        async getDecisionForPaper() {
          if (resultType === "success") {
            return { type: "success", decision: { paper_id: "p1" } };
          }
          return { type: resultType };
        },
      },
      sessionService: {
        validate(sessionId) {
          return sessionId === "sid_ok" ? { user_id: "a1" } : null;
        },
      },
    });
  }

  const unauth = await makeController("success").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_missing" },
    params: { paper_id: "p1" },
  });
  assert.equal(unauth.status, 401);

  const success = await makeController("success").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "p1" },
  });
  assert.equal(success.status, 200);

  const forbidden = await makeController("forbidden").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "p1" },
  });
  assert.equal(forbidden.status, 403);

  const notFound = await makeController("not_found").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "p1" },
  });
  assert.equal(notFound.status, 404);

  const unpublished = await makeController("unpublished").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "p1" },
  });
  assert.equal(unpublished.status, 409);

  const validation = await makeController("validation_error").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "" },
  });
  assert.equal(validation.status, 400);

  const fallback = await makeController("retrieval_error").handleGetDecision({
    headers: { accept: "application/json", cookie: "cms_session=sid_ok" },
    params: { paper_id: "p1" },
  });
  assert.equal(fallback.status, 503);
});

test("decision_controller getSession handles missing request and forwards empty session id", async () => {
  let validatedSessionId = "unset";
  const controller = createDecisionController({
    decisionService: {
      async listDecisionsForAuthor() {
        return { type: "retrieval_error" };
      },
      async getDecisionForPaper() {
        return { type: "retrieval_error" };
      },
    },
    sessionService: {
      validate(sessionId) {
        validatedSessionId = sessionId;
        return null;
      },
    },
  });

  const response = await controller.handleListPapers();
  assert.equal(response.status, 302);
  assert.equal(validatedSessionId, "");
});

test("decision_controller parses encoded cookie and detects JSON via content-type without accept", async () => {
  let validatedSessionId = "unset";
  const controller = createDecisionController({
    decisionService: {
      async listDecisionsForAuthor() {
        return { type: "success", items: [] };
      },
      async getDecisionForPaper() {
        return { type: "success", decision: { paper_id: "p1" } };
      },
    },
    sessionService: {
      validate(sessionId) {
        validatedSessionId = sessionId;
        return null;
      },
    },
  });

  const response = await controller.handleListPapers({
    headers: {
      cookie: "cms_session=sid%5Fencoded",
      "content-type": "application/json",
    },
  });

  assert.equal(response.status, 401);
  assert.equal(validatedSessionId, "sid_encoded");
});

test("routes decision endpoint branches and submission_repository decision/notification branches", async () => {
  const routesMissing = createRoutes({ submissionController: {}, draftController: {} });
  const list404 = await routesMissing.handlePapersList({ headers: {} });
  assert.equal(list404.status, 404);
  const decision404 = await routesMissing.handlePaperDecisionGet(
    { headers: {} },
    new URL("http://localhost/papers/p1/decision")
  );
  assert.equal(decision404.status, 404);

  assert.equal(routesMissing.isPapersList({ method: "POST" }, new URL("http://localhost/papers")), false);
  assert.equal(
    routesMissing.isPaperDecisionGet({ method: "GET" }, new URL("http://localhost/papers/p1/not-decision")),
    false
  );

  const store = { submissions: "bad", drafts: [], notifications: "bad" };
  const repo = createSubmissionRepository({ store });
  assert.deepEqual(store.submissions, []);
  assert.deepEqual(store.notifications, []);

  assert.equal(await repo.upsertDecision({ submission_id: "missing", decision: {} }), null);
  assert.equal(await repo.findDecisionBySubmissionId("missing"), null);

  await repo.create({ submission_id: "p1", author_id: "a1", title: "T" });
  assert.deepEqual(await repo.findByAuthorId("a1"), [{ submission_id: "p1", author_id: "a1", title: "T" }]);
  assert.equal(await repo.findDecisionBySubmissionId("p1"), null);

  const merged = await repo.upsertDecision({
    submission_id: "p1",
    decision: { decision_value: "Accepted", published_at: "2026-02-01T00:00:00.000Z" },
  });
  assert.equal(merged.decision_value, "Accepted");
  assert.equal((await repo.findDecisionBySubmissionId("p1")).published_at, "2026-02-01T00:00:00.000Z");

  await repo.recordNotification({ paper_id: "p1", status: "sent" });
  await repo.recordNotification({ paper_id: "other", status: "sent" });
  assert.equal((await repo.findNotificationsBySubmissionId("p1")).length, 1);
});

test("routes handlePaperDecisionGet extracts empty paper id fallback branch", async () => {
  let capturedPaperId = "unset";
  const routes = createRoutes({
    submissionController: {},
    draftController: {},
    decisionController: {
      async handleListPapers() {
        return { status: 200, headers: {}, body: "" };
      },
      async handleGetDecision(req) {
        capturedPaperId = req.params.paper_id;
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true }),
        };
      },
    },
  });

  const response = await routes.handlePaperDecisionGet(
    { headers: {} },
    new URL("http://localhost/papers//decision")
  );
  assert.equal(response.status, 200);
  assert.equal(capturedPaperId, "");
});

test("decision_visibility covers comparison line when decision is published", () => {
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
      decision: { published_at: "2026-02-01T00:00:00.000Z" },
      requestingAuthorId: "author_2",
      submittingAuthorId: "author_1",
    }),
    false
  );
});
