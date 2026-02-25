function createReviewAssignment({ paperId, reviewerId, status, required } = {}) {
  if (!paperId || !reviewerId) {
    throw new Error("invalid_review_assignment");
  }

  return {
    paperId: String(paperId),
    reviewerId: String(reviewerId),
    status: String(status || "pending"),
    required: Boolean(required),
  };
}

module.exports = {
  createReviewAssignment,
};
