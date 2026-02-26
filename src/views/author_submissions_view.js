function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAuthorSubmissionsView({ submissions = [] } = {}) {
  const rows = (Array.isArray(submissions) ? submissions : [])
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.title)}</td><td>${escapeHtml(entry.status)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Accepted Submissions</title>
  </head>
  <body>
    <main>
      <h1>Accepted Submissions</h1>
      <table>
        <thead><tr><th>Paper ID</th><th>Title</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderAuthorSubmissionsView,
};
