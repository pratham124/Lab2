function createPaper({ id, title, status, assignedReviewerCount } = {}) {
  return {
    id: String(id || "").trim(),
    title: String(title || "").trim(),
    status: String(status || "submitted").trim() || "submitted",
    assignedReviewerCount: Number(assignedReviewerCount || 0),
  };
}

module.exports = {
  createPaper,
};
