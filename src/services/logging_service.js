function createLoggingService({ sink } = {}) {
  const logger = sink && typeof sink.log === "function" ? sink : console;

  function write(entry) {
    logger.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry,
      })
    );
  }

  return {
    logSaveFailure({ submission_id, author_id, reason, error_code }) {
      write({
        event: "draft_save_failure",
        submission_id,
        author_id,
        reason: reason || "unknown",
        error_code: error_code || "UNKNOWN_ERROR",
      });
    },

    logUnauthorizedAccess({ submission_id, actor_author_id, owner_author_id, action }) {
      write({
        event: "draft_unauthorized_access",
        submission_id,
        actor_author_id,
        owner_author_id,
        action: action || "unknown",
      });
    },
  };
}

module.exports = {
  createLoggingService,
};
