const test = require("node:test");
const assert = require("node:assert/strict");

const { createDraftController } = require("../../src/controllers/draft_controller");
const { createRoutes } = require("../../src/controllers/routes");
const { createSubmissionController } = require("../../src/controllers/submission_controller");
const {
  ALLOWED_DRAFT_FIELDS,
  normalizeDraftData,
  validateProvidedDraftFields,
} = require("../../src/services/validation_service");
const { createLoggingService } = require("../../src/services/logging_service");
const { createSubmissionRepository } = require("../../src/services/submission_repository");

function makeDraftController({ session, getDraftResult, saveDraftResult } = {}) {
  const draftService = {
    async getDraft() {
      return getDraftResult;
    },
    async saveDraft() {
      return saveDraftResult;
    },
  };

  const sessionService = {
    validate() {
      return session || null;
    },
  };

  return createDraftController({ draftService, sessionService });
}

test("draft_controller handleGetDraft covers unauthenticated and all result branches", async () => {
  const unauth = makeDraftController({ session: null });
  const unauthRes = await unauth.handleGetDraft({ headers: {}, params: { submission_id: "s1" } });
  assert.equal(unauthRes.status, 401);

  const success = makeDraftController({
    session: { user_id: "a1" },
    getDraftResult: {
      type: "success",
      draft: {
        draft_id: "d1",
        submission_id: "s1",
        author_id: "a1",
        saved_at: "2026-01-01T00:00:00.000Z",
        data: { title: "t" },
      },
    },
  });
  const successRes = await success.handleGetDraft({ headers: {}, params: { submission_id: "s1" } });
  assert.equal(successRes.status, 200);
  assert.equal(JSON.parse(successRes.body).draftId, "d1");

  const forbidden = makeDraftController({
    session: { user_id: "a1" },
    getDraftResult: { type: "forbidden", message: "Access denied." },
  });
  assert.equal((await forbidden.handleGetDraft({ headers: {}, params: { submission_id: "s1" } })).status, 403);

  const validation = makeDraftController({
    session: { user_id: "a1" },
    getDraftResult: { type: "validation_error", message: "bad" },
  });
  assert.equal((await validation.handleGetDraft({ headers: {}, params: { submission_id: "" } })).status, 400);

  const notFound = makeDraftController({
    session: { user_id: "a1" },
    getDraftResult: { type: "not_found" },
  });
  assert.equal((await notFound.handleGetDraft({ headers: {}, params: { submission_id: "s1" } })).status, 404);
});

test("draft_controller getSession fallback covers missing req/headers path", async () => {
  let validatedSessionId = "unset";
  const controller = createDraftController({
    draftService: {
      async getDraft() {
        return { type: "not_found" };
      },
      async saveDraft() {
        return { type: "system_error", message: "failed" };
      },
    },
    sessionService: {
      validate(sessionId) {
        validatedSessionId = sessionId;
        return null;
      },
    },
  });

  const response = await controller.handleGetDraft();
  assert.equal(response.status, 401);
  assert.equal(validatedSessionId, "");
});

test("draft_controller handlePutDraft covers auth, idempotency, and result branches", async () => {
  const unauth = makeDraftController({ session: null });
  const jsonUnauth = await unauth.handlePutDraft({
    headers: { accept: "application/json" },
    params: { submission_id: "s1" },
    body: {},
  });
  assert.equal(jsonUnauth.status, 401);

  const htmlUnauth = await unauth.handlePutDraft({
    headers: { accept: "text/html" },
    params: { submission_id: "s1" },
    body: {},
  });
  assert.equal(htmlUnauth.status, 302);

  const validation = makeDraftController({
    session: { user_id: "author-1" },
    saveDraftResult: { type: "validation_error", message: "bad", fieldErrors: { title: "x" } },
  });
  const validationRes = await validation.handlePutDraft({
    headers: { cookie: "cms_session=s1" },
    params: { submission_id: "s1" },
    body: { data: {} },
  });
  assert.equal(validationRes.status, 400);

  const forbidden = makeDraftController({
    session: { user_id: "author-1" },
    saveDraftResult: { type: "forbidden", message: "denied" },
  });
  assert.equal(
    (
      await forbidden.handlePutDraft({
        headers: { cookie: "cms_session=s1" },
        params: { submission_id: "s1" },
        body: { data: {} },
      })
    ).status,
    403
  );

  const systemError = makeDraftController({
    session: { user_id: "author-1" },
    saveDraftResult: { type: "system_error", message: "failed" },
  });
  assert.equal(
    (
      await systemError.handlePutDraft({
        headers: { cookie: "cms_session=s1" },
        params: { submission_id: "s1" },
        body: { data: {} },
      })
    ).status,
    500
  );

  const success = makeDraftController({
    session: { user_id: "author-1" },
    saveDraftResult: {
      type: "success",
      conflictDetected: false,
      draft: {
        draft_id: "d1",
        submission_id: "s1",
        author_id: "author-1",
        saved_at: "2026-01-01T00:00:00.000Z",
        data: { title: "hello" },
      },
    },
  });

  const first = await success.handlePutDraft({
    headers: { cookie: "cms_session=s1", "x-idempotency-key": "k1" },
    params: { submission_id: "s1" },
    body: { data: { title: "hello" }, expectedSavedAt: "old" },
  });
  const second = await success.handlePutDraft({
    headers: { cookie: "cms_session=s1", "x-idempotency-key": "k1" },
    params: { submission_id: "s1" },
    body: { data: { title: "changed" } },
  });
  assert.equal(first.status, 200);
  assert.equal(second.body, first.body);

  const successConflict = makeDraftController({
    session: { user_id: "author-1" },
    saveDraftResult: {
      type: "success",
      conflictDetected: true,
      draft: {
        draft_id: "d1",
        submission_id: "s1",
        author_id: "author-1",
        saved_at: "2026-01-01T00:00:00.000Z",
        data: {},
      },
    },
  });
  const conflictRes = await successConflict.handlePutDraft({
    headers: { cookie: "cms_session=s1" },
    params: { submission_id: "s1" },
    body: { data: {}, idempotency_key: "body-key" },
  });
  assert.equal(conflictRes.status, 200);
  assert.equal(JSON.parse(conflictRes.body).conflictDetected, true);
});

