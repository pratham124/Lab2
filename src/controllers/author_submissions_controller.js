const responseService = require("../services/response_service");
const { createAuthService } = require("../services/auth_service");

function createAuthorSubmissionsController({ dataAccess, presentationDetailsService, authService, response } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const auth = authService || createAuthService();
  const responses = response || responseService;

  async function handleListSubmissions({ headers } = {}) {
    const actor = auth.resolveActor(headers || {});
    if (!actor) {
      return responses.json(401, {
        errorCode: "session_expired",
        message: "Session expired. Please log in again.",
      });
    }

    const submissions =
      typeof dataAccess.listAcceptedPapersByAuthorId === "function"
        ? dataAccess.listAcceptedPapersByAuthorId(actor.id)
        : [];

    return responses.json(200, {
      submissions: submissions.map((paper) => ({
        id: paper.id,
        title: paper.title,
        status: paper.status,
        presentationDetails:
          presentationDetailsService &&
          typeof presentationDetailsService.getByPaperId === "function" &&
          typeof presentationDetailsService.validatePaperDetailsMapping === "function"
            ? (() => {
                const result = presentationDetailsService.getByPaperId({ paperId: paper.id });
                if (result.type !== "success") {
                  return null;
                }
                return presentationDetailsService.validatePaperDetailsMapping({
                  paperId: paper.id,
                  details: result.details,
                })
                  ? result.details
                  : null;
              })()
            : null,
      })),
    });
  }

  return {
    handleListSubmissions,
  };
}

module.exports = {
  createAuthorSubmissionsController,
};
