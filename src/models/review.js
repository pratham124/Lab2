function normalizeReviewStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isCompletedReview(review = {}) {
  const normalized = normalizeReviewStatus(review.status || review.review_status);
  return normalized === "submitted";
}

module.exports = {
  normalizeReviewStatus,
  isCompletedReview,
  getSubmittedReviews(reviews = []) {
    if (!Array.isArray(reviews)) {
      return [];
    }
    return reviews.filter((review) => isCompletedReview(review));
  },
};
