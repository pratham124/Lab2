const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionService } = require("../../src/services/session-service");
const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { createManuscriptStorage } = require("../../src/services/manuscript_storage");
const { createSubmissionService } = require("../../src/services/submission_service");
const { createSubmissionController } = require("../../src/controllers/submission_controller");
const { composeSafeSaveFailureMessage } = require("../../src/lib/response_helpers");

const AUTHOR_ID = "author_uc04_1";

function createHarness({ repositoryOverride, storageOverride, failureLogger } = {}) {
  const sessionService = createSessionService();
  const session = sessionService.create(AUTHOR_ID);
  const store = { submissions: [] };
  const submissionRepository = repositoryOverride || createSubmissionRepository({ store });
  const manuscriptStorage = storageOverride || createManuscriptStorage();
  const submissionService = createSubmissionService({
    submissionRepository,
    manuscriptStorage,
    failureLogger,
  });
  const submissionController = createSubmissionController({
    submissionService,
    sessionService,
  });

  return {
    sessionId: session.session_id,
    store,
    submissionService,
    submissionController,
  };
}

function htmlHeaders(sessionId) {
  return {
    accept: "text/html",
    cookie: `cms_session=${sessionId}`,
  };
}

function manuscriptFixture({ filename, bytes, contentByte = "a", contentBuffer } = {}) {
  const buffer = contentBuffer || Buffer.alloc(bytes, contentByte);
  return {
    filename,
    sizeBytes: bytes,
    contentBuffer: buffer,
  };
}

function validPayload({ manuscript, title = "Deterministic CMS Paper" } = {}) {
  return {
    title,
    abstract: "A deterministic acceptance test abstract.",
    keywords: "cms, testing",
    affiliation: "State University",
    contact_email: "author@example.com",
    manuscript,
  };
}

function extractSubmissionId(location) {
  const match = /^\/submissions\/([A-Za-z0-9_-]+)$/.exec(location || "");
  return match ? match[1] : null;
}

async function submitHtml(controller, sessionId, payload) {
  return controller.handlePost({
    headers: htmlHeaders(sessionId),
    body: payload,
  });
}

test("AT-UC04-01 Successful Paper Submission (Main Success Scenario)", async () => {
  const harness = createHarness();

  const form = await harness.submissionController.handleGetForm({
    headers: htmlHeaders(harness.sessionId),
  });
  assert.equal(form.status, 200);

  const create = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({ manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 1024 }) })
  );

  assert.equal(create.status, 302);
  const submissionId = extractSubmissionId(create.headers.Location);
  assert.equal(Boolean(submissionId), true);
  assert.equal(harness.store.submissions.length, 1);

  const confirmation = await harness.submissionController.handleGetConfirmation({
    headers: htmlHeaders(harness.sessionId),
    params: { submission_id: submissionId },
  });

  assert.equal(confirmation.status, 200);
  assert.equal(confirmation.body.includes("Submission received"), true);
  assert.equal(confirmation.body.includes("submitted"), true);
});

test("AT-UC04-02 Reject Missing Required Metadata (Extension 6a)", async () => {
  const harness = createHarness();

  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({
      manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 1200 }),
      title: "",
    })
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes("Title is required."), true);
  assert.equal(response.body.includes('data-error-for="title">Title is required.'), true);
  assert.equal(harness.store.submissions.length, 0);
  assert.equal(response.headers.Location, undefined);
});

test("AT-UC04-03 Reject Invalid Manuscript Format (Extension 4a)", async () => {
  const harness = createHarness();

  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({ manuscript: manuscriptFixture({ filename: "paper.txt", bytes: 512 }) })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.includes("Manuscript must be PDF, DOCX, or LaTeX ZIP."), true);
  assert.equal(harness.store.submissions.length, 0);
});

test("AT-UC04-04 Reject Oversized Manuscript (> 7MB) (Extension 4a)", async () => {
  const harness = createHarness();

  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({
      manuscript: manuscriptFixture({
        filename: "large_paper.pdf",
        bytes: 7 * 1024 * 1024 + 1,
      }),
    })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.includes("Manuscript exceeds the 7 MB limit."), true);
  assert.equal(harness.store.submissions.length, 0);
});

