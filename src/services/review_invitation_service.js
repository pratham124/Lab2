const { paginate } = require("./pagination");

function byNewestFirst(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function createReviewInvitationService({ dataAccess, invitationStatusService, authorizationService } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const statusUpdater =
    invitationStatusService && typeof invitationStatusService.refreshStatuses === "function"
      ? invitationStatusService
      : { refreshStatuses() {} };

  const authz =
    authorizationService && typeof authorizationService.canAccessInvitation === "function"
      ? authorizationService
      : { canAccessInvitation() { return true; } };

  function listForReviewer({ reviewerId, status = "pending", page = 1, pageSize = 20 } = {}) {
    const invitations = dataAccess.listReviewInvitationsByReviewer(reviewerId);
    statusUpdater.refreshStatuses(invitations);

    const filtered = invitations
      .filter((item) => !status || String(item.status) === String(status))
      .sort(byNewestFirst)
      .map((invitation) => {
        const paper = dataAccess.getPaperById(invitation.paperId);
        return {
          id: invitation.id,
          paperId: invitation.paperId,
          paperTitle: paper ? paper.title : "Unknown paper",
          status: invitation.status,
          responseDueAt: invitation.responseDueAt || null,
          createdAt: invitation.createdAt,
        };
      });

    return paginate(filtered, { page, pageSize });
  }

  function getById({ reviewerId, invitationId } = {}) {
    const invitation = dataAccess.getReviewInvitationById(invitationId);
    if (!invitation) {
      return null;
    }
    if (!authz.canAccessInvitation({ userId: reviewerId, invitation })) {
      return "forbidden";
    }

    const paper = dataAccess.getPaperById(invitation.paperId);
    return {
      id: invitation.id,
      paperId: invitation.paperId,
      paperTitle: paper ? paper.title : "Unknown paper",
      status: invitation.status,
      createdAt: invitation.createdAt,
      responseDueAt: invitation.responseDueAt || null,
      paperAbstract: invitation.status === "accepted" && paper ? paper.abstract || "" : undefined,
    };
  }

  return {
    listForReviewer,
    getById,
  };
}

module.exports = {
  createReviewInvitationService,
};
