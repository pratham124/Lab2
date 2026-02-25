const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeOutcome, isEditorRole, areRequiredReviewsComplete } = require("../../src/services/validation");
const { json, error } = require("../../src/controllers/response");
const { createDecision } = require("../../src/models/decision");
const { createDecisionView } = require("../../src/models/decision_view");
const { createNotificationAttempt } = require("../../src/models/notification_attempt");
const { createReviewAssignment } = require("../../src/models/review_assignment");
const { createRepository } = require("../../src/services/repository");
const { createReviewStatusService } = require("../../src/services/review_status_service");
const { createDecisionService } = require("../../src/services/decision_service");
const { createDecisionNotificationService } = require("../../src/services/notification_service");
const { createDecisionController } = require("../../src/controllers/decision_controller");
const { createNotificationResendController } = require("../../src/controllers/notification_resend_controller");

test("validation helpers cover normalize, role check, and completeness branches", () => {
  assert.equal(normalizeOutcome("accepted"), "accept");
  assert.equal(normalizeOutcome(" rejected "), "reject");
  assert.equal(normalizeOutcome("accept"), "accept");
  assert.equal(normalizeOutcome("reject"), "reject");
  assert.equal(normalizeOutcome("hold"), null);

  assert.equal(isEditorRole("Editor"), true);
  assert.equal(isEditorRole("author"), false);

  assert.equal(
    areRequiredReviewsComplete({
      assignments: [
        { required: true, status: "submitted" },
        { required: true, status: "submitted" },
      ],
      requiredCount: 2,
    }),
    true
  );
  assert.equal(
    areRequiredReviewsComplete({
      assignments: [
        { required: true, status: "submitted" },
        { required: true, status: "pending" },
      ],
      requiredCount: 2,
    }),
    false
  );
  assert.equal(
    areRequiredReviewsComplete({
      assignments: [{ required: true, status: "submitted" }],
      requiredCount: 2,
    }),
    false
  );
  assert.equal(areRequiredReviewsComplete({ assignments: null, requiredCount: "NaN" }), true);
  assert.equal(normalizeOutcome(undefined), null);
  assert.equal(
    areRequiredReviewsComplete({
      assignments: [{ required: true, status: null }],
      requiredCount: 1,
    }),
    false
  );
});

test("response helpers serialize payload and optional error code branch", () => {
  const ok = json(201, { created: true });
  assert.equal(ok.status, 201);
  assert.equal(ok.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(ok.body), { created: true });

  const withCode = error(400, "bad", "bad_request");
  assert.deepEqual(JSON.parse(withCode.body), { message: "bad", errorCode: "bad_request" });

  const withoutCode = error(404, "missing");
  assert.deepEqual(JSON.parse(withoutCode.body), { message: "missing" });
});

test("model constructors cover defaults and validation errors", () => {
  assert.throws(() => createDecision({ paperId: "P1", outcome: "hold" }), /invalid_decision/);
  const decision = createDecision({ paperId: "P1", outcome: "accepted", final: false });
  assert.equal(decision.paperId, "P1");
  assert.equal(decision.outcome, "accept");
  assert.equal(decision.final, false);
  assert.equal(decision.notificationStatus, "failed");

  assert.throws(() => createNotificationAttempt({ paperId: "P1", decisionId: "d1" }), /invalid_notification_attempt/);
  const attempt = createNotificationAttempt({
    paperId: "P1",
    decisionId: "d1",
    authorId: "a1",
    errorReason: 22,
  });
  assert.equal(attempt.status, "failed");
  assert.equal(attempt.errorReason, "22");

  assert.throws(() => createReviewAssignment({ paperId: "P1" }), /invalid_review_assignment/);
  const assignment = createReviewAssignment({ paperId: "P1", reviewerId: "r1" });
  assert.equal(assignment.status, "pending");
  assert.equal(assignment.required, false);

  const viewDefaults = createDecisionView();
  assert.deepEqual(viewDefaults, {
    paperId: "",
    paperTitle: "",
    outcome: "",
    recordedAt: null,
    final: false,
  });
});

