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
      acc[value.slice(0, idx)] = decodeURIComponent(value.slice(idx + 1) || "");
      return acc;
    }, {});
}

function createNotificationResendController({ decisionService, sessionService } = {}) {
  if (!decisionService) {
    throw new Error("decisionService is required");
  }

  function getActor(headers) {
    if (sessionService && typeof sessionService.validate === "function") {
      const session = sessionService.validate(parseCookies(headers || {}).cms_session || "");
      if (session) {
        return {
          id: session.user_id,
          role: session.role,
        };
      }
    }

    const id = String((headers && headers["x-user-id"]) || "").trim();
    if (!id) {
      return null;
    }
    return {
      id,
      role: String((headers && headers["x-user-role"]) || "").trim().toLowerCase(),
    };
  }

  async function handlePostResend({ headers, params } = {}) {
    const actor = getActor(headers);
    if (!actor) {
      return error(401, "Session expired. Please log in again.", "session_expired");
    }

    const result = await decisionService.resendFailedNotifications({
      paperId: params && params.paper_id,
      actor,
    });

    if (result.type === "success") {
      return json(200, {
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

    return error(503, "Notification resend temporarily unavailable. Please try again later.");
  }

  return {
    handlePostResend,
  };
}

module.exports = {
  createNotificationResendController,
};
