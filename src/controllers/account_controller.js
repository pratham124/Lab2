const fs = require("fs");
const path = require("path");

function loadTemplate() {
  const templatePath = path.join(__dirname, "..", "views", "account_settings.html");
  return fs.readFileSync(templatePath, "utf8");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(template, model) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    return escapeHtml(model[key] || "");
  });
}

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

function createAccountController({ accountService, sessionService }) {
  const template = loadTemplate();

  function getSessionFromRequest(req) {
    const cookies = parseCookies((req && req.headers) || {});
    return sessionService.validate(cookies.cms_session || "");
  }

  function renderPage({ errors = {}, message = "", failureMessage = "" } = {}) {
    return renderTemplate(template, {
      currentPasswordError: errors.currentPassword || "",
      newPasswordError: errors.newPassword || "",
      successMessage: message,
      failureMessage,
    });
  }

  async function handleGetSettings(req) {
    const session = getSessionFromRequest(req);
    if (!session) {
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderPage(),
    };
  }

  async function handlePostChangePassword(req) {
    const session = getSessionFromRequest(req);
    if (!session) {
      if (wantsJson(req && req.headers)) {
        return {
          status: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "unauthenticated",
            message: "Authentication required.",
          }),
        };
      }
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    const payload = (req && req.body) || {};
    const result = await accountService.changePassword({
      userId: session.user_id,
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });

    if (wantsJson(req && req.headers)) {
      const body = {
        message: result.message,
      };
      if (result.type !== "success") {
        body.errorCode = result.type;
        if (result.fieldErrors) {
          body.fieldErrors = result.fieldErrors;
        }
      }

      return {
        status: result.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    }

    if (result.type === "success") {
      return {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: renderPage({ message: result.message }),
      };
    }

    return {
      status: result.status,
      headers: { "Content-Type": "text/html" },
      body: renderPage({
        // Failed attempts return inline errors only; no lockout/cooldown is applied.
        errors: result.fieldErrors || {},
        failureMessage: result.type === "system_error" ? result.message : "",
      }),
    };
  }

  return {
    handleGetSettings,
    handlePostChangePassword,
  };
}

module.exports = {
  createAccountController,
};
