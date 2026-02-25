function createErrorLog({ logger } = {}) {
  const sink = logger && typeof logger.error === "function" ? logger : console;

  function recordReviewRetrievalFailure({ paperId, editorId, reason, error } = {}) {
    const errorId = `review_error_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const entry = {
      event: "completed_review_retrieval_failure",
      error_id: errorId,
      paper_id: String(paperId || "").trim(),
      editor_id: String(editorId || "").trim(),
      reason: String(reason || "review_retrieval_failed").trim(),
      message: error && error.message ? String(error.message) : "",
      at: new Date().toISOString(),
    };
    sink.error(entry);
    return errorId;
  }

  return {
    recordReviewRetrievalFailure,
  };
}

module.exports = {
  createErrorLog,
};
