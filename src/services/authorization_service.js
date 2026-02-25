function createAuthorizationService({ securityLogService } = {}) {
  const audit =
    securityLogService && typeof securityLogService.logUnauthorizedAccess === "function"
      ? securityLogService
      : {
          logUnauthorizedAccess() {},
        };

  function canAccessInvitation({ userId, invitation } = {}) {
    const normalizedUserId = String(userId || "").trim();
    if (!invitation || !normalizedUserId) {
      return false;
    }

    const invitedReviewerId = String(invitation.reviewerId || "").trim();
    const allowed = invitedReviewerId === normalizedUserId;
    if (!allowed) {
      audit.logUnauthorizedAccess({ userId: normalizedUserId, invitationId: invitation.id });
    }
    return allowed;
  }

  return {
    canAccessInvitation,
  };
}

module.exports = {
  createAuthorizationService,
};
