const test = require("node:test");
const assert = require("node:assert/strict");

const { createSubmissionController } = require("../../src/controllers/submission_controller");

function makeController({ session, submitResult, submissionResult } = {}) {
  const service = {
    async submit() {
      return submitResult;
    },
    async getSubmission() {
      return submissionResult;
    },
  };
  const sessionService = {
    validate() {
      return session || null;
    },
  };

  return createSubmissionController({
    submissionService: service,
    sessionService,
  });
}

test("submission_controller handleGetForm covers unauthenticated html/json and authenticated", async () => {
  const unauth = makeController({ session: null });

  const html = await unauth.handleGetForm({ headers: { accept: "text/html" } });
  assert.equal(html.status, 302);
  assert.equal(html.headers.Location, "/login.html");

  const json = await unauth.handleGetForm({ headers: { accept: "application/json" } });
  assert.equal(json.status, 401);
  assert.equal(JSON.parse(json.body).errorCode, "session_expired");

  const authed = makeController({ session: { user_id: "author-1" } });
  const ok = await authed.handleGetForm({ headers: { accept: "text/html", cookie: "cms_session=s1" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.includes("Submit paper"), true);
});

test("submission_controller handlePost covers unauthenticated html/json", async () => {
  const controller = makeController({ session: null });

  const html = await controller.handlePost({ headers: { accept: "text/html" }, body: {} });
  assert.equal(html.status, 302);

  const json = await controller.handlePost({ headers: { accept: "application/json" }, body: {} });
  assert.equal(json.status, 401);
  assert.equal(JSON.parse(json.body).errorCode, "session_expired");
});

test("submission_controller handlePost covers upload_interrupted html/json", async () => {
  const controller = makeController({ session: { user_id: "author-1" } });

  const html = await controller.handlePost({
    headers: { accept: "text/html" },
    body: { __parse_error: "upload_interrupted", title: "x" },
  });
  assert.equal(html.status, 400);
  assert.equal(html.body.includes("Upload interrupted"), true);

  const json = await controller.handlePost({
    headers: { accept: "application/json" },
    body: { __parse_error: "upload_interrupted" },
  });
  assert.equal(json.status, 400);
  assert.equal(JSON.parse(json.body).errorCode, "upload_interrupted");
});

test("submission_controller handlePost covers success html/json", async () => {
  const controller = makeController({
    session: { user_id: "author-1" },
    submitResult: {
      type: "success",
      submission: { submission_id: "sub_1", status: "submitted" },
    },
  });

  const html = await controller.handlePost({ headers: { accept: "text/html" }, body: {} });
  assert.equal(html.status, 302);
  assert.equal(html.headers.Location, "/submissions/sub_1");

  const json = await controller.handlePost({ headers: { accept: "application/json" }, body: {} });
  assert.equal(json.status, 201);
  const payload = JSON.parse(json.body);
  assert.equal(payload.submission_id, "sub_1");
});

test("submission_controller handlePost covers duplicate html/json", async () => {
  const controller = makeController({
    session: { user_id: "author-1" },
    submitResult: {
      type: "duplicate",
      message: "A submission already exists for this paper.",
    },
  });

  const html = await controller.handlePost({ headers: { accept: "text/html" }, body: { title: "x" } });
  assert.equal(html.status, 409);
  assert.equal(html.body.includes("A submission already exists for this paper."), true);

  const json = await controller.handlePost({ headers: { accept: "application/json" }, body: {} });
  assert.equal(json.status, 409);
  assert.equal(JSON.parse(json.body).errorCode, "duplicate_submission");
});

test("submission_controller handlePost covers validation html/json", async () => {
  const controller = makeController({
    session: { user_id: "author-1" },
    submitResult: {
      type: "validation_error",
      message: "Please correct highlighted fields.",
      fieldErrors: { title: "Title is required." },
    },
  });

  const html = await controller.handlePost({ headers: { accept: "text/html" }, body: { title: "" } });
  assert.equal(html.status, 400);
  assert.equal(html.body.includes("Title is required."), true);

  const json = await controller.handlePost({ headers: { accept: "application/json" }, body: {} });
  assert.equal(json.status, 400);
  assert.equal(JSON.parse(json.body).fieldErrors.title, "Title is required.");
});

test("submission_controller handlePost covers system_error html/json", async () => {
  const controller = makeController({
    session: { user_id: "author-1" },
    submitResult: {
      type: "system_error",
    },
  });

  const html = await controller.handlePost({ headers: { accept: "text/html" }, body: {} });
  assert.equal(html.status, 500);
  assert.equal(html.body.includes("Please try again later or contact support."), true);

  const json = await controller.handlePost({ headers: { accept: "application/json" }, body: {} });
  assert.equal(json.status, 500);
  assert.equal(JSON.parse(json.body).errorCode, "save_failure");
});

test("submission_controller handleGetConfirmation covers unauthenticated, missing, found html/json", async () => {
  const unauth = makeController({ session: null });
  const htmlUnauth = await unauth.handleGetConfirmation({ headers: { accept: "text/html" }, params: { submission_id: "s" } });
  assert.equal(htmlUnauth.status, 302);

  const jsonUnauth = await unauth.handleGetConfirmation({ headers: { accept: "application/json" }, params: { submission_id: "s" } });
  assert.equal(jsonUnauth.status, 401);

  const missing = makeController({ session: { user_id: "author-1" }, submissionResult: null });
  const missingHtml = await missing.handleGetConfirmation({ headers: { accept: "text/html" }, params: { submission_id: "s" } });
  assert.equal(missingHtml.status, 404);
  assert.equal(missingHtml.body, "Not found");

  const missingJson = await missing.handleGetConfirmation({ headers: { accept: "application/json" }, params: { submission_id: "s" } });
  assert.equal(missingJson.status, 404);
  assert.equal(JSON.parse(missingJson.body).errorCode, "not_found");

  const foundSubmission = { submission_id: "s1", author_id: "author-1", title: "T", status: "submitted" };
  const found = makeController({ session: { user_id: "author-1" }, submissionResult: foundSubmission });

  const foundHtml = await found.handleGetConfirmation({ headers: { accept: "text/html" }, params: { submission_id: "s1" } });
  assert.equal(foundHtml.status, 200);
  assert.equal(foundHtml.body.includes("Submission received"), true);

  const foundJson = await found.handleGetConfirmation({ headers: { accept: "application/json" }, params: { submission_id: "s1" } });
  assert.equal(foundJson.status, 200);
  assert.equal(JSON.parse(foundJson.body).submission_id, "s1");

  const wrongAuthor = makeController({
    session: { user_id: "author-2" },
    submissionResult: foundSubmission,
  });
  const denied = await wrongAuthor.handleGetConfirmation({ headers: { accept: "application/json" }, params: { submission_id: "s1" } });
  assert.equal(denied.status, 404);
});

test("submission_controller covers fallback branches for missing req headers/body/params", async () => {
  let validatedSessionId = "unset";
  let capturedSubmissionId = "unset";
  const controller = createSubmissionController({
    submissionService: {
      async submit() {
        return { type: "validation_error", message: "bad", fieldErrors: {} };
      },
      async getSubmission(submissionId) {
        capturedSubmissionId = submissionId;
        return null;
      },
    },
    sessionService: {
      validate(sessionId) {
        validatedSessionId = sessionId;
        return { user_id: "author-1" };
      },
    },
  });

  const getForm = await controller.handleGetForm();
  assert.equal(getForm.status, 200);
  assert.equal(validatedSessionId, "");

  const post = await controller.handlePost();
  assert.equal(post.status, 400);

  const confirmation = await controller.handleGetConfirmation({ headers: { accept: "application/json" } });
  assert.equal(confirmation.status, 404);
  assert.equal(capturedSubmissionId, "");
});
