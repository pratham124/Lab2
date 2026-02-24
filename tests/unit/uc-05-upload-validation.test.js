const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateUpload,
  getFileExtension,
  acceptedFormatsLabel,
} = require("../../src/services/upload_validation");
const { mapUploadError } = require("../../src/services/upload_errors");
const { canAccessSubmissionManuscript } = require("../../src/services/authz");

test("uc-05 upload validation enforces format and size", () => {
  const missing = validateUpload(null);
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "missing_file");

  const invalid = validateUpload({ filename: "notes.txt", sizeBytes: 50 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid_format");

  const tooLarge = validateUpload({ filename: "paper.pdf", sizeBytes: 7 * 1024 * 1024 + 1 });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.code, "file_too_large");

  const ok = validateUpload({ filename: "paper.docx", sizeBytes: 1024 });
  assert.equal(ok.ok, true);
  assert.equal(ok.extension, "docx");
  assert.equal(getFileExtension("PAPER.ZIP"), "zip");
  assert.equal(acceptedFormatsLabel().includes("LaTeX"), true);
});

test("uc-05 error mapping and authz helpers", () => {
  const mapped = mapUploadError({ code: "duplicate_submit" });
  assert.equal(mapped.code, "duplicate_submit");
  assert.equal(mapped.inlineMessage.includes("in progress"), true);

  const submission = { author_id: "author-1" };
  assert.equal(
    canAccessSubmissionManuscript({ session: { user_id: "author-1" }, submission }),
    true
  );
  assert.equal(
    canAccessSubmissionManuscript({ session: { user_id: "other", role: "Admin" }, submission }),
    true
  );
  assert.equal(
    canAccessSubmissionManuscript({ session: { user_id: "other", role: "reviewer" }, submission }),
    false
  );
});