test("repository covers submission conversion, decision mapping, assignment lookup, and attempts", async () => {
  const store = {
    submissions: [
      {
        submission_id: "P1",
        title: "Paper 1",
        author_id: "a1",
        contact_email: "a1@example.com",
        required_review_count: 2,
        review_assignments: [{ paper_id: "P1", required: true, status: "submitted" }],
        final_decision: {
          id: "D1",
          decision_value: "Rejected",
          published_at: "2026-02-01T00:00:00.000Z",
          final: true,
          notificationStatus: "partial",
        },
      },
      {
        id: "P2",
        title: "Paper 2",
        author_ids: ["a2", "a3"],
        authors: [{ id: "a2", email: "a2@example.com" }],
      },
    ],
    reviewAssignments: [{ paperId: "P_STORE", required: true, status: "submitted" }],
    notificationAttempts: [],
  };

  const upserts = [];
  const repository = createRepository({
    store,
    submissionRepository: {
      async findById(id) {
        return store.submissions.find((entry) => String(entry.submission_id || entry.id) === String(id)) || null;
      },
      async upsertDecision(payload) {
        upserts.push(payload);
      },
    },
  });

  const p1 = await repository.getPaperById("P1");
  assert.deepEqual(p1.authorIds, ["a1"]);
  assert.equal(p1.authors[0].email, "a1@example.com");

  const p2 = await repository.getPaperById("P2");
  assert.deepEqual(p2.authorIds, ["a2", "a3"]);
  assert.deepEqual(p2.authors, [{ id: "a2", email: "a2@example.com" }]);

  assert.equal(await repository.getPaperTitleById("MISSING"), null);

  const decision = await repository.getDecisionByPaperId("P1");
  assert.equal(decision.outcome, "reject");
  assert.equal(decision.notificationStatus, "partial");
  assert.equal(await repository.getDecisionByPaperId("MISSING"), null);

  await repository.saveDecision({
    id: "D9",
    paperId: "P1",
    outcome: "accept",
    recordedAt: "2026-02-01T02:00:00.000Z",
    final: true,
    notificationStatus: "sent",
  });
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].decision.decision_value, "Accepted");

  await repository.updateDecisionNotificationStatus({ paperId: "P1", notificationStatus: "failed" });
  assert.equal(upserts.length, 2);
  assert.equal(upserts[1].decision.notification_status, "failed");
  assert.equal(await repository.updateDecisionNotificationStatus({ paperId: "UNKNOWN", notificationStatus: "sent" }), null);

  const fromStore = await repository.listReviewAssignments("P_STORE");
  assert.equal(fromStore.length, 1);
  const fromPaper = await repository.listReviewAssignments("P1");
  assert.equal(fromPaper.length, 1);
  const none = await repository.listReviewAssignments("UNKNOWN");
  assert.equal(none.length, 0);

  await repository.recordNotificationAttempt({ decisionId: "D1", authorId: "a1", attemptedAt: "2026-02-01T00:00:00.000Z", status: "failed" });
  await repository.recordNotificationAttempt({ decisionId: "D1", authorId: "a1", attemptedAt: "2026-02-01T01:00:00.000Z", status: "delivered" });
  await repository.recordNotificationAttempt({ decisionId: "D1", authorId: "a2", attemptedAt: "2026-02-01T00:30:00.000Z", status: "failed" });

  const list = await repository.listNotificationAttemptsByDecisionId("D1");
  assert.equal(list.length, 3);
  const failedLatest = await repository.listLatestFailedAuthorIdsByDecisionId("D1");
  assert.deepEqual(failedLatest, ["a2"]);
});

test("repository handles missing submission repository methods", async () => {
  const repoNoFind = createRepository({ store: {} });
  assert.equal(await repoNoFind.getPaperById("P1"), null);

  const repoNoUpsert = createRepository({ submissionRepository: { async findById() { return null; } }, store: {} });
  await assert.rejects(
    () =>
      repoNoUpsert.saveDecision({
        id: "D1",
        paperId: "P1",
        outcome: "reject",
        recordedAt: "2026-02-01T00:00:00.000Z",
        final: true,
        notificationStatus: "failed",
      }),
    /submission_repository_not_available/
  );
});

