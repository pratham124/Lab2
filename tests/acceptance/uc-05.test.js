const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { createManuscriptStorage } = require("../../src/services/manuscript_storage");
const { createManuscriptController } = require("../../src/controllers/manuscript_controller");
const { MANUSCRIPT_RETENTION_POLICY } = require("../../src/services/storage_config");
const { MAX_MANUSCRIPT_SIZE_BYTES } = require("../../src/lib/submission_constraints");

const AUTHOR_ID = "author_uc05_1";
const SUBMISSION_ID = "submission_uc05_1";

function createHarness({ withStoredManuscript = false, storageOverride } = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc05-acceptance-"));
  const store = {
    submissions: [
      {
        submission_id: SUBMISSION_ID,
        author_id: AUTHOR_ID,
        status: "in_progress",
        manuscript: null,
        activeManuscriptId: null,
      },
    ],
  };
  const submissionRepository = createSubmissionRepository({ store });
  const manuscriptStorage =
    storageOverride || createManuscriptStorage({ storageRoot: path.join(tempDir, "private_manuscripts") });

  const sessions = new Map([
    ["sid_author", { user_id: AUTHOR_ID, role: "author" }],
    ["sid_program_chair", { user_id: "pc_1", role: "Program Chair" }],
    ["sid_track_chair", { user_id: "tc_1", role: "Track Chair" }],
    ["sid_admin", { user_id: "admin_1", role: "Admin" }],
    ["sid_random", { user_id: "random_1", role: "reviewer" }],
  ]);

  const sessionService = {
    validate(sessionId) {
      return sessions.get(String(sessionId || "")) || null;
    },
  };

  const manuscriptController = createManuscriptController({
    submissionRepository,
    manuscriptStorage,
    sessionService,
  });

  async function seedStoredManuscript() {
    if (!withStoredManuscript) {
      return null;
    }
    const response = await uploadAsJson({
      sessionId: "sid_author",
      token: "seed_token",
      file: manuscriptFixture({ filename: "seed.pdf", sizeBytes: 1024 }),
    });
    assert.equal(response.status, 200);
    return JSON.parse(response.body).manuscript;
  }

  function cleanup() {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  function submission() {
    return store.submissions.find((entry) => entry.submission_id === SUBMISSION_ID) || null;
  }

  function htmlHeaders(sessionId) {
    return {
      accept: "text/html",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
    };
  }

  function jsonHeaders(sessionId) {
    return {
      accept: "application/json",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
      "content-type": "application/json",
    };
  }

  async function getUploadForm({ sessionId }) {
    return manuscriptController.handleGetUploadForm({
      headers: htmlHeaders(sessionId),
      params: { submission_id: SUBMISSION_ID },
    });
  }

  async function getMetadata({ sessionId, asJson = true } = {}) {
    return manuscriptController.handleGetMetadata({
      headers: asJson ? jsonHeaders(sessionId) : htmlHeaders(sessionId),
      params: { submission_id: SUBMISSION_ID },
    });
  }

  async function uploadAsHtml({ sessionId, token, file }) {
    return manuscriptController.handleUpload({
      headers: htmlHeaders(sessionId),
      params: { submission_id: SUBMISSION_ID },
      body: {
        idempotency_token: token,
        file,
      },
    });
  }

  async function uploadAsJson({ sessionId, token, file }) {
    return manuscriptController.handleUpload({
      headers: jsonHeaders(sessionId),
      params: { submission_id: SUBMISSION_ID },
      body: {
        idempotency_token: token,
        file,
      },
    });
  }

  return {
    manuscriptStorage,
    manuscriptController,
    getUploadForm,
    getMetadata,
    uploadAsHtml,
    uploadAsJson,
    submission,
    seedStoredManuscript,
    cleanup,
  };
}

function manuscriptFixture({ filename, sizeBytes, fill = "a" } = {}) {
  return {
    filename,
    sizeBytes,
    contentBuffer: Buffer.alloc(sizeBytes, fill),
  };
}

test("AT-UC05-01 — Successful Upload (PDF)", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const form = await harness.getUploadForm({ sessionId: "sid_author" });
  assert.equal(form.status, 200);
  assert.equal(form.body.includes("Upload manuscript"), true);

  const upload = await harness.uploadAsHtml({
    sessionId: "sid_author",
    token: "token_pdf",
    file: manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 2048 }),
  });

  assert.equal(upload.status, 200);
  assert.equal(upload.body.includes("Uploaded manuscript.pdf successfully."), true);

  const linked = harness.submission();
  assert.equal(Boolean(linked && linked.manuscript), true);
  assert.equal(linked.manuscript.filename, "manuscript.pdf");
  assert.equal(linked.activeManuscriptId, linked.manuscript.file_id);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(MANUSCRIPT_RETENTION_POLICY.autoDelete, false);
  assert.equal(fs.existsSync(linked.manuscript.file_path), true);
});