test("draft_controller covers content-type JSON detection and cookie parsing in getSession", async () => {
  let validatedSessionId = "unset";
  const controller = createDraftController({
    draftService: {
      async getDraft() {
        return { type: "not_found" };
      },
      async saveDraft() {
        return { type: "system_error", message: "failed" };
      },
    },
    sessionService: {
      validate(sessionId) {
        validatedSessionId = sessionId;
        return null;
      },
    },
  });

  const response = await controller.handlePutDraft({
    headers: {
      cookie: "cms_session=sid%5Fencoded",
      "content-type": "application/json",
    },
    params: { submission_id: "s1" },
    body: {},
  });

  assert.equal(response.status, 401);
  assert.equal(validatedSessionId, "sid_encoded");
});

test("draft_controller handlePutDraft covers missing params/body and fieldErrors fallback", async () => {
  let captured = null;
  const controller = createDraftController({
    draftService: {
      async getDraft() {
        return { type: "not_found" };
      },
      async saveDraft(input) {
        captured = input;
        return {
          type: "validation_error",
          message: "bad",
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "author-1" };
      },
    },
  });

  const response = await controller.handlePutDraft({
    headers: { cookie: "cms_session=s1" },
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.deepEqual(payload.fieldErrors, {});
  assert.deepEqual(captured, {
    submission_id: "",
    author_id: "author-1",
    data: undefined,
    expected_saved_at: undefined,
  });
});

test("validation_service covers normalization filtering and all validation branches", () => {
  assert.equal(Array.isArray(ALLOWED_DRAFT_FIELDS), true);

  const normalized = normalizeDraftData({
    title: "  T  ",
    abstract: " A ",
    ignored: "x",
    keywords: 123,
    affiliation: null,
    contact_email: "  e@example.com  ",
  });
  assert.deepEqual(normalized, {
    title: "T",
    abstract: "A",
    keywords: "123",
    affiliation: "",
    contact_email: "e@example.com",
  });
  assert.deepEqual(normalizeDraftData("bad-input"), {});

  const errors = validateProvidedDraftFields({
    title: "x".repeat(301),
    abstract: "x".repeat(5001),
    keywords: "x".repeat(501),
    affiliation: "x".repeat(201),
    contact_email: "bad-email",
  });
  assert.equal(errors.title, "Title must be 300 characters or fewer.");
  assert.equal(errors.abstract, "Abstract must be 5000 characters or fewer.");
  assert.equal(errors.keywords, "Keywords must be 500 characters or fewer.");
  assert.equal(errors.affiliation, "Affiliation must be 200 characters or fewer.");
  assert.equal(errors.contact_email, "Contact email must be valid.");
  assert.deepEqual(validateProvidedDraftFields({ contact_email: "ok@example.com" }), {});
});

test("logging_service covers custom sink and default fallback values", () => {
  const entries = [];
  const logger = createLoggingService({
    sink: {
      log(value) {
        entries.push(JSON.parse(value));
      },
    },
  });

  logger.logSaveFailure({ submission_id: "s1", author_id: "a1" });
  logger.logUnauthorizedAccess({ submission_id: "s1", actor_author_id: "a2", owner_author_id: "a1" });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].event, "draft_save_failure");
  assert.equal(entries[0].reason, "unknown");
  assert.equal(entries[0].error_code, "UNKNOWN_ERROR");
  assert.equal(entries[1].event, "draft_unauthorized_access");
  assert.equal(entries[1].action, "unknown");
});

