const test = require("node:test");
const assert = require("node:assert/strict");

const { createReviewModel } = require("../../src/models/review_model");
const { createReviewService, toCompletedReview } = require("../../src/controllers/review_service");

const FIXED_NOW = new Date("2026-02-24T12:00:00.000Z");

function createHarness({ dataAccess } = {}) {
  const store = { reviews: [] };
  const reviewModel = createReviewModel({ store, now: () => FIXED_NOW });
  const reviewService = createReviewService({ reviewModel, dataAccess });
  return { store, reviewModel, reviewService };
}

test("review_service validates paperId", () => {
  const { reviewService } = createHarness();
  const result = reviewService.listCompletedReviews({});
  assert.equal(result.type, "validation_error");
});

test("review_service returns completed reviews with reviewer identity", () => {
  const dataAccess = {
    getReviewerById(id) {
      if (id === "R1") {
        return { id: "R1", name: "Reviewer One" };
      }
      return null;
    },
  };
  const { reviewModel, reviewService } = createHarness({ dataAccess });

  reviewModel.create({
    reviewerId: "R1",
    paperId: "P1",
    requiredFields: { comment: "Complete review." },
    optionalFields: { notes: "Optional" },
  });
  reviewModel.create({
    reviewerId: "R2",
    paperId: "P1",
    requiredFields: { comment: "Pending review." },
    optionalFields: {},
  });
  reviewModel.create({
    reviewerId: "R3",
    paperId: "P1",
    requiredFields: { comment: "Submitted review." },
    optionalFields: {},
    simulateFailure: false,
  });
  // force a pending review to validate filter
  const reviews = reviewModel.listByPaperId("P1");
  const pending = reviews.find((review) => review.reviewer_id === "R2");
  pending.status = "pending";

  const result = reviewService.listCompletedReviews({ paperId: "P1" });
  assert.equal(result.type, "success");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].reviewerName, "Reviewer One");
  assert.equal(result.items[0].content.comment, "Complete review.");
});

test("review_service returns reviewerId even without dataAccess", () => {
  const { reviewModel, reviewService } = createHarness();

  reviewModel.create({
    reviewerId: "R9",
    paperId: "P9",
    requiredFields: { comment: "No data access." },
    optionalFields: {},
  });

  const result = reviewService.listCompletedReviews({ paperId: "P9" });
  assert.equal(result.type, "success");
  assert.equal(result.items[0].reviewerId, "R9");
  assert.equal(result.items[0].reviewerName, "");
});

test("review_service maps empty reviewer id to blank identity", () => {
  const review = toCompletedReview({
    review: {
      review_id: "r1",
      paper_id: "p1",
      status: "submitted",
      required_fields: { comment: "Complete review." },
    },
  });

  assert.equal(review.reviewerId, "");
});

test("review_service maps ids and trims reviewer name", () => {
  const review = toCompletedReview({
    review: {
      id: "review_alt",
      paperId: "paper_alt",
      reviewerId: "R1",
      status: "submitted",
      required_fields: { comment: "Complete review." },
    },
    dataAccess: {
      getReviewerById() {
        return { name: " Reviewer One " };
      },
    },
  });

  assert.equal(review.id, "review_alt");
  assert.equal(review.paperId, "paper_alt");
  assert.equal(review.reviewerName, "Reviewer One");
  assert.equal(review.content.comment, "Complete review.");
});

test("review_service handles reviewer with missing name and optional fields", () => {
  const review = toCompletedReview({
    review: {
      review_id: "r2",
      paper_id: "p2",
      reviewer_id: "R2",
      status: "submitted",
      requiredFields: { comment: "Complete review." },
      optionalFields: { notes: "Optional note." },
    },
    dataAccess: {
      getReviewerById() {
        return { name: "" };
      },
    },
  });

  assert.equal(review.reviewerName, "");
  assert.equal(review.content.comment, "Complete review.");
  assert.equal(review.content.notes, "Optional note.");
});

test("review_service handles missing content fields", () => {
  const review = toCompletedReview({
    review: {
      review_id: "r3",
      paper_id: "p3",
      reviewer_id: "R3",
      status: "submitted",
    },
  });

  assert.deepEqual(review.content, {});
});

test("review_service throws when reviewModel is missing listByPaperId", () => {
  assert.throws(() => createReviewService({ reviewModel: {} }), /listByPaperId/);
});

test("review_service handles failures from reviewModel", () => {
  const reviewService = createReviewService({
    reviewModel: {
      listByPaperId() {
        throw new Error("DB_DOWN");
      },
    },
  });

  const result = reviewService.listCompletedReviews({ paperId: "P1" });
  assert.equal(result.type, "failure");
  assert.equal(result.message, "Review retrieval failed.");
});
