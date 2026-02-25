function normalizeStatus(status) {
  const value = String(status || "pending").trim().toLowerCase();
  if (["pending", "accepted", "rejected", "declined"].includes(value)) {
    return value;
  }
  return "pending";
}

function createReviewInvitation({
  id,
  reviewerId,
  paperId,
  status,
  createdAt,
  responseDueAt,
  respondedAt,
} = {}) {
  return {
    id: String(id || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`).trim(),
    reviewerId: String(reviewerId || "").trim(),
    paperId: String(paperId || "").trim(),
    status: normalizeStatus(status),
    createdAt: createdAt || new Date().toISOString(),
    responseDueAt: responseDueAt || "",
    respondedAt: respondedAt || null,
  };
}

module.exports = {
  createReviewInvitation,
  normalizeStatus,
};