test("AT-UC04-05 Accept PDF Format (Positive Format Coverage)", async () => {
  const harness = createHarness();

  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({ manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 1024 }) })
  );

  assert.equal(response.status, 302);
  assert.equal(harness.store.submissions.length, 1);
});

test("AT-UC04-06 Accept Word Format (Positive Format Coverage)", async () => {
  const harness = createHarness();

  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({ manuscript: manuscriptFixture({ filename: "paper.docx", bytes: 2048 }) })
  );

  assert.equal(response.status, 302);
  assert.equal(harness.store.submissions.length, 1);
});

test("AT-UC04-07 Accept LaTeX Format (Positive Format Coverage)", async () => {
  const harness = createHarness();

  const latexZipContent = Buffer.from("504b030414000000", "hex");
  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({
      manuscript: manuscriptFixture({
        filename: "paper.zip",
        bytes: latexZipContent.length,
        contentBuffer: latexZipContent,
      }),
    })
  );

  assert.equal(response.status, 302);
  assert.equal(harness.store.submissions.length, 1);
});

test("AT-UC04-08 Handle System/Database Failure During Submission (Extension 7a)", async () => {
  const logs = [];
  const repository = {
    async create() {
      throw new Error("DB_WRITE_FAILED");
    },
    async findById() {
      return null;
    },
    async findDuplicate() {
      return null;
    },
  };
  const harness = createHarness({
    repositoryOverride: repository,
    failureLogger: {
      log(entry) {
        logs.push(entry);
      },
    },
  });

  const response = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({ manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 700 }) })
  );

  assert.equal(response.status, 500);
  assert.equal(response.body.includes(composeSafeSaveFailureMessage()), true);
  assert.equal(response.body.includes("DB_WRITE_FAILED"), false);
  assert.equal(logs.some((entry) => entry.outcome === "system_error"), true);
  assert.equal(logs.some((entry) => entry.reason === "submission_save_failure"), true);
});

test("AT-UC04-09 Prevent Duplicate Submissions on Double-Click", async () => {
  const harness = createHarness();
  const payload = validPayload({ manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 1300 }) });

  const first = await submitHtml(harness.submissionController, harness.sessionId, payload);
  const second = await submitHtml(harness.submissionController, harness.sessionId, payload);

  assert.equal(first.status, 302);
  assert.equal(second.status, 409);
  assert.equal(second.body.includes("A submission already exists for this paper."), true);
  assert.equal(second.body.includes("stack"), false);
  assert.equal(harness.store.submissions.length, 1);
});

test("AT-UC04-10 Block Duplicate Submission Within Submission Window (Extension 6b)", async () => {
  const harness = createHarness();

  const first = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({ manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 1000 }) })
  );
  assert.equal(first.status, 302);

  const duplicateByTitle = await submitHtml(
    harness.submissionController,
    harness.sessionId,
    validPayload({
      manuscript: manuscriptFixture({ filename: "another.docx", bytes: 1500 }),
    })
  );

  assert.equal(duplicateByTitle.status, 409);
  assert.equal(duplicateByTitle.body.includes("A submission already exists for this paper."), true);
  assert.equal(harness.store.submissions.length, 1);
});

test("AT-UC04-11 Authorization: Block Submission When Not Logged In", async () => {
  const harness = createHarness();

  const getForm = await harness.submissionController.handleGetForm({
    headers: { accept: "text/html" },
  });
  assert.equal(getForm.status, 302);
  assert.equal(getForm.headers.Location, "/login.html");

  const post = await harness.submissionController.handlePost({
    headers: { accept: "text/html" },
    body: validPayload({ manuscript: manuscriptFixture({ filename: "paper.pdf", bytes: 900 }) }),
  });
  assert.equal(post.status, 302);
  assert.equal(post.headers.Location, "/login.html");
  assert.equal(harness.store.submissions.length, 0);
});
