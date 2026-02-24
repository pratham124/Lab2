const test = require("node:test");
const assert = require("node:assert/strict");

const { createManuscriptController } = require("../../src/controllers/manuscript_controller");
const { createManuscriptRoutes } = require("../../src/routes/manuscripts");

function makeController({
  sessions = { sid_author: { user_id: "author-1", role: "author" } },
  submission = { submission_id: "s1", author_id: "author-1" },
  stored = null,
  saveImpl,
} = {}) {
  const submissions = new Map();
  if (submission) {
    submissions.set(submission.submission_id, { ...submission });
  }

  const repository = {
    async findById(id) {
      return submissions.get(id) || null;
    },
    async upsert(next) {
      submissions.set(next.submission_id, next);
      return next;
    },
  };

  const manuscriptStorage = {
    async save(input) {
      if (saveImpl) {
        return saveImpl(input);
      }
      return {
        file_id: "m_saved",
        submission_id: input.submission_id,
        filename: input.filename,
        format: input.format,
        size_bytes: Buffer.isBuffer(input.contentBuffer)
          ? input.contentBuffer.length
          : Buffer.from(String(input.contentBuffer || "")).length,
        uploaded_at: "2026-02-24T00:00:00.000Z",
      };
    },
    async getActiveBySubmissionId() {
      return stored;
    },
  };

  const sessionService = {
    validate(sessionId) {
      return sessions[sessionId] || null;
    },
  };

  const controller = createManuscriptController({
    submissionRepository: repository,
    manuscriptStorage,
    sessionService,
  });

  return {
    controller,
    submissions,
  };
}

function jsonHeaders(sessionId) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    cookie: sessionId ? `cms_session=${sessionId}` : "",
  };
}

function htmlHeaders(sessionId) {
  return {
    accept: "text/html",
    cookie: sessionId ? `cms_session=${sessionId}` : "",
  };
}

test("uc-05 manuscript_routes predicates and forwarding cover all handlers", async () => {
  const calls = [];
  const routes = createManuscriptRoutes({
    manuscriptController: {
      async handleGetUploadForm(req) {
        calls.push(["form", req]);
        return { status: 200 };
      },
      async handleUpload(req) {
        calls.push(["upload", req]);
        return { status: 200 };
      },
      async handleGetMetadata(req) {
        calls.push(["meta", req]);
        return { status: 200 };
      },
    },
  });

  assert.equal(routes.isUploadFormRoute({ method: "GET" }, { pathname: "/submissions/s1/manuscript/upload" }), true);
  assert.equal(routes.isUploadFormRoute({ method: "POST" }, { pathname: "/submissions/s1/manuscript/upload" }), false);

  assert.equal(routes.isUploadRoute({ method: "POST" }, { pathname: "/submissions/s1/manuscript" }), true);
  assert.equal(routes.isUploadRoute({ method: "GET" }, { pathname: "/submissions/s1/manuscript" }), false);

  assert.equal(routes.isMetadataRoute({ method: "GET" }, { pathname: "/submissions/s1/manuscript" }), true);
  assert.equal(routes.isMetadataRoute({ method: "POST" }, { pathname: "/submissions/s1/manuscript" }), false);

  await routes.handleUploadForm({ headers: { a: "1" } }, { pathname: "/submissions/s1/manuscript/upload" });
  await routes.handleUpload(
    { headers: { b: "2" } },
    { pathname: "/submissions/s1/manuscript" },
    { file: true }
  );
  await routes.handleMetadata({ headers: { c: "3" } }, { pathname: "/submissions/s1/manuscript" });
  await routes.handleMetadata({ headers: { d: "4" } }, { pathname: "/submissions" });

  assert.equal(calls[0][1].params.submission_id, "s1");
  assert.equal(calls[1][1].params.submission_id, "s1");
  assert.equal(calls[2][1].params.submission_id, "s1");
  assert.equal(calls[3][1].params.submission_id, "");
});

