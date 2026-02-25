function createSecurityLogService({ logger } = {}) {
  const sink =
    logger && typeof logger.warn === "function"
      ? logger
      : {
          warn() {},
        };

  function logUnauthorizedAccess({ userId, invitationId } = {}) {
    sink.warn(
      JSON.stringify({
        event: "unauthorized_review_invitation_access",
        user_id: String(userId || "").trim(),
        invitation_id: String(invitationId || "").trim(),
        at: new Date().toISOString(),
      })
    );
  }

  function logUnauthorizedPaperAccess({ userId, paperId } = {}) {
    sink.warn(
      JSON.stringify({
        event: "unauthorized_assigned_paper_access",
        user_id: String(userId || "").trim(),
        paper_id: String(paperId || "").trim(),
        at: new Date().toISOString(),
      })
    );
  }

  return {
    logUnauthorizedAccess,
    logUnauthorizedPaperAccess,
  };
}

module.exports = {
  createSecurityLogService,
};
