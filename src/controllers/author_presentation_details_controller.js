const responseService = require("../services/response_service");
const { createAuthService } = require("../services/auth_service");
const { buildErrorMessage } = require("../lib/error_messages");

function createAuthorPresentationDetailsController({
  dataAccess,
  authorizationService,
  scheduleService,
  presentationDetailsService,
  auditLogService,
  authService,
  response,
} = {}) {
  if (!dataAccess || !authorizationService || !scheduleService || !presentationDetailsService) {
    throw new Error("missing dependencies");
  }

  const auth = authService || createAuthService();
  const responses = response || responseService;
  const audit =
    auditLogService && typeof auditLogService.logRetrievalError === "function"
      ? auditLogService
      : { logRetrievalError() {} };

  async function handleGetPresentationDetails({ headers, params } = {}) {
    const actor = auth.resolveActor(headers || {});
    if (!actor) {
      return responses.json(401, {
        errorCode: "session_expired",
        message: "Session expired. Please log in again.",
      });
    }

    const paperId = String((params && params.paperId) || "").trim();
    const paper =
      typeof dataAccess.getPaperById === "function" ? dataAccess.getPaperById(paperId) : null;
    if (!paper) {
      return responses.json(404, buildErrorMessage({ category: "not_found", nextStep: "Check the paper ID and retry." }));
    }

    if (!authorizationService.canAccessAuthorPaper({ authorId: actor.id, paperId })) {
      return responses.json(403, buildErrorMessage({ category: "forbidden", nextStep: "Open one of your own accepted papers." }));
    }

    const published = scheduleService.ensurePublished({ conferenceId: paper.conferenceId || "C1" });
    if (published.type !== "published") {
      return responses.json(409, buildErrorMessage({ category: "schedule_not_published", nextStep: "Wait until the final schedule is published." }));
    }

    try {
      const result = presentationDetailsService.getByPaperId({ paperId });
      if (result.type !== "success") {
        return responses.json(404, buildErrorMessage({ category: "not_found", nextStep: "Verify the paper has published presentation details." }));
      }
      return responses.json(200, result.details);
    } catch (error) {
      const reason = error && error.message ? error.message : "schedule_retrieval_failed";
      audit.logRetrievalError({ actorId: actor.id, paperId, reason });
      return responses.json(
        503,
        buildErrorMessage({
          category: "service_unavailable",
          nextStep: "Retry, check connection, or contact support/admin.",
          reportIssueAvailable: true,
        })
      );
    }
  }

  return {
    handleGetPresentationDetails,
  };
}

module.exports = {
  createAuthorPresentationDetailsController,
};
