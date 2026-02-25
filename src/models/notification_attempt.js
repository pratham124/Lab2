function createNotificationAttempt({
  attemptId,
  paperId,
  decisionId,
  authorId,
  status,
  attemptedAt,
  errorReason,
} = {}) {
  if (!paperId || !decisionId || !authorId) {
    throw new Error("invalid_notification_attempt");
  }

  return {
    attemptId: String(attemptId || `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    paperId: String(paperId),
    decisionId: String(decisionId),
    authorId: String(authorId),
    status: String(status || "failed"),
    attemptedAt: attemptedAt || new Date().toISOString(),
    errorReason: errorReason ? String(errorReason) : null,
  };
}

module.exports = {
  createNotificationAttempt,
};
