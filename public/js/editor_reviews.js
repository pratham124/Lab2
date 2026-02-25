function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderReviewItem(review) {
  const comment = review.required_fields ? review.required_fields.comment : "";
  const notes = review.optional_fields ? review.optional_fields.notes : "";
  return `\n<li class="review-item">\n  <h3>Reviewer ${escapeHtml(
    review.reviewer_id
  )}</h3>\n  <p class="review-item__meta">Submitted: ${escapeHtml(
    review.submitted_at
  )}</p>\n  <div class="review-item__field"><strong>Comment:</strong> ${escapeHtml(
    comment
  )}</div>\n  ${
    notes
      ? `<div class="review-item__field"><strong>Notes:</strong> ${escapeHtml(notes)}</div>`
      : ""
  }\n</li>`;
}

async function loadReviews(container, paperId) {
  const status = container.querySelector(".editor-reviews__status");
  const list = container.querySelector("[data-review-list]");
  if (!list) {
    return;
  }

  try {
    const response = await fetch(`/papers/${paperId}/reviews`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      if (status) {
        status.textContent = "Unable to load reviews.";
      }
      return;
    }
    const payload = await response.json();
    const items = payload.items || [];
    if (!items.length) {
      if (status) {
        status.textContent = "No reviews submitted yet.";
      }
      list.innerHTML = "";
      return;
    }
    if (status) {
      status.textContent = "";
    }
    list.innerHTML = items.map(renderReviewItem).join("");
  } catch (_error) {
    if (status) {
      status.textContent = "Unable to load reviews.";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".editor-reviews");
  if (!container) {
    return;
  }
  const paperId = container.dataset.paperId || "";
  if (!paperId) {
    return;
  }
  loadReviews(container, paperId);
});