test("uc-05 manuscript_controller get form covers auth, not found, forbidden, and success branches", async () => {
  const unauth = makeController({ sessions: {} }).controller;
  const unauthHtml = await unauth.handleGetUploadForm({ headers: htmlHeaders() , params: { submission_id: "s1" }});
  assert.equal(unauthHtml.status, 302);

  const unauthJson = await unauth.handleGetUploadForm({ headers: jsonHeaders(), params: { submission_id: "s1" } });
  assert.equal(unauthJson.status, 401);

  const missing = makeController({ submission: null }).controller;
  const missingHtml = await missing.handleGetUploadForm({ headers: htmlHeaders("sid_author"), params: { submission_id: "s1" } });
  assert.equal(missingHtml.status, 404);
  assert.equal(missingHtml.body, "Not found");

  const missingJson = await missing.handleGetUploadForm({ headers: jsonHeaders("sid_author"), params: { submission_id: "s1" } });
  assert.equal(missingJson.status, 404);

  const forbidden = makeController({
    sessions: { sid_random: { user_id: "u2", role: "reviewer" } },
  }).controller;
  const forbiddenResp = await forbidden.handleGetUploadForm({ headers: jsonHeaders("sid_random"), params: { submission_id: "s1" } });
  assert.equal(forbiddenResp.status, 403);

  const success = makeController({ stored: { filename: "current.pdf" } }).controller;
  const successResp = await success.handleGetUploadForm({ headers: htmlHeaders("sid_author"), params: { submission_id: "s1" } });
  assert.equal(successResp.status, 200);
  assert.equal(successResp.body.includes("Current attached file: current.pdf"), true);
});

