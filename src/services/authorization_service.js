function createAuthorizationService({ securityLogService, dataAccess } = {}) {
  const audit =
    securityLogService && typeof securityLogService.logUnauthorizedAccess === "function"
      ? securityLogService
      : {
          logUnauthorizedAccess() {},
        };
  const paperAudit =
    securityLogService && typeof securityLogService.logUnauthorizedPaperAccess === "function"
      ? securityLogService
      : {
          logUnauthorizedPaperAccess() {},
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

  function canAccessAssignedPaper({ reviewerId, paperId } = {}) {
    const normalizedReviewerId = String(reviewerId || "").trim();
    const normalizedPaperId = String(paperId || "").trim();

    if (!normalizedReviewerId || !normalizedPaperId || !dataAccess) {
      if (normalizedReviewerId || normalizedPaperId) {
        paperAudit.logUnauthorizedPaperAccess({
          userId: normalizedReviewerId,
          paperId: normalizedPaperId,
        });
      }
      return false;
    }

    const allowed =
      typeof dataAccess.isPaperAssignedToReviewer === "function" &&
      dataAccess.isPaperAssignedToReviewer({
        reviewerId: normalizedReviewerId,
        paperId: normalizedPaperId,
      });

    if (!allowed) {
      paperAudit.logUnauthorizedPaperAccess({
        userId: normalizedReviewerId,
        paperId: normalizedPaperId,
      });
    }

    return Boolean(allowed);
  }

  function canAccessAuthorPaper({ authorId, paperId } = {}) {
    const normalizedAuthorId = String(authorId || "").trim();
    const normalizedPaperId = String(paperId || "").trim();

    if (!normalizedAuthorId || !normalizedPaperId || !dataAccess) {
      paperAudit.logUnauthorizedPaperAccess({
        userId: normalizedAuthorId,
        paperId: normalizedPaperId,
      });
      return false;
    }

    const allowed =
      typeof dataAccess.isPaperOwnedByAuthor === "function" &&
      dataAccess.isPaperOwnedByAuthor({
        authorId: normalizedAuthorId,
        paperId: normalizedPaperId,
      });

    if (!allowed) {
      paperAudit.logUnauthorizedPaperAccess({
        userId: normalizedAuthorId,
        paperId: normalizedPaperId,
      });
    }

    return Boolean(allowed);
  }

  return {
    canAccessInvitation,
    canAccessAssignedPaper,
    canAccessAuthorPaper,
  };
}

module.exports = {
  createAuthorizationService,
};