test("review status service covers constructor, not-found, and success", async () => {
  assert.throws(() => createReviewStatusService(), /repository is required/);

  const service = createReviewStatusService({
    repository: {
      async getPaperById(id) {
        if (id === "missing") {
          return null;
        }
        return { id: "P1", requiredReviewCount: 2 };
      },
      async listReviewAssignments() {
        return [
          { required: true, status: "submitted" },
          { required: true, status: "in_progress" },
        ];
      },
    },
  });

  const missing = await service.getReviewStatus({ paperId: "missing" });
  assert.equal(missing.type, "not_found");

  const found = await service.getReviewStatus({ paperId: "P1" });
  assert.equal(found.type, "success");
  assert.equal(found.status.submittedRequiredCount, 1);
  assert.equal(found.status.complete, false);
});

function buildDecisionServiceHarness(overrides = {}) {
  const calls = { saveDecision: 0, updateDecisionNotificationStatus: 0 };
  const base = {
    async getPaperById(id) {
      if (id === "missing") {
        return null;
      }
      return { id, title: "Paper", authorIds: ["author_1"], authors: [{ id: "author_1", email: "a1@example.com" }] };
    },
    async getDecisionByPaperId(id) {
      if (id === "has_final") {
        return { id: "d1", final: true };
      }
      if (id === "no_decision") {
        return null;
      }
      return { id: "d2", final: false, outcome: "accept", recordedAt: "2026-02-01T00:00:00.000Z" };
    },
    async saveDecision() {
      calls.saveDecision += 1;
    },
    async updateDecisionNotificationStatus() {
      calls.updateDecisionNotificationStatus += 1;
    },
  };

  const reviewStatusService = {
    async getReviewStatus({ paperId }) {
      if (paperId === "review_missing") {
        return { type: "not_found" };
      }
      if (paperId === "review_incomplete") {
        return { type: "success", status: { complete: false } };
      }
      return { type: "success", status: { complete: true } };
    },
  };

  const notificationService = {
    async sendDecisionNotifications() {
      return { notificationStatus: "sent", failedAuthors: [] };
    },
    async resendFailedDecisionNotifications({ paper }) {
      if (paper.id === "no_failed") {
        return { type: "not_found" };
      }
      return { notificationStatus: "partial", failedAuthors: ["author_1"] };
    },
  };

  return {
    calls,
    service: createDecisionService({
      repository: { ...base, ...(overrides.repository || {}) },
      reviewStatusService: overrides.reviewStatusService || reviewStatusService,
      notificationService: overrides.notificationService || notificationService,
    }),
  };
}

test("decision service constructor validation branches", () => {
  assert.throws(() => createDecisionService({}), /repository is required/);
  assert.throws(() => createDecisionService({ repository: {} }), /notificationService is required/);
  assert.throws(
    () => createDecisionService({ repository: {}, notificationService: {} }),
    /reviewStatusService is required/
  );
});

test("decision service recordDecision covers validation and error branches", async () => {
  const { service } = buildDecisionServiceHarness();

  assert.equal((await service.recordDecision({ actor: { role: "editor" } })).type, "validation_error");
  assert.equal(
    (await service.recordDecision({ paperId: "P1", actor: { role: "author" }, outcome: "accept" })).type,
    "forbidden"
  );
  assert.equal(
    (await service.recordDecision({ paperId: "P1", actor: { role: "editor" }, outcome: "maybe" })).type,
    "validation_error"
  );
  assert.equal(
    (await service.recordDecision({ paperId: "missing", actor: { role: "editor" }, outcome: "accept" })).type,
    "not_found"
  );
  assert.equal(
    (await service.recordDecision({ paperId: "has_final", actor: { role: "editor" }, outcome: "accept" })).type,
    "conflict"
  );
  assert.equal(
    (await service.recordDecision({ paperId: "review_missing", actor: { role: "editor" }, outcome: "accept" })).type,
    "not_found"
  );
  assert.equal(
    (await service.recordDecision({ paperId: "review_incomplete", actor: { role: "editor" }, outcome: "accept" })).type,
    "validation_error"
  );

  const saveErrorHarness = buildDecisionServiceHarness({
    repository: {
      async saveDecision() {
        throw new Error("boom");
      },
    },
  });
  assert.equal(
    (await saveErrorHarness.service.recordDecision({ paperId: "P1", actor: { role: "editor" }, outcome: "accept" })).type,
    "storage_error"
  );
});

