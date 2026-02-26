function createAuditLogService({ logger } = {}) {
  const sink =
    logger && typeof logger.warn === "function"
      ? logger
      : {
          warn() {},
        };

  function append(event, details = {}) {
    sink.warn(
      JSON.stringify({
        event: String(event || "audit_event").trim(),
        at: new Date().toISOString(),
        ...details,
      })
    );
  }

  function logRetrievalError({ actorId, paperId, reason } = {}) {
    append("final_schedule_retrieval_error", {
      actor_id: String(actorId || "").trim(),
      paper_id: String(paperId || "").trim(),
      reason: String(reason || "unknown").trim(),
    });
  }

  function logNotificationFailure({ conferenceId, authorId, paperId, reason } = {}) {
    append("final_schedule_notification_failed", {
      conference_id: String(conferenceId || "").trim(),
      author_id: String(authorId || "").trim(),
      paper_id: String(paperId || "").trim(),
      reason: String(reason || "unknown").trim(),
    });
  }

  return {
    append,
    logRetrievalError,
    logNotificationFailure,
  };
}

module.exports = {
  createAuditLogService,
};
