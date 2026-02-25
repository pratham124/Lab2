const { getSubmittedReviews, normalizeReviewStatus } = require("../models/review");

function normalizeId(value) {
  return String(value || "").trim();
}

function getReviewerIdentity({ review, dataAccess } = {}) {
  const reviewerId = normalizeId(review.reviewer_id || review.reviewerId);
  if (!reviewerId) {
    return { reviewerId: "" };
  }
  if (dataAccess && typeof dataAccess.getReviewerById === "function") {
    const reviewer = dataAccess.getReviewerById(reviewerId);
    return {
      reviewerId,
      reviewerName: reviewer ? String(reviewer.name || "").trim() : "",
    };
  }
  return { reviewerId, reviewerName: "" };
}

function toCompletedReview({ review, dataAccess } = {}) {
  const identity = getReviewerIdentity({ review, dataAccess });
  return {
    id: normalizeId(review.review_id || review.id),
    paperId: normalizeId(review.paper_id || review.paperId),
    reviewerId: identity.reviewerId,
    reviewerName: identity.reviewerName,
    status: normalizeReviewStatus(review.status),
    submittedAt: review.submitted_at || review.submittedAt || "",
    content: {
      ...(review.required_fields || review.requiredFields || {}),
      ...(review.optional_fields || review.optionalFields || {}),
    },
  };
}

function createReviewService({ reviewModel, dataAccess } = {}) {
  if (!reviewModel || typeof reviewModel.listByPaperId !== "function") {
    throw new Error("reviewModel.listByPaperId is required");
  }

  function listCompletedReviews({ paperId } = {}) {
    const normalizedPaperId = normalizeId(paperId);
    if (!normalizedPaperId) {
      return { type: "validation_error", message: "paperId is required" };
    }

    try {
      const reviews = reviewModel.listByPaperId(normalizedPaperId);
      const completed = getSubmittedReviews(reviews);
      return {
        type: "success",
        items: completed.map((review) => toCompletedReview({ review, dataAccess })),
      };
    } catch (error) {
      return {
        type: "failure",
        message: "Review retrieval failed.",
        error,
      };
    }
  }

  return {
    listCompletedReviews,
  };
}

module.exports = {
  createReviewService,
  toCompletedReview,
};
