const fs = require("fs");
const path = require("path");
const { VALIDATION_MESSAGES } = require("../services/validation_messages");

function loadTemplate() {
  const templatePath = path.join(__dirname, "..", "views", "register.html");
  return fs.readFileSync(templatePath, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(template, data) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = data[key] || "";
    return escapeHtml(value);
  });
}

function wantsJson(req) {
  const headers = (req && req.headers) || {};
  const accept = headers.accept || "";
  const contentType = headers["content-type"] || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function createRegistrationController({ registrationService }) {
  const template = loadTemplate();

  function renderPage({ values = {}, errors = {}, formError = "" } = {}) {
    return renderTemplate(template, {
      email: values.email || "",
      emailError: errors.email || "",
      passwordError: errors.password || "",
      formError,
    });
  }

  async function handleGet() {
    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderPage(),
    };
  }

  async function handlePost(req) {
    const payload = (req && req.body) || {};
    const result = await registrationService.register({
      email: payload.email,
      password: payload.password,
    });

    if (result.type === "success") {
      return {
        status: 302,
        headers: { Location: result.redirect },
        body: "",
      };
    }

    const jsonPreferred = wantsJson(req);
    const fieldErrors =
      result.type === "duplicate"
        ? { email: VALIDATION_MESSAGES.EMAIL_IN_USE }
        : result.fieldErrors || {};

    if (jsonPreferred) {
      return {
        status: result.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: result.error,
          fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
        }),
      };
    }

    return {
      status: result.status,
      headers: { "Content-Type": "text/html" },
      body: renderPage({
        values: { email: payload.email || "" },
        errors: fieldErrors,
        formError: result.type === "system_error" ? result.error : "",
      }),
    };
  }

  return {
    handleGet,
    handlePost,
  };
}

module.exports = {
  createRegistrationController,
};
