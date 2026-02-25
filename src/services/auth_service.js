function parseCookies(headers) {
  const raw = (headers && headers.cookie) || "";
  return raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf("=");
      const key = idx > -1 ? pair.slice(0, idx) : pair;
      const value = idx > -1 ? pair.slice(idx + 1) : "";
      acc[key] = decodeURIComponent(value || "");
      return acc;
    }, {});
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function createAuthService({ sessionService } = {}) {
  function resolveActor(headers = {}) {
    if (sessionService && typeof sessionService.validate === "function") {
      const cookies = parseCookies(headers);
      const session = sessionService.validate(cookies.cms_session || "");
      if (session) {
        return {
          id: String(session.user_id || "").trim(),
          role: normalizeRole(session.role),
        };
      }
    }

    const fallbackId = String(headers["x-user-id"] || "").trim();
    if (!fallbackId) {
      return null;
    }

    return {
      id: fallbackId,
      role: normalizeRole(headers["x-user-role"]),
    };
  }

  function requireAdmin(headers = {}) {
    const actor = resolveActor(headers);
    if (!actor) {
      return {
        ok: false,
        status: 401,
        errorCode: "session_expired",
        message: "Session expired. Please log in again.",
      };
    }

    if (actor.role !== "admin") {
      return {
        ok: false,
        status: 403,
        errorCode: "access_denied",
        message: "Access denied.",
      };
    }

    return {
      ok: true,
      actor,
    };
  }

  return {
    parseCookies,
    normalizeRole,
    resolveActor,
    requireAdmin,
  };
}

module.exports = {
  createAuthService,
};