test("AT-UC05-02 — Successful Upload (Word)", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const upload = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_docx",
    file: manuscriptFixture({ filename: "manuscript.docx", sizeBytes: 1536 }),
  });

  assert.equal(upload.status, 200);
  const payload = JSON.parse(upload.body);
  assert.equal(payload.manuscript.filename, "manuscript.docx");
  assert.equal(harness.submission().manuscript.filename, "manuscript.docx");
});

test("AT-UC05-03 — Successful Upload (LaTeX .zip)", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const upload = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_zip",
    file: manuscriptFixture({ filename: "manuscript.zip", sizeBytes: 1800 }),
  });

  assert.equal(upload.status, 200);
  const payload = JSON.parse(upload.body);
  assert.equal(payload.manuscript.filename, "manuscript.zip");
  assert.equal(harness.submission().manuscript.filename, "manuscript.zip");
});

test("AT-UC05-04 — Reject Unsupported File Format", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const rejected = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_invalid_format",
    file: manuscriptFixture({ filename: "manuscript.txt", sizeBytes: 1200 }),
  });

  assert.equal(rejected.status, 400);
  const payload = JSON.parse(rejected.body);
  assert.equal(payload.code, "invalid_format");
  assert.equal(payload.message.includes("Accepted formats"), true);
  assert.equal(payload.message.includes("PDF"), true);
  assert.equal(payload.message.includes("LaTeX"), true);
  assert.equal(harness.submission().manuscript, null);

  const metadata = await harness.getMetadata({ sessionId: "sid_author" });
  assert.equal(metadata.status, 404);
});

test("AT-UC05-05 — Reject Oversized File (> 7MB)", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const rejected = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_too_large",
    file: manuscriptFixture({
      filename: "large_manuscript.pdf",
      sizeBytes: MAX_MANUSCRIPT_SIZE_BYTES + 1,
    }),
  });

  assert.equal(rejected.status, 400);
  const payload = JSON.parse(rejected.body);
  assert.equal(payload.code, "file_too_large");
  assert.equal(payload.message.includes("7 MB"), true);
  assert.equal(harness.submission().manuscript, null);
});

test("AT-UC05-06 — Handle Network/System Failure During Upload", async (t) => {
  const baseStorage = createManuscriptStorage({
    storageRoot: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "uc05-failure-")), "private"),
  });
  let failUploads = true;
  const storage = {
    ...baseStorage,
    async save(input) {
      if (failUploads) {
        const error = new Error("upload_failed");
        error.code = "upload_failed";
        throw error;
      }
      return baseStorage.save(input);
    },
  };

  const harness = createHarness({ storageOverride: storage });
  t.after(() => harness.cleanup());

  const failed = await harness.uploadAsHtml({
    sessionId: "sid_author",
    token: "token_fail_1",
    file: manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 1000 }),
  });

  assert.equal(failed.status, 500);
  assert.equal(failed.body.includes("Upload failed. No partial file was saved. Please retry."), true);
  assert.equal(failed.body.includes("Last upload failed. Please check your connection and retry."), true);
  assert.equal(harness.submission().manuscript, null);

  const failedAgain = await harness.uploadAsHtml({
    sessionId: "sid_author",
    token: "token_fail_2",
    file: manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 1000 }),
  });
  assert.equal(failedAgain.status, 500);

  failUploads = false;
});

