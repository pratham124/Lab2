const fs = require("fs");

function json(status, payload) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function html(status, body) {
  return {
    status,
    headers: { "Content-Type": "text/html" },
    body,
  };
}

function renderView({ templatePath, replacements } = {}) {
  const template = fs.readFileSync(templatePath, "utf8");
  let body = template;
  const entries = Object.entries(replacements || {});
  for (const [key, value] of entries) {
    body = body.replaceAll(`{{${key}}}`, String(value));
  }
  return body;
}

function accessDenied() {
  return json(403, { errorCode: "access_denied", message: "Access denied." });
}

module.exports = {
  json,
  html,
  renderView,
  accessDenied,
};
