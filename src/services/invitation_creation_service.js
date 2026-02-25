const { createReviewInvitation } = require("../models/review_invitation");

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function createInvitationCreationService({ dataAccess, notificationService, failureLogger } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const notifier =
    notificationService && typeof notificationService.sendInvitationNotification === "function"
      ? notificationService
      : { async sendInvitationNotification() { return { type: "sent" }; } };

  const logger =
    failureLogger && typeof failureLogger.warn === "function"
      ? failureLogger
      : { warn() {} };

  async function createForAssignments({ paper, assignments } = {}) {
    const safeAssignments = Array.isArray(assignments) ? assignments : [];
    const invitations = [];

    for (const assignment of safeAssignments) {
      const invitation = createReviewInvitation({
        reviewerId: assignment.reviewerId,
        paperId: assignment.paperId,
        createdAt: assignment.assignedAt || new Date().toISOString(),
        responseDueAt: addDays(assignment.assignedAt || new Date().toISOString(), 14),
      });

      const created = dataAccess.createReviewInvitation(invitation);
      invitations.push(created);

      const reviewer = dataAccess.getReviewerById(assignment.reviewerId);
      try {
        await notifier.sendInvitationNotification({ invitation: created, reviewer, paper });
      } catch (error) {
        logger.warn(
          JSON.stringify({
            event: "invitation_notification_failed",
            invitation_id: created.id,
            reviewer_id: assignment.reviewerId,
            error: error && error.message ? error.message : "UNKNOWN_ERROR",
            at: new Date().toISOString(),
          })
        );
      }
    }

    return invitations;
  }

  return {
    createForAssignments,
  };
}

module.exports = {
  createInvitationCreationService,
};
