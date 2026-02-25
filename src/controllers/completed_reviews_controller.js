const { getSession, wantsJson, json } = require("./controller_utils");
const { buildErrorResponse } = require("./error_response");
const { canAccessAssignedPaper } = require("./authz");
const {
  renderCompletedReviewsView,
  renderCompletedReviewsError,
} = require("../views/completed_reviews_view");

function createCompletedReviewsController({ sessionService, dataAccess, reviewService, errorLog } = {}) {
  if (!dataAccess || typeof dataAccess.getPaperById !== "function") {
    throw new Error("dataAccess.getPaperById is required");
  }
  if (!reviewService || typeof reviewService.listCompletedReviews !== "function") {
    throw new Error("reviewService.listCompletedReviews is required");
  }

  const logger = errorLog || { recordReviewRetrievalFailure() { return ""; } };

  async function handleGet({ headers = {}, params } = {}) {
    const session = getSession(headers, sessionService);
    if (!session) {
      if (wantsJson(headers)) {
        return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
      }
      return { status: 302, headers: { Location: "/login.html" }, body: "" };
    }

    const paperId = String((params && params.paper_id) || "").trim();
    if (!paperId) {
      const payload = buildErrorResponse({
        message: "Paper id is required.",
        nextStep: "Select a paper to view completed reviews.",
        returnTo: "/papers",
      });
      if (wantsJson(headers)) {
        return json(400, payload);
      }
      return {
        status: 400,
        headers: { "Content-Type": "text/html" },
        body: renderCompletedReviewsError({ title: "Missing Paper", error: payload }),
      };
    }

    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      const payload = buildErrorResponse({
        message: "Paper not found.",
        nextStep: "Select a different paper from your list.",
        returnTo: "/papers",
      });
      if (wantsJson(headers)) {
        return json(404, payload);
      }
      return {
        status: 404,
        headers: { "Content-Type": "text/html" },
        body: renderCompletedReviewsError({ title: "Paper Not Found", error: payload }),
      };
    }

    const editorId = session.user_id;
    if (!canAccessAssignedPaper({ editorId, paper })) {
      const payload = buildErrorResponse({
        message: "Access denied.",
        nextStep: "Open a paper you manage to view completed reviews.",
        returnTo: "/papers",
      });
      if (wantsJson(headers)) {
        return json(403, payload);
      }
      return {
        status: 403,
        headers: { "Content-Type": "text/html" },
        body: renderCompletedReviewsError({ title: "Access Denied", error: payload }),
      };
    }

    const result = reviewService.listCompletedReviews({ paperId });
    if (result.type !== "success") {
      const errorId = logger.recordReviewRetrievalFailure({
        paperId,
        editorId,
        reason: result.message,
        error: result.error,
      });
      const payload = buildErrorResponse({
        message: "Completed reviews cannot be retrieved at this time.",
        nextStep: "Please try again later or contact the conference administrator.",
        returnTo: "/papers",
        errorId,
      });
      if (wantsJson(headers)) {
        return json(500, payload);
      }
      return {
        status: 500,
        headers: { "Content-Type": "text/html" },
        body: renderCompletedReviewsError({
          title: "Completed Reviews Unavailable",
          error: payload,
          returnTo: "/papers",
        }),
      };
    }

    if (wantsJson(headers)) {
      return json(200, {
        paperId,
        completedReviews: result.items,
      });
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderCompletedReviewsView({
        paper,
        reviews: result.items,
        emptyMessage: "No completed reviews are available yet.",
        returnTo: "/papers",
      }),
    };
  }

  return {
    handleGet,
  };
}

module.exports = {
  createCompletedReviewsController,
};
