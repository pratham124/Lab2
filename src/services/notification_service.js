function createNotificationService({ inviter, logger } = {}) {
  const invitationSender =
    inviter && typeof inviter.sendInvitation === "function"
      ? inviter
      : {
          async sendInvitation() {},
        };

  const sink =
    logger && typeof logger.warn === "function"
      ? logger
      : {
          warn() {},
        };

  async function sendReviewerInvitations({ paper, reviewers, assignments } = {}) {
    const failures = [];

    for (const reviewer of reviewers || []) {
      try {
        await invitationSender.sendInvitation({
          paper,
          reviewer,
          assignments,
        });
      } catch (error) {
        const reason = error && error.message ? error.message : "invitation_failed";
        failures.push({ reviewerId: reviewer.id, reason });
        sink.warn(
          JSON.stringify({
            event: "reviewer_invitation_failed",
            paper_id: paper && paper.id,
            reviewer_id: reviewer.id,
            reason,
            at: new Date().toISOString(),
          })
        );
      }
    }

    if (failures.length > 0) {
      return {
        type: "partial_failure",
        warningCode: "invitation_partial_failure",
        warningMessage:
          "Assignments were saved, but one or more reviewer invitations failed and were logged for retry.",
        failures,
      };
    }

    return {
      type: "sent",
      failures: [],
    };
  }

  return {
    sendReviewerInvitations,
  };
}

module.exports = {
  createNotificationService,
};
