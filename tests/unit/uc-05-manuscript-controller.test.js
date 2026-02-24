const test = require("node:test");
const assert = require("node:assert/strict");

const { createManuscriptController } = require("../../src/controllers/manuscript_controller");

function makeController({ session = { user_id: "author-1" }, submission, stored } = {}) {
  const submissions = new Map();
  if (submission) {
    submissions.set(submission.submission_id, submission);
  }

  return createManuscriptController({
    submissionRepository: {
      async findById(id) {
        return submissions.get(id) || null;
      },
      async upsert(next) {
        submissions.set(next.submission_id, next);
        return next;
      },
    },
    manuscriptStorage: {
      async save({ submission_id, filename, format, contentBuffer }) {
        if (filename === "fail.pdf") {
          const error = new Error("upload_failed");
          error.code = "upload_failed";
          throw error;
        }
        return (
          stored || {
            file_id: "m_1",
            submission_id,
            filename,
            format,
            size_bytes: Buffer.from(contentBuffer || "").length,
            uploaded_at: new Date().toISOString(),
          }
        );
      },
      async getActiveBySubmissionId() {
        return stored || null;
      },
    },
    sessionService: {
      validate() {
        return session;
      },
    },
  });
}

test("uc-05 manuscript controller handles auth and metadata", async () => {
  const unauth = makeController({ session: null });
  const unauthorized = await unauth.handleGetMetadata({ headers: {}, params: { submission_id: "s1" } });
  assert.equal(unauthorized.status, 401);

  const controller = makeController({
    submission: { submission_id: "s1", author_id: "author-1" },
    stored: { file_id: "m1", filename: "paper.pdf", format: "pdf", size_bytes: 12, uploaded_at: new Date().toISOString() },
  });
  const metadata = await controller.handleGetMetadata({ headers: {}, params: { submission_id: "s1" } });
  assert.equal(metadata.status, 200);
  assert.equal(JSON.parse(metadata.body).manuscript.filename, "paper.pdf");
});

test("uc-05 manuscript controller upload validates and prevents duplicate submits", async () => {
  const controller = makeController({ submission: { submission_id: "s1", author_id: "author-1" } });

  const invalid = await controller.handleUpload({
    headers: { accept: "application/json" },
    params: { submission_id: "s1" },
    body: { idempotency_token: "t1", file: { filename: "bad.txt", sizeBytes: 12, contentBuffer: Buffer.from("x") } },
  });
  assert.equal(invalid.status, 400);

  const ok = await controller.handleUpload({
    headers: { accept: "application/json" },
    params: { submission_id: "s1" },
    body: { idempotency_token: "t2", file: { filename: "paper.pdf", sizeBytes: 12, contentBuffer: Buffer.from("abc") } },
  });
  assert.equal(ok.status, 200);

  const duplicate = await controller.handleUpload({
    headers: { accept: "application/json" },
    params: { submission_id: "s1" },
    body: { idempotency_token: "t2", file: { filename: "paper.pdf", sizeBytes: 12, contentBuffer: Buffer.from("abc") } },
  });
  assert.equal(duplicate.status, 409);
});
