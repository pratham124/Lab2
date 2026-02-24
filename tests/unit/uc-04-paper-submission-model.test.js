const test = require("node:test");
const assert = require("node:assert/strict");

const { createPaperSubmission } = require("../../src/models/paper_submission");

test("paper_submission model applies defaults when fields are omitted", () => {
  const created = createPaperSubmission();

  assert.equal(typeof created.submission_id, "string");
  assert.equal(created.submission_id.startsWith("submission_"), true);
  assert.equal(created.author_id, "");
  assert.equal(created.title, "");
  assert.equal(created.abstract, "");
  assert.equal(created.keywords, "");
  assert.equal(created.affiliation, "");
  assert.equal(created.contact_email, "");
  assert.equal(created.status, "submitted");
  assert.equal(created.submission_window_id, "default_window");
  assert.equal(created.manuscript, null);
  assert.equal(typeof created.created_at, "string");
  assert.equal(Number.isNaN(Date.parse(created.created_at)), false);
});

test("paper_submission model preserves provided values", () => {
  const manuscript = { filename: "paper.pdf" };
  const created = createPaperSubmission({
    submission_id: "sub_1",
    author_id: "author_1",
    title: "Paper Title",
    abstract: "Paper Abstract",
    keywords: "k1, k2",
    affiliation: "Affiliation",
    contact_email: "author@example.com",
    status: "draft",
    submission_window_id: "window_1",
    manuscript,
    created_at: "2026-02-24T00:00:00.000Z",
  });

  assert.equal(created.submission_id, "sub_1");
  assert.equal(created.author_id, "author_1");
  assert.equal(created.title, "Paper Title");
  assert.equal(created.abstract, "Paper Abstract");
  assert.equal(created.keywords, "k1, k2");
  assert.equal(created.affiliation, "Affiliation");
  assert.equal(created.contact_email, "author@example.com");
  assert.equal(created.status, "draft");
  assert.equal(created.submission_window_id, "window_1");
  assert.equal(created.manuscript, manuscript);
  assert.equal(created.created_at, "2026-02-24T00:00:00.000Z");
});