test("decision service success branches for record, resend, and get view", async () => {
  const { service, calls } = buildDecisionServiceHarness();

  const recorded = await service.recordDecision({ paperId: "P1", actor: { role: "editor" }, outcome: "accept" });
  assert.equal(recorded.type, "success");
  assert.equal(recorded.notificationStatus, "sent");
  assert.equal(calls.saveDecision, 1);
  assert.equal(calls.updateDecisionNotificationStatus, 1);

  assert.equal((await service.resendFailedNotifications({ actor: { role: "editor" } })).type, "validation_error");
  assert.equal(
    (await service.resendFailedNotifications({ paperId: "P1", actor: { role: "author" } })).type,
    "forbidden"
  );
  assert.equal(
    (await service.resendFailedNotifications({ paperId: "missing", actor: { role: "editor" } })).type,
    "not_found"
  );
  assert.equal(
    (await service.resendFailedNotifications({ paperId: "no_decision", actor: { role: "editor" } })).type,
    "not_found"
  );
  assert.equal(
    (await service.resendFailedNotifications({ paperId: "no_failed", actor: { role: "editor" } })).type,
    "not_found"
  );
  const resent = await service.resendFailedNotifications({ paperId: "P1", actor: { role: "editor" } });
  assert.equal(resent.type, "success");
  assert.equal(resent.notificationStatus, "partial");

  assert.equal((await service.getDecisionView({ actor: { id: "author_1" } })).type, "validation_error");
  assert.equal((await service.getDecisionView({ paperId: "missing", actor: { id: "author_1" } })).type, "not_found");
  assert.equal((await service.getDecisionView({ paperId: "P1", actor: { id: "other", role: "author" } })).type, "forbidden");
  assert.equal((await service.getDecisionView({ paperId: "no_decision", actor: { id: "author_1" } })).type, "not_found");

  const byAuthor = await service.getDecisionView({ paperId: "P1", actor: { id: "author_1", role: "author" } });
  assert.equal(byAuthor.type, "success");
  const byEditor = await service.getDecisionView({ paperId: "P1", actor: { id: "editor_1", role: "editor" } });
  assert.equal(byEditor.type, "success");
});

test("decision service covers authors array fallback and empty actor id branch", async () => {
  const calls = { sendPayloads: [] };
  const service = createDecisionService({
    repository: {
      async getPaperById(id) {
        return { id, title: "No Authors Array", authorIds: [], authors: null };
      },
      async getDecisionByPaperId(id) {
        if (id === "P1") {
          return null;
        }
        return { id: "d1", final: true, outcome: "accept", recordedAt: "2026-02-01T00:00:00.000Z" };
      },
      async saveDecision() {},
      async updateDecisionNotificationStatus() {},
    },
    reviewStatusService: {
      async getReviewStatus() {
        return { type: "success", status: { complete: true } };
      },
    },
    notificationService: {
      async sendDecisionNotifications(payload) {
        calls.sendPayloads.push(payload);
        return { notificationStatus: "sent", failedAuthors: [] };
      },
      async resendFailedDecisionNotifications(payload) {
        calls.sendPayloads.push(payload);
        return { notificationStatus: "sent", failedAuthors: [] };
      },
    },
  });

  const recorded = await service.recordDecision({
    paperId: "P1",
    outcome: "accept",
    actor: { role: "editor" },
  });
  assert.equal(recorded.type, "success");
  assert.deepEqual(calls.sendPayloads[0].authors, []);

  const view = await service.getDecisionView({
    paperId: "P2",
    actor: {},
  });
  assert.equal(view.type, "forbidden");

  const resent = await service.resendFailedNotifications({
    paperId: "P2",
    actor: { role: "editor" },
  });
  assert.equal(resent.type, "success");
  assert.deepEqual(calls.sendPayloads[1].authors, []);
});

