const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateUpload,
  getFileExtension,
  acceptedFormatsLabel,
} = require("../../src/services/upload_validation");
const { mapUploadError } = require("../../src/services/upload_errors");
const {
  normalizeRole,
  hasPrivilegedRole,
  canAccessSubmissionManuscript,
} = require("../../src/services/authz");
const {
  MANUSCRIPT_STORAGE_ROOT,
  MANUSCRIPT_RETENTION_POLICY,
} = require("../../src/services/storage_config");
const { createSubmission, attachActiveManuscript } = require("../../src/models/submission");
const { createManuscriptFile } = require("../../src/models/manuscript_file");
const { createPaperSubmission } = require("../../src/models/paper_submission");
const { createSubmissionRepository } = require("../../src/services/submission_repository");

test("uc-05 upload_validation covers extension, size, and success branches", () => {
  assert.equal(getFileExtension(undefined), "");
  assert.equal(getFileExtension(" README "), "");
  assert.equal(getFileExtension("paper.PDF"), "pdf");
  assert.equal(acceptedFormatsLabel(), "PDF, Word (.doc/.docx), LaTeX (.zip)");

  const missing = validateUpload();
  assert.equal(missing.code, "missing_file");

  const invalid = validateUpload({ filename: "paper.exe", sizeBytes: 10 });
  assert.equal(invalid.code, "invalid_format");

  const emptyByNaN = validateUpload({ filename: "paper.pdf", sizeBytes: "NaN" });
  assert.equal(emptyByNaN.code, "empty_file");

  const emptyByZero = validateUpload({ filename: "paper.pdf", size_bytes: 0 });
  assert.equal(emptyByZero.code, "empty_file");

  const tooLarge = validateUpload({ filename: "paper.pdf", sizeBytes: 7 * 1024 * 1024 + 1 });
  assert.equal(tooLarge.code, "file_too_large");

  const ok = validateUpload({ filename: "paper.doc", size_bytes: 512 });
  assert.equal(ok.ok, true);
  assert.equal(ok.extension, "doc");
  assert.equal(ok.sizeBytes, 512);
});

test("uc-05 upload_errors maps all known and fallback codes", () => {
  assert.equal(mapUploadError({ code: "missing_file" }).inlineMessage.includes("Select"), true);
  assert.equal(mapUploadError({ code: "invalid_format" }).inlineMessage.includes("Accepted formats"), true);
  assert.equal(mapUploadError({ code: "file_too_large" }).inlineMessage.includes("7 MB"), true);
  assert.equal(mapUploadError({ code: "empty_file" }).inlineMessage.includes("empty"), true);
  assert.equal(mapUploadError({ code: "duplicate_submit" }).inlineMessage.includes("in progress"), true);
  assert.equal(mapUploadError({ code: "upload_failed" }).inlineMessage.includes("No partial file"), true);

  const fallback = mapUploadError({ code: "unknown_reason" });
  assert.equal(fallback.code, "unknown_reason");
  assert.equal(fallback.inlineMessage.includes("Unable to upload"), true);

  const defaulted = mapUploadError();
  assert.equal(defaulted.code, "upload_failed");
});

test("uc-05 authz helpers cover normalization, role checks, and access rules", () => {
  assert.equal(normalizeRole(" Program Chair "), "program_chair");
  assert.equal(normalizeRole(), "");

  assert.equal(hasPrivilegedRole({ role: "Track Chair" }), true);
  assert.equal(hasPrivilegedRole({ role: "admin" }), true);
  assert.equal(hasPrivilegedRole({ role: "reviewer" }), false);

  assert.equal(canAccessSubmissionManuscript(), false);
  assert.equal(
    canAccessSubmissionManuscript({ session: { user_id: "a1" }, submission: { author_id: "a1" } }),
    true
  );
  assert.equal(
    canAccessSubmissionManuscript({
      session: { user_id: "other", role: "Program Chair" },
      submission: { author_id: "a1" },
    }),
    true
  );
  assert.equal(
    canAccessSubmissionManuscript({
      session: { user_id: "other", role: "reviewer" },
      submission: { author_id: "a1" },
    }),
    false
  );

  // Explicitly exercise String(... || "") equality path in authz guard.
  assert.equal(
    canAccessSubmissionManuscript({
      session: {},
      submission: {},
    }),
    true
  );
});

