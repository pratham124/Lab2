function createReviewer({ id, name, email, currentAssignmentCount, eligibilityStatus } = {}) {
  return {
    id: String(id || "").trim(),
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    currentAssignmentCount: Number(currentAssignmentCount || 0),
    eligibilityStatus:
      typeof eligibilityStatus === "boolean" ? eligibilityStatus : String(eligibilityStatus || "").trim() !== "false",
  };
}

function listSelectableReviewers({ reviewers, workloadCountsByReviewerId, limit } = {}) {
  const safeReviewers = Array.isArray(reviewers) ? reviewers : [];
  const safeCounts = workloadCountsByReviewerId || {};
  const maxLoad = Number(limit || 5);

  return safeReviewers.filter((reviewer) => {
    const reviewerId = String((reviewer && reviewer.id) || "").trim();
    const count = Number(safeCounts[reviewerId] || 0);
    return Boolean(reviewer && reviewer.eligibilityStatus) && count < maxLoad;
  });
}

module.exports = {
  createReviewer,
  listSelectableReviewers,
};
