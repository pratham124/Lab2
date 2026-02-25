const { json, error } = require("./response");

function parseCookies(headers) {
  const raw = (headers && headers.cookie) || "";
  return raw
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .reduce((acc, value) => {
      const idx = value.indexOf("=");
      if (idx < 0) {
        return acc;
      }
      const key = value.slice(0, idx);
      const parsed = value.slice(idx + 1);
      acc[key] = decodeURIComponent(parsed || "");
      return acc;
    }, {});
}

function createDecisionController({ decisionService, sessionService } = {}) {
  if (!decisionService) {
    throw new Error("decisionService is required");
  }

  function getActor(headers) {
    if (sessionService && typeof sessionService.validate === "function") {
      const cookies = parseCookies(headers || {});
      const session = sessionService.validate(cookies.cms_session || "");
      if (session) {
        return {
          id: session.user_id,
          role: session.role,
        };
      }
    }

    const fallbackId = String((headers && headers["x-user-id"]) || "").trim();
    if (!fallbackId) {
      return null;
    }

    return {
      id: fallbackId,
      role: String((headers && headers["x-user-role"]) || "").trim().toLowerCase(),
    };
  }

  async function handlePostDecision({ headers, params, body } = {}) {
    const actor = getActor(headers);
    if (!actor) {
      return error(401, "Session expired. Please log in again.", "session_expired");
    }

    const result = await decisionService.recordDecision({
      paperId: params && params.paper_id,
      outcome: body && body.outcome,
      actor,
    });

    if (result.type === "success") {
      return json(200, {
        decisionId: result.decisionId,
        final: result.final,
        notificationStatus: result.notificationStatus,
        failedAuthors: result.failedAuthors,
      });
    }

    if (result.type === "forbidden") {
      return error(403, result.message);
    }
    if (result.type === "validation_error") {
      return error(400, result.message);
    }
    if (result.type === "not_found") {
      return error(404, result.message);
    }
    if (result.type === "conflict") {
      return error(409, result.message);
    }
    if (result.type === "storage_error") {
      return error(500, result.message);
    }

    return error(503, "Decision temporarily unavailable. Please try again later.");
  }

  async function handleGetDecision({ headers, params } = {}) {
    const actor = getActor(headers);
    if (!actor) {
      return error(401, "Session expired. Please log in again.", "session_expired");
    }

    const result = await decisionService.getDecisionView({
      paperId: params && params.paper_id,
      actor,
    });

    if (result.type === "success") {
      return json(200, result.decision);
    }
    if (result.type === "validation_error") {
      return error(400, result.message);
    }
    if (result.type === "forbidden") {
      return error(403, result.message);
    }
    if (result.type === "not_found") {
      return error(404, result.message);
    }

    return error(503, "Decision temporarily unavailable. Please try again later.");
  }

  return {
    handlePostDecision,
    handleGetDecision,
  };
}

module.exports = {
  createDecisionController,
};
