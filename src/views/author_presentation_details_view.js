function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAuthorPresentationDetailsView({ paperTitle = "", details } = {}) {
  const model = details || {};
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Presentation Details</title>
  </head>
  <body>
    <main>
      <h1>Presentation Details</h1>
      <h2>${escapeHtml(paperTitle)}</h2>
      <ul>
        <li>Date: ${escapeHtml(model.date)}</li>
        <li>Time: ${escapeHtml(model.time)}</li>
        <li>Session: ${escapeHtml(model.session)}</li>
        <li>Location: ${escapeHtml(model.location)}</li>
        <li>Timezone: ${escapeHtml(model.timezone)}</li>
      </ul>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderAuthorPresentationDetailsView,
};