test("decision notification service covers constructor, sent/partial/failed, and resend branches", async () => {
  assert.throws(() => createDecisionNotificationService(), /repository is required/);

  const attempts = [];
  const repo = {
    async recordNotificationAttempt(attempt) {
      attempts.push(attempt);
    },
    async listLatestFailedAuthorIdsByDecisionId(decisionId) {
      if (decisionId === "none") {
        return [];
      }
      return ["a2"];
    },
  };

  const service = createDecisionNotificationService({
    repository: repo,
    notifier: {
      async sendDecisionNotification({ author }) {
        if (author.id === "a2") {
          throw new Error("smtp_down");
        }
      },
    },
  });

  const partial = await service.sendDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "d1", paperId: "P1" },
    authors: [
      { id: "a1", email: "a1@example.com" },
      { id: "a2", email: "a2@example.com" },
    ],
  });
  assert.equal(partial.notificationStatus, "partial");
  assert.deepEqual(partial.failedAuthors, ["a2"]);

  const allFailed = await service.sendDecisionNotifications({
    paper: { id: "P2" },
    decision: { id: "d2", paperId: "P2" },
    authors: [{ id: "a3", email: "" }],
  });
  assert.equal(allFailed.notificationStatus, "failed");

  const sent = await service.sendDecisionNotifications({
    paper: { id: "P3" },
    decision: { id: "d3", paperId: "P3" },
    authors: [{ id: "a1", email: "a1@example.com" }],
  });
  assert.equal(sent.notificationStatus, "sent");

  const noFailed = await service.resendFailedDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "none", paperId: "P1" },
    authors: [{ id: "a1", email: "a1@example.com" }],
  });
  assert.equal(noFailed.type, "not_found");

  const resent = await service.resendFailedDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "d1", paperId: "P1" },
    authors: [
      { id: "a1", email: "a1@example.com" },
      { id: "a2", email: "a2@example.com" },
    ],
  });
  assert.equal(resent.notificationStatus, "failed");
  assert.deepEqual(resent.failedAuthors, ["a2"]);
  assert.equal(attempts.length >= 4, true);
});

test("decision notification service uses default notifier fallback", async () => {
  const attempts = [];
  const service = createDecisionNotificationService({
    repository: {
      async recordNotificationAttempt(attempt) {
        attempts.push(attempt);
      },
      async listLatestFailedAuthorIdsByDecisionId() {
        return [];
      },
    },
  });

  const result = await service.sendDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "d1", paperId: "P1" },
    authors: [{ id: "a1", email: "a1@example.com" }],
  });
  assert.equal(result.notificationStatus, "sent");
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, "delivered");
});

test("decision notification service covers fallback branches for authors input and error message default", async () => {
  const attempts = [];
  const service = createDecisionNotificationService({
    repository: {
      async recordNotificationAttempt(attempt) {
        attempts.push(attempt);
      },
      async listLatestFailedAuthorIdsByDecisionId() {
        return ["a1"];
      },
    },
    notifier: {
      async sendDecisionNotification() {
        throw {};
      },
    },
  });

  const nonArraySend = await service.sendDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "d1", paperId: "P1" },
    authors: { id: "a1" },
  });
  assert.equal(nonArraySend.notificationStatus, "sent");

  await assert.rejects(
    () =>
      service.sendDecisionNotifications({
        paper: { id: "P1" },
        decision: { id: "d1", paperId: "P1" },
        authors: [null],
      }),
    /invalid_notification_attempt/
  );

  const resendNonArray = await service.resendFailedDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "d1", paperId: "P1" },
    authors: {},
  });
  assert.equal(resendNonArray.notificationStatus, "sent");

  const resendWithDefaultReason = await service.resendFailedDecisionNotifications({
    paper: { id: "P1" },
    decision: { id: "d1", paperId: "P1" },
    authors: [{ id: "a1", email: "a1@example.com" }],
  });
  assert.equal(resendWithDefaultReason.notificationStatus, "failed");
  assert.equal(attempts[attempts.length - 1].errorReason, "notification_failed");
});