test("AT-UC05-07 — Retry Upload After Failure", async (t) => {
  let failOnce = true;
  const tempRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "uc05-retry-")), "private");
  const baseStorage = createManuscriptStorage({ storageRoot: tempRoot });
  const storage = {
    ...baseStorage,
    async save(input) {
      if (failOnce) {
        failOnce = false;
        const error = new Error("upload_failed");
        error.code = "upload_failed";
        throw error;
      }
      return baseStorage.save(input);
    },
  };

  const harness = createHarness({ storageOverride: storage });
  t.after(() => harness.cleanup());

  const first = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_retry_1",
    file: manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 2000 }),
  });
  assert.equal(first.status, 500);

  const retry = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_retry_2",
    file: manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 2000 }),
  });

  assert.equal(retry.status, 200);
  const payload = JSON.parse(retry.body);
  assert.equal(payload.manuscript.filename, "manuscript.pdf");
  assert.equal(harness.submission().manuscript.filename, "manuscript.pdf");
});

test("AT-UC05-08 — Replace Previously Uploaded Manuscript", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const first = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_v1",
    file: manuscriptFixture({ filename: "manuscript_v1.pdf", sizeBytes: 1100 }),
  });
  assert.equal(first.status, 200);
  const firstBody = JSON.parse(first.body);

  const firstPath = harness.submission().manuscript.file_path;
  assert.equal(fs.existsSync(firstPath), true);

  const second = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_v2",
    file: manuscriptFixture({ filename: "manuscript_v2.pdf", sizeBytes: 1300 }),
  });
  assert.equal(second.status, 200);
  const secondBody = JSON.parse(second.body);

  assert.notEqual(firstBody.manuscript.id, secondBody.manuscript.id);
  assert.equal(harness.submission().manuscript.filename, "manuscript_v2.pdf");
  assert.equal(harness.submission().activeManuscriptId, secondBody.manuscript.id);
  assert.equal(fs.existsSync(firstPath), false);

  const form = await harness.getUploadForm({ sessionId: "sid_author" });
  assert.equal(form.body.includes("Current attached file: manuscript_v2.pdf"), true);
});

test("AT-UC05-09 — Authorization: Block Upload When Not Logged In", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const page = await harness.getUploadForm({ sessionId: null });
  assert.equal(page.status, 302);
  assert.equal(page.headers.Location, "/login.html");

  const blocked = await harness.uploadAsJson({
    sessionId: null,
    token: "token_no_session",
    file: manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 900 }),
  });
  assert.equal(blocked.status, 401);
  const payload = JSON.parse(blocked.body);
  assert.equal(payload.code, "session_expired");
  assert.equal(harness.submission().manuscript, null);
});

test("AT-UC05-10 — Prevent Double-Upload on Double-Click", async (t) => {
  const harness = createHarness();
  t.after(() => harness.cleanup());

  const file = manuscriptFixture({ filename: "manuscript.pdf", sizeBytes: 1400 });
  const first = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_double_click",
    file,
  });
  const second = await harness.uploadAsJson({
    sessionId: "sid_author",
    token: "token_double_click",
    file,
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  const payload = JSON.parse(second.body);
  assert.equal(payload.code, "duplicate_submit");
  assert.equal(payload.message.includes("stack"), false);
  assert.equal(Boolean(harness.submission().manuscript), true);
});

test("AT-UC05-11 — Authorization: Access Stored Manuscript (Role-Based)", async (t) => {
  const harness = createHarness({ withStoredManuscript: true });
  t.after(() => harness.cleanup());
  await harness.seedStoredManuscript();

  const author = await harness.getMetadata({ sessionId: "sid_author" });
  assert.equal(author.status, 200);

  const pc = await harness.getMetadata({ sessionId: "sid_program_chair" });
  assert.equal(pc.status, 200);

  const tc = await harness.getMetadata({ sessionId: "sid_track_chair" });
  assert.equal(tc.status, 200);

  const admin = await harness.getMetadata({ sessionId: "sid_admin" });
  assert.equal(admin.status, 200);

  const random = await harness.getMetadata({ sessionId: "sid_random" });
  assert.equal(random.status, 403);
  assert.equal(JSON.parse(random.body).code, "forbidden");
});

test("AT-UC05-12 — Prevent Public Direct URL Access", async (t) => {
  const harness = createHarness({ withStoredManuscript: true });
  t.after(() => harness.cleanup());
  await harness.seedStoredManuscript();

  const unauthMetadata = await harness.getMetadata({ sessionId: null });
  assert.equal(unauthMetadata.status, 401);
  assert.equal(JSON.parse(unauthMetadata.body).code, "session_expired");

  assert.equal(harness.manuscriptStorage.getPublicUrl(), null);
});
