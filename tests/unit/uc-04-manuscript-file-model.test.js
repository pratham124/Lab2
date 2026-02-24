const test = require("node:test");
const assert = require("node:assert/strict");

const { createManuscriptFile } = require("../../src/models/manuscript_file");

test("manuscript_file model applies defaults", () => {
  const created = createManuscriptFile();

  assert.equal(typeof created.file_id, "string");
  assert.equal(created.file_id.startsWith("file_"), true);
  assert.equal(created.submission_id, "");
  assert.equal(created.filename, "");
  assert.equal(created.format, "");
  assert.equal(created.size_bytes, 0);
  assert.equal(created.content_hash, "");
});

test("manuscript_file model preserves provided values", () => {
  const created = createManuscriptFile({
    file_id: "file_1",
    submission_id: "sub_1",
    filename: "paper.pdf",
    format: "pdf",
    size_bytes: "123",
    content_hash: "hash_1",
  });

  assert.equal(created.file_id, "file_1");
  assert.equal(created.submission_id, "sub_1");
  assert.equal(created.filename, "paper.pdf");
  assert.equal(created.format, "pdf");
  assert.equal(created.size_bytes, 123);
  assert.equal(created.content_hash, "hash_1");
});
