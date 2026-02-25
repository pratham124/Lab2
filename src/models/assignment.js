function createAssignment({ id, paperId, reviewerId, assignedAt } = {}) {
  return {
    id:
      String(id || "").trim() ||
      `assign_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    paperId: String(paperId || "").trim(),
    reviewerId: String(reviewerId || "").trim(),
    assignedAt: assignedAt || new Date().toISOString(),
  };
}

module.exports = {
  createAssignment,
};
