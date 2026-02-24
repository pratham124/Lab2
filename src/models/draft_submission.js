function createDraftSubmission({ draft_id, submission_id, author_id, saved_at, data } = {}) {
  return {
    draft_id:
      String(draft_id || "").trim() ||
      `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    submission_id: String(submission_id || "").trim(),
    author_id: String(author_id || "").trim(),
    saved_at: saved_at || new Date().toISOString(),
    data: data && typeof data === "object" ? { ...data } : {},
  };
}

module.exports = {
  createDraftSubmission,
};
