function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSubmissionsView({ items = [], errorMessage = "" } = {}) {
  const list = Array.isArray(items) ? items : [];
  const rows = list
    .map((item) => {
      const status = item.decisionStatus || "Pending publication";
      return `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(status)}</td></tr>`;
    })
    .join("");

  const safeError = errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>My Submissions</title>
  </head>
  <body>
    <main>
      <h1>My Submissions</h1>
      ${safeError}
      <table>
        <thead><tr><th>Paper</th><th>Final Decision</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderSubmissionsView,
};
