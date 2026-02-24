const fs = require("fs");
const path = require("path");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(template, model) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    return escapeHtml(model[key] || "");
  });
}

function renderLoginView({ email = "", errorMessage = "" } = {}) {
  const templatePath = path.join(__dirname, "..", "..", "public", "login.html");
  const template = fs.readFileSync(templatePath, "utf8");
  return renderTemplate(template, {
    email,
    errorMessage,
  });
}

module.exports = {
  renderLoginView,
};
