function createReviewInvitationActionService({ dataAccess, authorizationService } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const authz =
    authorizationService && typeof authorizationService.canAccessInvitation === "function"
      ? authorizationService
      : { canAccessInvitation() { return true; } };

  function respond({ reviewerId, invitationId, action } = {}) {
    const invitation = dataAccess.getReviewInvitationById(invitationId);
    if (!invitation) {
      return { type: "not_found" };
    }

    if (!authz.canAccessInvitation({ userId: reviewerId, invitation })) {
      return { type: "forbidden" };
    }

    if (invitation.status !== "pending") {
      return { type: "conflict", message: "Invitation was already processed." };
    }

    const status = action === "accept" ? "accepted" : "rejected";
    const updated = dataAccess.updateReviewInvitationStatus(invitationId, {
      status,
      respondedAt: new Date().toISOString(),
    });

    return { type: "ok", invitation: updated };
  }

  return {
    respond,
  };
}

module.exports = {
  createReviewInvitationActionService,
};
