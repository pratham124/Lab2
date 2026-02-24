const test = require("node:test");
const assert = require("node:assert/strict");

const { createSubmissionService, __test } = require("../../src/services/submission_service");

function makeService({ duplicate = null, createThrows = null } = {}) {
  const created = [];
  const repository = {
    async findDuplicate() {
      return duplicate;
    },
    async create(submission) {
      if (createThrows) {
        throw createThrows;
      }
      created.push(submission);
      return submission;
    },
    async findById(submissionId) {
      return created.find((item) => item.submission_id === submissionId) || null;
    },
  };

  const storage = {
    async hash(buffer) {
      return `hash_${buffer.length}`;
    },
    async save({ submission_id, filename, format, contentBuffer }) {
      return {
        submission_id,
        filename,
        format,
        size_bytes: contentBuffer.length,
        content_hash: `hash_${contentBuffer.length}`,
      };
    },
  };

  const logs = [];
  const service = createSubmissionService({
    submissionRepository: repository,
    manuscriptStorage: storage,
    failureLogger: {
      log(entry) {
        logs.push(entry);
      },
    },
  });

  return { service, created, logs };
}

function validPayload({ filename = "paper.pdf", sizeBytes = 100, contentBuffer } = {}) {
  return {
    author_id: "author-1",
    title: "Test Paper",
    abstract: "Abstract",
    keywords: "k1, k2",
    affiliation: "University",
    contact_email: "author@example.com",
    manuscript: {
      filename,
      sizeBytes,
      contentBuffer: contentBuffer || Buffer.alloc(sizeBytes, "a"),
    },
  };
}

test("submission_service validateMetadata covers required and invalid email branches", () => {
  const { service } = makeService();

  const missing = service.validateMetadata({});
  assert.equal(missing.title, "Title is required.");
  assert.equal(missing.abstract, "Abstract is required.");
  assert.equal(missing.keywords, "Keywords are required.");
  assert.equal(missing.affiliation, "Affiliation is required.");
  assert.equal(missing.contact_email, "Contact email is required.");

  const invalidEmail = service.validateMetadata({
    title: "x",
    abstract: "x",
    keywords: "x",
    affiliation: "x",
    contact_email: "not-an-email",
  });
  assert.equal(invalidEmail.contact_email, "Contact email must be valid.");
});

test("submission_service validateManuscript covers missing/invalid/size/zip branches", () => {
  const { service } = makeService();

  const missing = service.validateManuscript({});
  assert.equal(missing.errors.manuscript, "Manuscript is required.");
  assert.equal(missing.manuscript, null);

  const invalidType = service.validateManuscript(validPayload({ filename: "paper.txt" }));
  assert.equal(invalidType.errors.manuscript, "Manuscript must be PDF, DOCX, or LaTeX ZIP.");

  const empty = service.validateManuscript(validPayload({ sizeBytes: 0, contentBuffer: Buffer.alloc(0) }));
  assert.equal(empty.errors.manuscript, "Manuscript file is empty or unreadable.");

  const tooLarge = service.validateManuscript(
    validPayload({ sizeBytes: 7 * 1024 * 1024 + 1, contentBuffer: Buffer.alloc(1) })
  );
  assert.equal(tooLarge.errors.manuscript, "Manuscript exceeds the 7 MB limit.");

  const invalidZip = service.validateManuscript(
    validPayload({ filename: "paper.zip", sizeBytes: 10, contentBuffer: Buffer.from("notzip") })
  );
  assert.equal(invalidZip.errors.manuscript, "LaTeX submission must be a valid ZIP archive.");

  const validZip = service.validateManuscript(
    validPayload({ filename: "paper.zip", sizeBytes: 4, contentBuffer: Buffer.from("504b0304", "hex") })
  );
  assert.deepEqual(validZip.errors, {});
});

test("submission_service submit returns validation_error branch", async () => {
  const { service, created } = makeService();
  const result = await service.submit(validPayload({ filename: "" }));

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
  assert.equal(typeof result.fieldErrors.manuscript, "string");
  assert.equal(created.length, 0);
});

test("submission_service submit returns duplicate branch", async () => {
  const { service, created } = makeService({ duplicate: { submission_id: "existing" } });
  const result = await service.submit(validPayload());

  assert.equal(result.type, "duplicate");
  assert.equal(result.status, 409);
  assert.equal(created.length, 0);
});

test("submission_service submit returns success and persists manuscript", async () => {
  const { service, created } = makeService();
  const result = await service.submit(validPayload());

  assert.equal(result.type, "success");
  assert.equal(result.status, 201);
  assert.equal(created.length, 1);
  assert.equal(result.submission.manuscript.filename, "paper.pdf");
  assert.equal(result.submission.contact_email, "author@example.com");
  assert.equal(result.submission.keywords, "k1, k2");

  const fetched = await service.getSubmission(result.submission.submission_id);
  assert.equal(fetched.submission_id, result.submission.submission_id);
});