test("repository covers remaining fallback branches", async () => {
  const store = {
    submissions: [
      {
        submission_id: "PX",
        required_review_count: 0,
        final_decision: {
          recorded_at: null,
          published_at: null,
          final: true,
        },
      },
      {
        id: "PY",
        author_ids: [1, 2],
        author_id: "author_main",
        contact_email: "main@example.com",
        title: "",
        final_decision: null,
      },
      {
        id: "PZ",
        author_ids: [1, 2],
        author_id: "1",
        contact_email: "one@example.com",
      },
      {
        id: "PA",
        author_ids: ["author_a"],
        contact_email: "a@example.com",
      },
      {
        title: null,
      },
    ],
    reviewAssignments: [{ paper_id: "paper_only_in_paper_id", required: true, status: "submitted" }],
    notificationAttempts: [],
  };

  const repositoryDefaultStore = createRepository();
  assert.equal(typeof repositoryDefaultStore.getPaperById, "function");

  const repository = createRepository({
    store,
    submissionRepository: {
      async findById(id) {
        return store.submissions.find((entry) => String(entry.submission_id || entry.id || "") === String(id)) || null;
      },
      async upsertDecision() {},
    },
  });

  const px = await repository.getPaperById("PX");
  assert.deepEqual(px.authorIds, []);
  assert.equal(px.title, "");

  const pz = await repository.getPaperById("PZ");
  assert.equal(pz.authors[0].email, "one@example.com");
  assert.equal(pz.authors[1].email, "");
  const pa = await repository.getPaperById("PA");
  assert.equal(pa.authors[0].email, "");

  assert.equal(await repository.getPaperTitleById("missing"), null);
  assert.equal(await repository.getPaperTitleById("PZ"), "");
  const missingIdPaper = await repository.getPaperById(undefined);
  assert.equal(missingIdPaper.id, "");
  assert.equal(missingIdPaper.title, "");
  await repository.getPaperById(undefined);

  const decision = await repository.getDecisionByPaperId("PX");
  assert.equal(decision.id, "");
  assert.equal(decision.notificationStatus, "failed");

  const reviewAssignments = await repository.listReviewAssignments("paper_only_in_paper_id");
  assert.equal(reviewAssignments.length, 1);
});

test("review status service covers assignments fallback and required count fallback", async () => {
  const service = createReviewStatusService({
    repository: {
      async getPaperById() {
        return { id: "P1", requiredReviewCount: undefined };
      },
      async listReviewAssignments() {
        return undefined;
      },
    },
  });

  const result = await service.getReviewStatus({ paperId: "P1" });
  assert.equal(result.type, "success");
  assert.equal(result.status.requiredCount, 0);
  assert.equal(result.status.submittedRequiredCount, 0);
});

test("review status service covers status fallback branch on required assignments", async () => {
  const service = createReviewStatusService({
    repository: {
      async getPaperById() {
        return { id: "P2", requiredReviewCount: 1 };
      },
      async listReviewAssignments() {
        return [{ required: true, status: undefined }];
      },
    },
  });

  const result = await service.getReviewStatus({ paperId: "P2" });
  assert.equal(result.type, "success");
  assert.equal(result.status.submittedRequiredCount, 0);
  assert.equal(result.status.complete, false);
});

test("decision controller covers session/fallback actor and response mapping branches", async () => {
  assert.throws(() => createDecisionController({}), /decisionService is required/);

  const responses = {
    success: { type: "success", decisionId: "d1", final: true, notificationStatus: "sent", failedAuthors: [] },
    forbidden: { type: "forbidden", message: "forbidden" },
    validation_error: { type: "validation_error", message: "bad" },
    not_found: { type: "not_found", message: "missing" },
    conflict: { type: "conflict", message: "duplicate" },
    storage_error: { type: "storage_error", message: "store" },
    unknown: { type: "unknown" },
  };

  const decisionService = {
    async recordDecision({ outcome }) {
      return responses[outcome];
    },
    async getDecisionView({ paperId }) {
      if (paperId === "ok") {
        return { type: "success", decision: { paperId: "ok" } };
      }
      if (paperId === "bad") {
        return { type: "validation_error", message: "bad" };
      }
      if (paperId === "forbidden") {
        return { type: "forbidden", message: "no" };
      }
      if (paperId === "missing") {
        return { type: "not_found", message: "missing" };
      }
      return { type: "unknown" };
    },
  };

  const controller = createDecisionController({
    decisionService,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid") {
          return { user_id: "u1", role: "editor" };
        }
        return null;
      },
    },
  });

  const unauth = await controller.handlePostDecision({ headers: {}, params: { paper_id: "P1" }, body: { outcome: "success" } });
  assert.equal(unauth.status, 401);

  for (const [key, expectedStatus] of [
    ["success", 200],
    ["forbidden", 403],
    ["validation_error", 400],
    ["not_found", 404],
    ["conflict", 409],
    ["storage_error", 500],
    ["unknown", 503],
  ]) {
    const response = await controller.handlePostDecision({
      headers: { cookie: "cms_session=sid" },
      params: { paper_id: "P1" },
      body: { outcome: key },
    });
    assert.equal(response.status, expectedStatus);
  }

  const fallback = await controller.handlePostDecision({
    headers: { "x-user-id": "u2", "x-user-role": "editor" },
    params: { paper_id: "P1" },
    body: { outcome: "success" },
  });
  assert.equal(fallback.status, 200);

  const malformedCookie = await controller.handlePostDecision({
    headers: { cookie: "badcookie; cms_session=sid" },
    params: { paper_id: "P1" },
    body: { outcome: "success" },
  });
  assert.equal(malformedCookie.status, 200);

  assert.equal((await controller.handleGetDecision({ headers: {}, params: { paper_id: "ok" } })).status, 401);
  assert.equal((await controller.handleGetDecision({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "ok" } })).status, 200);
  assert.equal((await controller.handleGetDecision({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "bad" } })).status, 400);
  assert.equal((await controller.handleGetDecision({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "forbidden" } })).status, 403);
  assert.equal((await controller.handleGetDecision({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "missing" } })).status, 404);
  assert.equal((await controller.handleGetDecision({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "unknown" } })).status, 503);
});

