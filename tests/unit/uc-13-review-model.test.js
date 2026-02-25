const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createReviewModel,
  REVIEW_MESSAGES,
  MIN_COMMENT_LENGTH,
} = require("../../src/models/review_model");

test("UC-13 review model validates required comment and length", () => {
  const fixedNow = new Date("2026-02-24T10:00:00.000Z");
  const store = { reviews: [] };
  const model = createReviewModel({ store, now: () => fixedNow });

  const missing = model.create({ reviewerId: "R1", paperId: "P1" });
  assert.equal(missing.type, "validation_error");
  assert.equal(missing.fieldErrors.comment, REVIEW_MESSAGES.COMMENT_REQUIRED);
  assert.equal(store.reviews.length, 0);

  const tooShort = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "short" },
  });
  assert.equal(tooShort.type, "validation_error");
  assert.equal(tooShort.fieldErrors.comment, REVIEW_MESSAGES.COMMENT_TOO_SHORT);
  assert.equal(store.reviews.length, 0);

  const valid = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "x".repeat(MIN_COMMENT_LENGTH) },
    optionalFields: { notes: "Optional note" },
  });
  assert.equal(valid.type, "success");
  assert.equal(valid.review.status, "Submitted");
  assert.equal(valid.review.submitted_at, fixedNow.toISOString());
  assert.equal(valid.review.optional_fields.notes, "Optional note");
  assert.equal(store.reviews.length, 1);
});

test("UC-13 review model blocks duplicates and reports immutable state", () => {
  const store = { reviews: [] };
  const model = createReviewModel({ store, now: () => new Date("2026-02-24T11:00:00.000Z") });

  const first = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "A valid review comment." },
  });
  assert.equal(first.type, "success");

  const duplicate = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "Another valid review comment." },
  });
  assert.equal(duplicate.type, "duplicate");
  assert.equal(duplicate.message, REVIEW_MESSAGES.DUPLICATE);
  assert.equal(model.isImmutable({ reviewerId: "R1", paperId: "P1" }), true);
  assert.equal(model.findDuplicate({ reviewerId: "R1", paperId: "P1" }) !== null, true);
  assert.equal(store.reviews.length, 1);
});

test("UC-13 review model supports listing and lookup by paper/reviewer", () => {
  const store = { reviews: [] };
  const model = createReviewModel({ store, now: () => new Date("2026-02-24T12:00:00.000Z") });

  model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "Valid comment for P1." },
  });
  model.create({
    reviewerId: "R2",
    paperId: "P2",
    requiredFields: { comment: "Valid comment for P2." },
  });

  const byPaper = model.listByPaperId("P1");
  assert.equal(byPaper.length, 1);
  assert.equal(byPaper[0].paper_id, "P1");

  const byReviewer = model.findByReviewerAndPaper({ reviewerId: "R2", paperId: "P2" });
  assert.equal(byReviewer.reviewer_id, "R2");
});

test("UC-13 review model handles simulated failure and optional field normalization", () => {
  const store = { reviews: [] };
  const model = createReviewModel({ store, now: () => new Date("2026-02-24T13:00:00.000Z") });

  const failure = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "A valid review comment." },
    simulateFailure: true,
  });
  assert.equal(failure.type, "failure");
  assert.equal(failure.message, REVIEW_MESSAGES.SAVE_FAILURE);
  assert.equal(store.reviews.length, 0);

  const nonObject = model.create({
    reviewerId: "R2",
    paperId: "P2",
    requiredFields: { comment: "A valid review comment." },
    optionalFields: "not-an-object",
  });
  assert.equal(nonObject.type, "success");
  assert.equal(Object.keys(nonObject.review.optional_fields).length, 0);

  const success = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "A valid review comment." },
    optionalFields: { notes: "   " },
  });
  assert.equal(success.type, "success");
  assert.equal(Object.keys(success.review.optional_fields).length, 0);
});

test("UC-13 review model initializes backing store when none provided", () => {
  const model = createReviewModel({ now: () => new Date("2026-02-24T14:00:00.000Z") });

  const result = model.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "A valid review comment." },
  });

  assert.equal(result.type, "success");
  assert.equal(model.listByPaperId("P1").length, 1);
});

test("UC-13 review model validates when requiredFields provided", () => {
  const model = createReviewModel({ now: () => new Date("2026-02-24T15:00:00.000Z") });
  const result = model.create({
    reviewerId: "R2",
    paperId: "P2",
    requiredFields: { comment: "A valid review comment." },
  });

  assert.equal(result.type, "success");
});
