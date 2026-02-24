const test = require("node:test");
const assert = require("node:assert/strict");

const { createDraftSubmission } = require("../../src/models/draft_submission");

test("draft_submission model covers default fallbacks for submission_id/author_id/saved_at/data", () => {
  const before = Date.now();
  const created = createDraftSubmission({
    submission_id: undefined,
    author_id: null,
    saved_at: "",
    data: null,
  });
  const after = Date.now();

  assert.equal(created.submission_id, "");
  assert.equal(created.author_id, "");
  assert.equal(typeof created.saved_at, "string");
  const parsed = Date.parse(created.saved_at);
  assert.equal(Number.isNaN(parsed), false);
  assert.equal(parsed >= before - 1, true);
  assert.equal(parsed <= after + 1, true);
  assert.deepEqual(created.data, {});
});

test("draft_submission model clones provided object data and trims ids", () => {
  const inputData = { title: "x" };
  const created = createDraftSubmission({
    draft_id: "  draft_1  ",
    submission_id: "  sub_1  ",
    author_id: "  author_1  ",
    saved_at: "2026-01-01T00:00:00.000Z",
    data: inputData,
  });

  assert.equal(created.draft_id, "draft_1");
  assert.equal(created.submission_id, "sub_1");
  assert.equal(created.author_id, "author_1");
  assert.equal(created.saved_at, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(created.data, { title: "x" });

  inputData.title = "changed";
  assert.equal(created.data.title, "x");
});