test("notification resend controller covers constructor, auth branches, and response mapping", async () => {
  assert.throws(() => createNotificationResendController({}), /decisionService is required/);

  const decisionService = {
    async resendFailedNotifications({ paperId }) {
      if (paperId === "ok") {
        return { type: "success", notificationStatus: "partial", failedAuthors: ["a1"] };
      }
      if (paperId === "forbidden") {
        return { type: "forbidden", message: "forbidden" };
      }
      if (paperId === "bad") {
        return { type: "validation_error", message: "bad" };
      }
      if (paperId === "missing") {
        return { type: "not_found", message: "missing" };
      }
      return { type: "unknown" };
    },
  };

  const controller = createNotificationResendController({
    decisionService,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid") {
          return { user_id: "u1", role: "editor" };
        }
        return null;
      },
    },
  });

  assert.equal((await controller.handlePostResend({ headers: {}, params: { paper_id: "ok" } })).status, 401);
  assert.equal((await controller.handlePostResend({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "ok" } })).status, 200);
  assert.equal((await controller.handlePostResend({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "forbidden" } })).status, 403);
  assert.equal((await controller.handlePostResend({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "bad" } })).status, 400);
  assert.equal((await controller.handlePostResend({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "missing" } })).status, 404);
  assert.equal((await controller.handlePostResend({ headers: { cookie: "cms_session=sid" }, params: { paper_id: "unknown" } })).status, 503);

  const fallback = await controller.handlePostResend({
    headers: { "x-user-id": "u2", "x-user-role": "editor" },
    params: { paper_id: "ok" },
  });
  assert.equal(fallback.status, 200);

  const malformedCookie = await controller.handlePostResend({
    headers: { cookie: "broken_token; cms_session=sid" },
    params: { paper_id: "ok" },
  });
  assert.equal(malformedCookie.status, 200);
});