test("submission_service submit catches save errors and logs failure", async () => {
  const { service, logs } = makeService({ createThrows: new Error("DB_DOWN") });
  const result = await service.submit(validPayload());

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
  assert.equal(result.message, "save_failure");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].reason, "submission_save_failure");
  assert.equal(logs[0].error_code, "DB_DOWN");
});

test("submission_service helper branches extensionOf/isLikelyInvalidLatexZip", () => {
  assert.equal(__test.extensionOf("Paper.DOCX"), "docx");
  assert.equal(__test.extensionOf("noext"), "");
  assert.equal(__test.extensionOf(undefined), "");

  assert.equal(__test.toKeywords(" one, two ,, "), "one, two");
  assert.equal(__test.toKeywords(undefined), "");

  assert.equal(__test.trimText("  hello  "), "hello");
  assert.equal(__test.trimText(undefined), "");

  assert.equal(__test.isLikelyInvalidLatexZip("paper.pdf", Buffer.from("x")), false);
  assert.equal(__test.isLikelyInvalidLatexZip("paper.zip", Buffer.from("x")), true);
  assert.equal(__test.isLikelyInvalidLatexZip("paper.zip", Buffer.from("504b0304", "hex")), false);
});

test("submission_service normalizeManuscript covers base64, text fallback, and base64 decode failure", () => {
  const { service } = makeService();

  const fromBase64 = service.validateManuscript({
    manuscript_filename: "paper.pdf",
    manuscript_content_base64: Buffer.from("abc", "utf8").toString("base64"),
  });
  assert.deepEqual(fromBase64.errors, {});
  assert.equal(fromBase64.manuscript.size_bytes, 3);

  const fromText = service.validateManuscript({
    manuscript_filename: "paper.pdf",
    manuscript_content: "plain-text-content",
  });
  assert.deepEqual(fromText.errors, {});
  assert.equal(fromText.manuscript.size_bytes, "plain-text-content".length);

  const originalFrom = Buffer.from;
  Buffer.from = function patchedFrom(value, encoding) {
    if (value === "boom" && encoding === "base64") {
      throw new Error("forced base64 failure");
    }
    return originalFrom(value, encoding);
  };

  try {
    const failedBase64 = service.validateManuscript({
      manuscript_filename: "paper.pdf",
      manuscript_content_base64: "boom",
    });
    assert.equal(failedBase64.errors.manuscript, "Manuscript file is empty or unreadable.");
  } finally {
    Buffer.from = originalFrom;
  }

  const missingContentOnObject = service.validateManuscript({
    manuscript: {
      filename: "paper.pdf",
      sizeBytes: 1,
    },
  });
  assert.equal(missingContentOnObject.manuscript.contentBuffer.length, 0);
});

test("submission_service submit covers custom window provider and normalization branches", async () => {
  const created = [];
  const service = createSubmissionService({
    submissionRepository: {
      async findDuplicate() {
        return null;
      },
      async create(submission) {
        created.push(submission);
        return submission;
      },
      async findById() {
        return null;
      },
    },
    manuscriptStorage: {
      async hash(buffer) {
        return `hash_${buffer.length}`;
      },
      async save({ submission_id, filename, format, contentBuffer }) {
        return {
          submission_id,
          filename,
          format,
          size_bytes: contentBuffer.length,
          content_hash: `hash_${contentBuffer.length}`,
        };
      },
    },
    submissionWindowProvider: {
      current() {
        return { submission_window_id: "custom_window" };
      },
    },
  });

  const result = await service.submit({
    title: "  Trimmed Title  ",
    abstract: "  Trimmed Abstract  ",
    keywords: " one, two ",
    affiliation: "  Dept  ",
    contact_email: "  PERSON@EXAMPLE.COM  ",
    manuscript: {
      filename: "paper.pdf",
      sizeBytes: 3,
      content: "abc",
    },
  });

  assert.equal(result.type, "success");
  assert.equal(created.length, 1);
  assert.equal(created[0].author_id, "");
  assert.equal(created[0].title, "Trimmed Title");
  assert.equal(created[0].abstract, "Trimmed Abstract");
  assert.equal(created[0].keywords, "one, two");
  assert.equal(created[0].affiliation, "Dept");
  assert.equal(created[0].contact_email, "person@example.com");
  assert.equal(created[0].submission_window_id, "custom_window");
});

test("submission_service save failure logs UNKNOWN_ERROR when error has no message", async () => {
  const logs = [];
  const service = createSubmissionService({
    submissionRepository: {
      async findDuplicate() {
        return null;
      },
      async create() {
        throw {};
      },
      async findById() {
        return null;
      },
    },
    manuscriptStorage: {
      async hash(buffer) {
        return `hash_${buffer.length}`;
      },
      async save({ submission_id, filename, format, contentBuffer }) {
        return {
          submission_id,
          filename,
          format,
          size_bytes: contentBuffer.length,
          content_hash: `hash_${contentBuffer.length}`,
        };
      },
    },
    failureLogger: {
      log(entry) {
        logs.push(entry);
      },
    },
  });

  const result = await service.submit(validPayload());
  assert.equal(result.type, "system_error");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].error_code, "UNKNOWN_ERROR");
});
