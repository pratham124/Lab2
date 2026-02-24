const { renderLoginView } = require("../views/login-view");
const { renderDashboardView } = require("../views/dashboard-view");

function parseCookies(headers) {
  const raw = (headers && headers.cookie) || "";
  const pairs = raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((pair) => pair.split("="));

  const cookies = {};
  for (const [key, value] of pairs) {
    cookies[key] = decodeURIComponent(value || "");
  }
  return cookies;
}

function wantsJson(headers) {
  const accept = (headers && headers.accept) || "";
  const contentType = (headers && headers["content-type"]) || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function createAuthController({ authService, sessionService }) {
  function getSessionFromRequest(req) {
    const cookies = parseCookies((req && req.headers) || {});
    return sessionService.validate(cookies.cms_session || "");
  }

  async function handleGetLogin(req) {
    const activeSession = getSessionFromRequest(req);
    if (activeSession) {
      return {
        status: 302,
        headers: { Location: "/dashboard.html" },
        body: "",
      };
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderLoginView(),
    };
  }

  async function handlePostLogin(req) {
    const body = (req && req.body) || {};
    const result = await authService.authenticate({
      email: body.email,
      password: body.password,
    });

    if (result.type === "success") {
      const session = sessionService.create(result.user.id);
      if (wantsJson(req && req.headers)) {
        return {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": `cms_session=${session.session_id}; HttpOnly; Path=/; SameSite=Lax`,
          },
          body: JSON.stringify({
            user_id: result.user.id,
            redirect_to: "/dashboard.html",
          }),
        };
      }

      return {
        status: 302,
        headers: {
          Location: "/dashboard.html",
          "Set-Cookie": `cms_session=${session.session_id}; HttpOnly; Path=/; SameSite=Lax`,
        },
        body: "",
      };
    }

    if (wantsJson(req && req.headers)) {
      return {
        status: result.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_code: result.type,
          message: result.message,
        }),
      };
    }

    return {
      status: result.status,
      headers: { "Content-Type": "text/html" },
      body: renderLoginView({
        email: body.email || "",
        errorMessage: result.message,
      }),
    };
  }

  async function handleGetDashboard(req) {
    const activeSession = getSessionFromRequest(req);
    if (!activeSession) {
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderDashboardView({ userId: activeSession.user_id }),
    };
  }

  async function handleGetSession(req) {
    const activeSession = getSessionFromRequest(req);
    if (!activeSession) {
      return {
        status: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_code: "no_session",
          message: "No active session.",
        }),
      };
    }

    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authenticated: true,
        user_id: activeSession.user_id,
      }),
    };
  }

  return {
    handleGetLogin,
    handlePostLogin,
    handleGetDashboard,
    handleGetSession,
  };
}

module.exports = {
  createAuthController,
};
