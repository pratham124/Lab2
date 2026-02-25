const fs = require("fs");
const path = require("path");
const { getActiveReviewFormSchema } = require("../models/review_form_schema");

function readView(file) {
  return fs.readFileSync(path.join(__dirname, file), "utf8");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLayout({ title, content, styles = "", scripts = "" } = {}) {
  const layout = readView("layout.html");
  return layout
    .replace("{{title}}", escapeHtml(title))
    .replace("{{styles}}", styles)
    .replace("{{scripts}}", scripts)
    .replace("{{content}}", content);
}

function renderFieldList({ content, schema }) {
  const fields = [];
  const requiredItems =
    Array.isArray(schema && schema.required) && schema.required.length > 0
      ? schema.required
      : [{ key: "comment", label: "Review Comment" }];
  const optionalItems =
    Array.isArray(schema && schema.optional) && schema.optional.length > 0
      ? schema.optional
      : [{ key: "notes", label: "Optional Notes" }];
  const groups = [
    { label: "Required", items: requiredItems },
    { label: "Optional", items: optionalItems },
  ];

  for (const group of groups) {
    for (const field of group.items) {
      const value = content[field.key];
      fields.push(
        `<div class="completed-review__field"><strong>${escapeHtml(
          field.label
        )}:</strong> ${escapeHtml(value || "—")}</div>`
      );
    }
  }

  return fields.join("\n");
}

function renderReviewerIdentity(review) {
  const reviewerId = review.reviewerId || "";
  const reviewerName = review.reviewerName || "";
  if (reviewerName && reviewerId) {
    return `${escapeHtml(reviewerName)} (ID: ${escapeHtml(reviewerId)})`;
  }
  if (reviewerName) {
    return escapeHtml(reviewerName);
  }
  return escapeHtml(reviewerId || "Unknown reviewer");
}

function renderReviewItem(review, schema) {
  const submittedAt = review.submittedAt
    ? escapeHtml(review.submittedAt)
    : "";
  const submittedMarkup = submittedAt
    ? `<p class="completed-review__meta">Submitted: ${submittedAt}</p>`
    : "";
  /* c8 ignore next */
  const fieldMarkup = renderFieldList({ content: review.content || {}, schema });

  return `
<li class="completed-review">
  <h3>Reviewer: ${renderReviewerIdentity(review)}</h3>
  ${submittedMarkup}
  ${fieldMarkup}
</li>`;
}

function renderCompletedReviewsView({ paper, reviews = [], emptyMessage, returnTo } = {}) {
  const schema = getActiveReviewFormSchema();
  const listItems = reviews.map((review) => renderReviewItem(review, schema)).join("\n");
  const emptyState = reviews.length
    ? ""
    : `<p class="completed-reviews__empty">${escapeHtml(
        emptyMessage || "No completed reviews are available yet."
      )}</p>`;

  const content = `
<section class="completed-reviews" data-paper-id="${escapeHtml(paper.id)}">
  <header>
    <h1>Completed Reviews</h1>
    <p>Paper: <strong>${escapeHtml(paper.title || "")}</strong></p>
    <p><a href="${escapeHtml(returnTo || "/papers")}">Back to papers list</a></p>
  </header>
  ${emptyState}
  <ul class="completed-reviews__list">
    ${listItems}
  </ul>
</section>`;

  return renderLayout({ title: "Completed Reviews", content });
}

function renderCompletedReviewsError({ title, error, returnTo } = {}) {
  const content = `
<section class="completed-reviews" role="alert" aria-live="polite">
  <h1>${escapeHtml(title || "Unable to load completed reviews")}</h1>
  <p>${escapeHtml(error.message || "Please try again later.")}</p>
  <p>${escapeHtml(error.nextStep || "Please try again later.")}</p>
  <p><a href="${escapeHtml(returnTo || error.returnTo || "/papers")}">Return to papers list</a></p>
</section>`;

  return renderLayout({ title: title || "Completed Reviews Error", content });
}

module.exports = {
  renderCompletedReviewsView,
  renderCompletedReviewsError,
  __test: {
    renderReviewItem,
  },
};
