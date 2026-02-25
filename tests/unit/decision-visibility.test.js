const test = require("node:test");
const assert = require("node:assert/strict");

const { canViewDecision } = require("../../src/lib/decision-visibility");

test("decision visibility comparison branch: published decision + matching author returns true", () => {
  const result = canViewDecision({
    decision: { published_at: "2026-02-01T00:00:00.000Z" },
    requestingAuthorId: "author_1",
    submittingAuthorId: "author_1",
  });

  assert.equal(result, true);
});

test("decision visibility comparison branch: published decision + different author returns false", () => {
  const result = canViewDecision({
    decision: { published_at: "2026-02-01T00:00:00.000Z" },
    requestingAuthorId: "author_2",
    submittingAuthorId: "author_1",
  });

  assert.equal(result, false);
});

test("decision visibility early return: missing decision returns false", () => {
  assert.equal(
    canViewDecision({
      decision: null,
      requestingAuthorId: "author_1",
      submittingAuthorId: "author_1",
    }),
    false
  );
});

test("decision visibility early return: unpublished decision returns false", () => {
  assert.equal(
    canViewDecision({
      decision: { published_at: "" },
      requestingAuthorId: "author_1",
      submittingAuthorId: "author_1",
    }),
    false
  );
});

test("decision visibility fallback branch: missing author ids normalize to empty strings", () => {
  const result = canViewDecision({
    decision: { published_at: "2026-02-01T00:00:00.000Z" },
  });

  assert.equal(result, true);
});