test("controllers pass decoded session ids and normalized fallback roles to services", async () => {
  const captured = {
    decisionSessionIds: [],
    resendSessionIds: [],
    decisionActors: [],
    resendActors: [],
  };

  const decisionController = createDecisionController({
    decisionService: {
      async recordDecision({ actor }) {
        captured.decisionActors.push(actor);
        return {
          type: "success",
          decisionId: "d1",
          final: true,
          notificationStatus: "sent",
          failedAuthors: [],
        };
      },
      async getDecisionView() {
        return { type: "not_found", message: "missing" };
      },
    },
    sessionService: {
      validate(sessionId) {
        captured.decisionSessionIds.push(sessionId);
        if (sessionId === "sid value") {
          return { user_id: "u_session", role: "editor" };
        }
        return null;
      },
    },
  });

  const resendController = createNotificationResendController({
    decisionService: {
      async resendFailedNotifications({ actor }) {
        captured.resendActors.push(actor);
        return { type: "success", notificationStatus: "sent", failedAuthors: [] };
      },
    },
    sessionService: {
      validate(sessionId) {
        captured.resendSessionIds.push(sessionId);
        if (sessionId === "sid value") {
          return { user_id: "u_session", role: "editor" };
        }
        return null;
      },
    },
  });

  const postViaSession = await decisionController.handlePostDecision({
    headers: { cookie: "junk; cms_session=sid%20value" },
    params: { paper_id: "P1" },
    body: { outcome: "success" },
  });
  assert.equal(postViaSession.status, 200);
  assert.equal(captured.decisionSessionIds.includes("sid value"), true);
  assert.deepEqual(captured.decisionActors[0], { id: "u_session", role: "editor" });

  const postViaFallback = await decisionController.handlePostDecision({
    headers: { cookie: "invalid_token", "x-user-id": "u_fallback", "x-user-role": "  AUTHOR  " },
    params: { paper_id: "P1" },
    body: { outcome: "success" },
  });
  assert.equal(postViaFallback.status, 200);
  assert.deepEqual(captured.decisionActors[1], { id: "u_fallback", role: "author" });

  const resendViaSession = await resendController.handlePostResend({
    headers: { cookie: "bad; cms_session=sid%20value" },
    params: { paper_id: "P1" },
  });
  assert.equal(resendViaSession.status, 200);
  assert.equal(captured.resendSessionIds.includes("sid value"), true);
  assert.deepEqual(captured.resendActors[0], { id: "u_session", role: "editor" });

  const resendViaFallback = await resendController.handlePostResend({
    headers: { cookie: "invalid_token", "x-user-id": "u_fallback", "x-user-role": "  AUTHOR  " },
    params: { paper_id: "P1" },
  });
  assert.equal(resendViaFallback.status, 200);
  assert.deepEqual(captured.resendActors[1], { id: "u_fallback", role: "author" });
});

test("controllers cover empty cookie values, undefined headers, and missing role fallback branches", async () => {
  const seen = {
    decisionSessionIds: [],
    resendSessionIds: [],
    decisionActors: [],
    resendActors: [],
  };

  const decisionController = createDecisionController({
    decisionService: {
      async recordDecision({ actor }) {
        seen.decisionActors.push(actor);
        return {
          type: "success",
          decisionId: "d1",
          final: true,
          notificationStatus: "sent",
          failedAuthors: [],
        };
      },
      async getDecisionView() {
        return { type: "not_found", message: "missing" };
      },
    },
    sessionService: {
      validate(sessionId) {
        seen.decisionSessionIds.push(sessionId);
        return null;
      },
    },
  });

  const resendController = createNotificationResendController({
    decisionService: {
      async resendFailedNotifications({ actor }) {
        seen.resendActors.push(actor);
        return { type: "success", notificationStatus: "sent", failedAuthors: [] };
      },
    },
    sessionService: {
      validate(sessionId) {
        seen.resendSessionIds.push(sessionId);
        return null;
      },
    },
  });

  const decisionWithEmptyCookieValue = await decisionController.handlePostDecision({
    headers: { cookie: "cms_session=", "x-user-id": "u1" },
    params: { paper_id: "P1" },
    body: { outcome: "success" },
  });
  assert.equal(decisionWithEmptyCookieValue.status, 200);
  assert.equal(seen.decisionSessionIds.includes(""), true);
  assert.deepEqual(seen.decisionActors[0], { id: "u1", role: "" });

  const resendWithEmptyCookieValue = await resendController.handlePostResend({
    headers: { cookie: "cms_session=", "x-user-id": "u2" },
    params: { paper_id: "P1" },
  });
  assert.equal(resendWithEmptyCookieValue.status, 200);
  assert.equal(seen.resendSessionIds.includes(""), true);
  assert.deepEqual(seen.resendActors[0], { id: "u2", role: "" });

  const decisionWithoutHeaders = await decisionController.handlePostDecision({
    params: { paper_id: "P1" },
    body: { outcome: "success" },
  });
  assert.equal(decisionWithoutHeaders.status, 401);

  const resendWithoutHeaders = await resendController.handlePostResend({
    params: { paper_id: "P1" },
  });
  assert.equal(resendWithoutHeaders.status, 401);
});
