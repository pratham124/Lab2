const { ERROR_MESSAGES } = require("../lib/error-messages");
const { renderSubmissionsView } = require("../views/submissions-view");

function parseCookies(headers) {
  const raw = (headers && headers.cookie) || "";
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf("=");
      const key = idx > -1 ? pair.slice(0, idx) : pair;
      const value = idx > -1 ? pair.slice(idx + 1) : "";
      acc[key] = decodeURIComponent(value || "");
      return acc;
    }, {});
}

function wantsJson(headers) {
  const accept = (headers && headers.accept) || "";
  const contentType = (headers && headers["content-type"]) || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function createDecisionController({ decisionService, sessionService } = {}) {
  if (!decisionService) {
    throw new Error("decisionService is required");
  }
  if (!sessionService) {
    throw new Error("sessionService is required");
  }

  function getSession(req) {
    const cookies = parseCookies((req && req.headers) || {});
    return sessionService.validate(cookies.cms_session || "");
  }

  function asJson(status, payload) {
    return {
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  }

  async function handleListPapers(req) {
    const session = getSession(req);
    if (!session) {
      if (wantsJson(req && req.headers)) {
        return asJson(401, {
          errorCode: "session_expired",
          message: "Session expired. Please log in again.",
        });
      }
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    const result = await decisionService.listDecisionsForAuthor({
      author_id: session.user_id,
    });

    if (result.type === "success") {
      if (wantsJson(req && req.headers)) {
        return asJson(200, {
          items: result.items,
        });
      }

      return {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: renderSubmissionsView({ items: result.items }),
      };
    }

    if (wantsJson(req && req.headers)) {
      return asJson(503, {
        message: ERROR_MESSAGES.DECISION_TEMPORARILY_UNAVAILABLE,
      });
    }

    return {
      status: 503,
      headers: { "Content-Type": "text/html" },
      body: renderSubmissionsView({
        items: [],
        errorMessage: ERROR_MESSAGES.DECISION_TEMPORARILY_UNAVAILABLE,
      }),
    };
  }

  async function handleGetDecision(req) {
    const session = getSession(req);
    if (!session) {
      return asJson(401, {
        errorCode: "session_expired",
        message: "Session expired. Please log in again.",
      });
    }

    const paperId = String((req && req.params && req.params.paper_id) || "").trim();
    const result = await decisionService.getDecisionForPaper({
      paper_id: paperId,
      author_id: session.user_id,
    });

    if (result.type === "success") {
      return asJson(200, result.decision);
    }
    if (result.type === "forbidden") {
      return asJson(403, { message: "Access denied." });
    }
    if (result.type === "not_found") {
      return asJson(404, { message: "Paper or decision not found." });
    }
    if (result.type === "unpublished") {
      return asJson(409, { message: "Decision exists but is not officially published." });
    }
    if (result.type === "validation_error") {
      return asJson(400, { message: "Paper id is required." });
    }

    return asJson(503, {
      message: ERROR_MESSAGES.DECISION_TEMPORARILY_UNAVAILABLE,
    });
  }

  return {
    handleListPapers,
    handleGetDecision,
  };
}

module.exports = {
  createDecisionController,
};