test("submission_repository covers draft initialization and upsertDraft branches", async () => {
  const store = { submissions: [], drafts: "wrong-shape" };
  const repo = createSubmissionRepository({ store });

  assert.deepEqual(store.drafts, []);
  assert.equal(await repo.findDraftBySubmissionId("d-missing"), null);

  const created = await repo.upsertDraft({
    draft_id: "d1",
    submission_id: "s1",
    author_id: "a1",
    saved_at: "2026-01-01T00:00:00.000Z",
    data: { title: "first" },
  });
  assert.equal(created.draft_id, "d1");
  assert.equal((await repo.findDraftBySubmissionId("s1")).data.title, "first");

  const updated = await repo.upsertDraft({
    submission_id: "s1",
    data: { title: "second" },
  });
  assert.equal(updated.data.title, "second");
});

test("submission_controller handleGetForm covers draft prefill success and fallback", async () => {
  const controller = createSubmissionController({
    submissionService: {
      async submit() {
        return { type: "system_error" };
      },
      async getSubmission() {
        return null;
      },
    },
    sessionService: {
      validate() {
        return { user_id: "author-1" };
      },
    },
    draftService: {
      async getDraft() {
        return {
          type: "success",
          draft: {
            saved_at: "2026-01-01T00:00:00.000Z",
            data: { title: "Draft Title", abstract: "Draft Abstract" },
          },
        };
      },
    },
  });

  const loaded = await controller.handleGetForm({ headers: {}, query: { draft: "s1" } });
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.includes("Draft loaded."), true);
  assert.equal(loaded.body.includes('value="Draft Title"'), true);

  const noLoad = createSubmissionController({
    submissionService: {
      async submit() {
        return { type: "system_error" };
      },
      async getSubmission() {
        return null;
      },
    },
    sessionService: {
      validate() {
        return { user_id: "author-1" };
      },
    },
    draftService: {
      async getDraft() {
        return { type: "not_found" };
      },
    },
  });

  const fallback = await noLoad.handleGetForm({ headers: {}, query: { draft: "s1" } });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.includes("Draft loaded."), false);
});

test("routes covers draft predicates and draft handler branches", async () => {
  const calls = [];
  const routes = createRoutes({
    submissionController: {
      async handleGetForm() {
        return { ok: true };
      },
      async handlePost() {
        return { ok: true };
      },
      async handleGetConfirmation() {
        return { ok: true };
      },
    },
    draftController: {
      async handleGetDraft(input) {
        calls.push({ type: "get", input });
        return { status: 200, body: "ok" };
      },
      async handlePutDraft(input) {
        calls.push({ type: "put", input });
        return { status: 200, body: "ok" };
      },
    },
  });

  assert.equal(routes.isDraftGet({ method: "GET" }, { pathname: "/submissions/s1/draft" }), true);
  assert.equal(routes.isDraftGet({ method: "POST" }, { pathname: "/submissions/s1/draft" }), false);
  assert.equal(routes.isDraftPut({ method: "PUT" }, { pathname: "/submissions/s1/draft" }), true);
  assert.equal(routes.isDraftPut({ method: "PUT" }, { pathname: "/submissions/s1" }), false);

  const handledGet = await routes.handleDraftGet({ headers: { accept: "application/json" } }, { pathname: "/submissions/s1/draft" });
  const handledPut = await routes.handleDraftPut(
    { headers: { accept: "application/json" } },
    { pathname: "/submissions/s1/draft" },
    { data: {} }
  );

  assert.equal(handledGet.status, 200);
  assert.equal(handledPut.status, 200);
  assert.equal(calls[0].input.params.submission_id, "s1");
  assert.equal(calls[1].input.params.submission_id, "s1");

  const noDraftRoutes = createRoutes({
    submissionController: {
      async handleGetForm() {
        return { ok: true };
      },
      async handlePost() {
        return { ok: true };
      },
      async handleGetConfirmation() {
        return { ok: true };
      },
    },
  });

  const noDraftGet = await noDraftRoutes.handleDraftGet({ headers: {} }, { pathname: "/submissions/s1/draft" });
  const noDraftPut = await noDraftRoutes.handleDraftPut({ headers: {} }, { pathname: "/submissions/s1/draft" }, {});
  assert.equal(noDraftGet.status, 404);
  assert.equal(noDraftPut.status, 404);
});