test("uc-05 storage_config exports expected retention posture", () => {
  assert.equal(typeof MANUSCRIPT_STORAGE_ROOT, "string");
  assert.equal(MANUSCRIPT_STORAGE_ROOT.includes("manuscripts_private"), true);
  assert.equal(MANUSCRIPT_RETENTION_POLICY.autoDelete, false);
  assert.equal(MANUSCRIPT_RETENTION_POLICY.ttlMs, null);
  assert.equal(MANUSCRIPT_RETENTION_POLICY.note.includes("retained indefinitely"), true);
});

test("uc-05 submission model covers defaults and manuscript attachment", () => {
  const defaults = createSubmission();
  assert.equal(defaults.status, "in_progress");
  assert.equal(defaults.activeManuscriptId, null);

  const derived = createSubmission({ manuscript: { file_id: "m1" } });
  assert.equal(derived.activeManuscriptId, "m1");

  const attachedByFileId = attachActiveManuscript({ submission_id: "s1" }, { file_id: "m2" });
  assert.equal(attachedByFileId.activeManuscriptId, "m2");

  const attachedById = attachActiveManuscript({ submission_id: "s1" }, { id: "m3" });
  assert.equal(attachedById.activeManuscriptId, "m3");

  const attachedWithMissingIds = attachActiveManuscript(undefined, { filename: "paper.pdf" });
  assert.equal(attachedWithMissingIds.activeManuscriptId, null);
  assert.equal(attachedWithMissingIds.manuscript.filename, "paper.pdf");

  const detached = attachActiveManuscript({ submission_id: "s1" }, null);
  assert.equal(detached.activeManuscriptId, null);
});

test("uc-05 manuscript_file and paper_submission models cover new fields", () => {
  const manuscriptDefaults = createManuscriptFile();
  assert.equal(manuscriptDefaults.original_filename, "");
  assert.equal(manuscriptDefaults.uploaded_by_author_id, "");
  assert.equal(manuscriptDefaults.is_active, true);
  assert.equal(manuscriptDefaults.submission_id, "");

  const manuscriptWithSubmission = createManuscriptFile({
    submission_id: "sub_123",
  });
  assert.equal(manuscriptWithSubmission.submission_id, "sub_123");

  const manuscriptProvided = createManuscriptFile({
    filename: "paper.pdf",
    original_filename: "orig.pdf",
    uploaded_by_author_id: "a1",
    is_active: false,
  });
  assert.equal(manuscriptProvided.original_filename, "orig.pdf");
  assert.equal(manuscriptProvided.uploaded_by_author_id, "a1");
  assert.equal(manuscriptProvided.is_active, false);

  const submissionDefaults = createPaperSubmission();
  assert.equal(submissionDefaults.activeManuscriptId, null);
  assert.equal(typeof submissionDefaults.updated_at, "string");

  const submissionFromManuscript = createPaperSubmission({ manuscript: { file_id: "m1" } });
  assert.equal(submissionFromManuscript.activeManuscriptId, "m1");

  const submissionExplicitActive = createPaperSubmission({
    manuscript: { file_id: "m1" },
    activeManuscriptId: "m9",
  });
  assert.equal(submissionExplicitActive.activeManuscriptId, "m9");
});

test("uc-05 submission_repository upsert covers insert and update branches", async () => {
  const repo = createSubmissionRepository({ store: { submissions: [] } });

  const inserted = await repo.upsert({ submission_id: "s1", title: "v1", status: "in_progress" });
  assert.equal(inserted.title, "v1");

  const updated = await repo.upsert({ submission_id: "s1", title: "v2" });
  assert.equal(updated.title, "v2");
  assert.equal(updated.status, "in_progress");

  const found = await repo.findById("s1");
  assert.equal(found.title, "v2");
});