test("uc-05 manuscript_controller upload covers context errors, duplicate token, validation, success and catch branches", async () => {
  const unauth = makeController({ sessions: {} }).controller;
  const unauthUpload = await unauth.handleUpload({
    headers: jsonHeaders(),
    params: { submission_id: "s1" },
    body: { file: { filename: "paper.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") } },
  });
  assert.equal(unauthUpload.status, 401);

  const { controller, submissions } = makeController();
  const invalidHtml = await controller.handleUpload({
    headers: htmlHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_invalid",
      file: { filename: "bad.exe", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(invalidHtml.status, 400);
  assert.equal(invalidHtml.body.includes("Invalid file format"), true);

  const retrySameToken = await controller.handleUpload({
    headers: jsonHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_invalid",
      manuscript: { filename: "ok.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(retrySameToken.status, 200);

  const duplicate = await controller.handleUpload({
    headers: jsonHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_dup",
      file: { filename: "ok2.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(duplicate.status, 200);

  const duplicateAgain = await controller.handleUpload({
    headers: jsonHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_dup",
      file: { filename: "ok2.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(duplicateAgain.status, 409);

  const htmlSuccessNoToken = await controller.handleUpload({
    headers: htmlHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      file: { filename: "ok3.pdf", sizeBytes: 12, contentBuffer: Buffer.from("xyz") },
    },
  });
  assert.equal(htmlSuccessNoToken.status, 200);
  assert.equal(htmlSuccessNoToken.body.includes("Uploaded ok3.pdf successfully."), true);

  const storedSubmission = submissions.get("s1");
  assert.equal(storedSubmission.manuscript.filename, "ok3.pdf");

  const controllerHtmlCatch = makeController({
    saveImpl: async () => {
      const error = new Error("fail");
      error.code = "upload_failed";
      throw error;
    },
  }).controller;
  const htmlCatch = await controllerHtmlCatch.handleUpload({
    headers: htmlHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_html_catch",
      file: { filename: "f.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(htmlCatch.status, 500);
  assert.equal(htmlCatch.body.includes("Upload failed"), true);

  const controllerJsonCatch = makeController({
    saveImpl: async () => {
      const error = new Error("unexpected");
      error.code = "odd_failure";
      throw error;
    },
  }).controller;
  const jsonCatch = await controllerJsonCatch.handleUpload({
    headers: jsonHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_json_catch",
      file: { filename: "f.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(jsonCatch.status, 500);
  assert.equal(JSON.parse(jsonCatch.body).message.includes("Unable to upload"), true);

  const retriedTokenAfterFailure = await controllerJsonCatch.handleUpload({
    headers: jsonHeaders("sid_author"),
    params: { submission_id: "s1" },
    body: {
      idempotency_token: "t_json_catch",
      file: { filename: "f.pdf", sizeBytes: 10, contentBuffer: Buffer.from("x") },
    },
  });
  assert.equal(retriedTokenAfterFailure.status, 500);
});

test("uc-05 manuscript_controller metadata covers error and success branches", async () => {
  const noActive = makeController({ stored: null }).controller;
  const missing = await noActive.handleGetMetadata({ headers: jsonHeaders("sid_author"), params: { submission_id: "s1" } });
  assert.equal(missing.status, 404);

  const withActive = makeController({
    stored: {
      file_id: "m1",
      filename: "paper.pdf",
      format: "pdf",
      size_bytes: 42,
      uploaded_at: "2026-02-24T00:00:00.000Z",
    },
  }).controller;
  const ok = await withActive.handleGetMetadata({ headers: jsonHeaders("sid_author"), params: { submission_id: "s1" } });
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.body).manuscript.id, "m1");

  const forbidden = makeController({
    sessions: { sid_random: { user_id: "u2", role: "reviewer" } },
    stored: {
      file_id: "m1",
      filename: "paper.pdf",
      format: "pdf",
      size_bytes: 42,
      uploaded_at: "2026-02-24T00:00:00.000Z",
    },
  }).controller;
  const denied = await forbidden.handleGetMetadata({ headers: jsonHeaders("sid_random"), params: { submission_id: "s1" } });
  assert.equal(denied.status, 403);
});

test("uc-05 manuscript_controller covers missing req/params/body and cookie parsing fallback branches", async () => {
  const unauthNoReqController = createManuscriptController({
    submissionRepository: {
      async findById() {
        return null;
      },
      async upsert(next) {
        return next;
      },
    },
    manuscriptStorage: {
      async getActiveBySubmissionId() {
        return null;
      },
      async save() {
        return null;
      },
    },
    sessionService: {
      validate() {
        return null;
      },
    },
  });
  const unauthNoReq = await unauthNoReqController.handleGetUploadForm();
  assert.equal(unauthNoReq.status, 302);

  const fallbackController = createManuscriptController({
    submissionRepository: {
      async findById(id) {
        if (id === "") {
          return { submission_id: "", author_id: "author-1" };
        }
        return null;
      },
      async upsert(next) {
        return next;
      },
    },
    manuscriptStorage: {
      async getActiveBySubmissionId() {
        return null;
      },
      async save() {
        throw new Error("no_code_error");
      },
    },
    sessionService: {
      validate(sessionId) {
        return sessionId === "" ? { user_id: "author-1", role: "author" } : null;
      },
    },
  });

  // Covers parseCookies idx<0 path and readSession with empty cms_session.
  const withCookieWithoutEquals = await fallbackController.handleGetUploadForm({
    headers: { cookie: "cms_session" },
  });
  assert.equal(withCookieWithoutEquals.status, 200);

  // Covers req missing -> wantsJson default handling.
  const noReqForm = await fallbackController.handleGetUploadForm();
  assert.equal(noReqForm.status, 200);

  // Covers payload default `{}` and `upload = null` validation path.
  const noBodyUpload = await fallbackController.handleUpload({
    headers: { cookie: "cms_session", accept: "application/json" },
  });
  assert.equal(noBodyUpload.status, 400);
  assert.equal(JSON.parse(noBodyUpload.body).code, "missing_file");

  // Covers catch fallback on missing error.code (line 200 false branch).
  const fromManuscriptField = await fallbackController.handleUpload({
    headers: { cookie: "cms_session", accept: "application/json" },
    body: {
      manuscript: {
        filename: "paper.pdf",
        sizeBytes: 8,
        contentBuffer: Buffer.from("content"),
      },
    },
  });
  assert.equal(fromManuscriptField.status, 500);
  assert.equal(JSON.parse(fromManuscriptField.body).code, "upload_failed");

  const metadataNoReq = await fallbackController.handleGetMetadata();
  assert.equal(metadataNoReq.status, 404);
});
