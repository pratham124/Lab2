const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { createAppServer } = require("../../src/server");
const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { createManuscriptStorage } = require("../../src/services/manuscript_storage");

const SUBMISSION_ID = "uc05_submission_1";
const AUTHOR_ID = "uc05_author_1";

function requestRaw(baseUrl, options, body) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: options.path,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function authHeaders(sessionId) {
  return {
    Cookie: `cms_session=${sessionId}`,
  };
}

function jsonHeaders(sessionId, payload) {
  return {
    ...authHeaders(sessionId),
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
}

function makeHarness({ storageOverride } = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc05-http-"));
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
    storageOverride || createManuscriptStorage({ storageRoot: path.join(tempDir, "private") });

  const sessionService = {
    create(userId) {
      return {
        session_id: `sid_${userId}`,
        user_id: userId,
      };
    },
    validate(sessionId) {
      if (sessionId === "sid_author") {
        return { user_id: AUTHOR_ID, role: "author" };
      }
      if (sessionId === "sid_program_chair") {
        return { user_id: "pc_1", role: "Program Chair" };
      }
      return null;
    },
    destroy() {},
  };

  const { server } = createAppServer({
    submissionRepository,
    manuscriptStorage,
    sessionService,
  });

  return {
    store,
    manuscriptStorage,
    tempDir,
    server,
  };
}

async function withServer(harness, handler) {
  await new Promise((resolve) => harness.server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${harness.server.address().port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise((resolve) => harness.server.close(resolve));
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  }
}

test("UC-05 integration happy path: upload form, upload valid PDF, and read metadata", async () => {
  const harness = makeHarness();

  await withServer(harness, async (baseUrl) => {
    const form = await requestRaw(baseUrl, {
      path: `/submissions/${SUBMISSION_ID}/manuscript/upload`,
      headers: authHeaders("sid_author"),
    });
    assert.equal(form.status, 200);
    assert.equal(form.body.includes("Upload manuscript"), true);

    const payload = JSON.stringify({
      idempotency_token: "uc05_happy_1",
      file: {
        filename: "manuscript.pdf",
        sizeBytes: 2048,
        content: "pdf-content",
      },
    });
    const uploaded = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${SUBMISSION_ID}/manuscript`,
        method: "POST",
        headers: jsonHeaders("sid_author", payload),
      },
      payload
    );

    assert.equal(uploaded.status, 200);
    const uploadBody = JSON.parse(uploaded.body);
    assert.equal(uploadBody.submissionId, SUBMISSION_ID);
    assert.equal(uploadBody.manuscript.filename, "manuscript.pdf");
    assert.equal(uploadBody.isActive, true);

    const metadata = await requestRaw(baseUrl, {
      path: `/submissions/${SUBMISSION_ID}/manuscript`,
      headers: {
        ...authHeaders("sid_author"),
        Accept: "application/json",
      },
    });
    assert.equal(metadata.status, 200);
    const metadataBody = JSON.parse(metadata.body);
    assert.equal(metadataBody.manuscript.filename, "manuscript.pdf");

    const stored = harness.store.submissions[0];
    assert.equal(stored.manuscript.filename, "manuscript.pdf");
    assert.equal(stored.activeManuscriptId, stored.manuscript.file_id);
  });
});

test("UC-05 integration invalid input path: unsupported format and oversized file are rejected", async () => {
  const harness = makeHarness();

  await withServer(harness, async (baseUrl) => {
    const invalidFormatPayload = JSON.stringify({
      idempotency_token: "uc05_invalid_format",
      file: {
        filename: "manuscript.exe",
        sizeBytes: 1024,
        content: "binary",
      },
    });

    const invalidFormat = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${SUBMISSION_ID}/manuscript`,
        method: "POST",
        headers: jsonHeaders("sid_author", invalidFormatPayload),
      },
      invalidFormatPayload
    );

    assert.equal(invalidFormat.status, 400);
    const invalidBody = JSON.parse(invalidFormat.body);
    assert.equal(invalidBody.code, "invalid_format");
    assert.equal(invalidBody.message.includes("Accepted formats"), true);

    const oversizedPayload = JSON.stringify({
      idempotency_token: "uc05_invalid_size",
      file: {
        filename: "large.pdf",
        sizeBytes: 7 * 1024 * 1024 + 1,
        content: "x",
      },
    });

    const oversized = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${SUBMISSION_ID}/manuscript`,
        method: "POST",
        headers: jsonHeaders("sid_author", oversizedPayload),
      },
      oversizedPayload
    );

    assert.equal(oversized.status, 400);
    const oversizedBody = JSON.parse(oversized.body);
    assert.equal(oversizedBody.code, "file_too_large");
    assert.equal(oversizedBody.message.includes("7 MB"), true);

    const metadata = await requestRaw(baseUrl, {
      path: `/submissions/${SUBMISSION_ID}/manuscript`,
      headers: {
        ...authHeaders("sid_author"),
        Accept: "application/json",
      },
    });
    assert.equal(metadata.status, 404);
  });
});

test("UC-05 integration expected failure path: simulated storage failure returns safe error and retry succeeds", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc05-http-failure-"));
  const baseStorage = createManuscriptStorage({ storageRoot: path.join(tempDir, "private") });
  let failMode = true;

  const failingStorage = {
    ...baseStorage,
    async save(input) {
      if (failMode) {
        const error = new Error("upload_failed");
        error.code = "upload_failed";
        throw error;
      }
      return baseStorage.save(input);
    },
  };

  const harness = makeHarness({ storageOverride: failingStorage });

  await withServer(harness, async (baseUrl) => {
    const failedPayload = JSON.stringify({
      idempotency_token: "uc05_fail_once",
      file: {
        filename: "manuscript.pdf",
        sizeBytes: 1024,
        content: "content",
      },
    });

    const failed = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${SUBMISSION_ID}/manuscript`,
        method: "POST",
        headers: jsonHeaders("sid_author", failedPayload),
      },
      failedPayload
    );

    assert.equal(failed.status, 500);
    const failedBody = JSON.parse(failed.body);
    assert.equal(failedBody.code, "upload_failed");
    assert.equal(failedBody.message.includes("No partial file was saved"), true);

    const metadataAfterFailure = await requestRaw(baseUrl, {
      path: `/submissions/${SUBMISSION_ID}/manuscript`,
      headers: {
        ...authHeaders("sid_author"),
        Accept: "application/json",
      },
    });
    assert.equal(metadataAfterFailure.status, 404);

    failMode = false;

    const retryPayload = JSON.stringify({
      idempotency_token: "uc05_retry_after_failure",
      file: {
        filename: "manuscript.pdf",
        sizeBytes: 1024,
        content: "content",
      },
    });

    const retry = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${SUBMISSION_ID}/manuscript`,
        method: "POST",
        headers: jsonHeaders("sid_author", retryPayload),
      },
      retryPayload
    );

    assert.equal(retry.status, 200);
    const retryBody = JSON.parse(retry.body);
    assert.equal(retryBody.manuscript.filename, "manuscript.pdf");
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("UC-05 integration expected failure path: unauthenticated access is blocked", async () => {
  const harness = makeHarness();

  await withServer(harness, async (baseUrl) => {
    const uploadForm = await requestRaw(baseUrl, {
      path: `/submissions/${SUBMISSION_ID}/manuscript/upload`,
      headers: { Accept: "text/html" },
    });
    assert.equal(uploadForm.status, 302);
    assert.equal(uploadForm.headers.location, "/login.html");

    const payload = JSON.stringify({
      idempotency_token: "uc05_no_auth",
      file: {
        filename: "manuscript.pdf",
        sizeBytes: 256,
        content: "content",
      },
    });

    const upload = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${SUBMISSION_ID}/manuscript`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(upload.status, 401);
    const response = JSON.parse(upload.body);
    assert.equal(response.code, "session_expired");
  });
});
