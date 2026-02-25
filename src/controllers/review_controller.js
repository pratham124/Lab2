const fs = require("fs");
const path = require("path");
const { getSession, wantsJson, json } = require("./controller_utils");
const { buildErrorResponse } = require("../services/error_response");
const { REVIEW_MESSAGES } = require("../models/review_model");

function readView(file) {
  return fs.readFileSync(path.join(__dirname, "..", "views", file), "utf8");
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
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) =>
    escapeHtml(model[key] || "")
  );
}

function renderListItems(items) {
  if (!items.length) {
    return "";
  }
  return items
    .map((review) => {
      const comment = review.required_fields ? review.required_fields.comment : "";
      const notes = review.optional_fields ? review.optional_fields.notes : "";
      return `\n<li class="review-item">\n  <h3>Reviewer ${escapeHtml(
        review.reviewer_id
      )}</h3>\n  <p class="review-item__meta">Submitted: ${escapeHtml(
        review.submitted_at
      )}</p>\n  <div class="review-item__field"><strong>Comment:</strong> ${escapeHtml(
        comment
      )}</div>\n  ${notes ? `<div class="review-item__field"><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ""}\n</li>`;
    })
    .join("");
}

function createReviewController({ sessionService, reviewModel, dataAccess, authorizationService } = {}) {
  if (!reviewModel) {
    throw new Error("reviewModel is required");
  }
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const layout = readView("layout.html");
  const formTemplate = readView("review_form.html");
  const listTemplate = readView("editor_reviews.html");
  const errorTemplate = readView("error_message.html");

  const authz =
    authorizationService && typeof authorizationService.canAccessAssignedPaper === "function"
      ? authorizationService
      : { canAccessAssignedPaper() { return true; } };

  function renderPage({ title, content, scripts = "" } = {}) {
    return layout
      .replace("{{title}}", escapeHtml(title))
      .replace("{{styles}}", "")
      .replace("{{scripts}}", scripts)
      .replace("{{content}}", content);
  }

  function renderErrorView(payload) {
    return errorTemplate
      .replace("{{errorMessage}}", escapeHtml(payload.message))
      .replace("{{nextStep}}", escapeHtml(payload.nextStep))
      .replace("{{backLink}}", escapeHtml(payload.backLink));
  }

  function renderForm({
    paper,
    values = {},
    fieldErrors = {},
    formMessage = "",
    successMessage = "",
    immutable = false,
  } = {}) {
    const submitDisabled = immutable ? "disabled" : "";
    const immutableValue = immutable ? "true" : "false";
    const immutableMessage = immutable ? REVIEW_MESSAGES.IMMUTABLE : "";

    return renderTemplate(formTemplate, {
      paperTitle: paper.title || "",
      paperId: paper.id || "",
      backLink: `/reviewer/assignments/${paper.id}`,
      comment: values.comment || "",
      notes: values.notes || "",
      commentError: fieldErrors.comment || "",
      formMessage,
      successMessage,
      submitDisabled,
      immutableValue,
      immutableMessage,
    });
  }

  function renderList({ paper, items, statusMessage } = {}) {
    const listItems = renderListItems(items || []);
    const emptyState = (items || []).length
      ? ""
      : '<p class="editor-reviews__empty">No reviews submitted yet.</p>';

    return renderTemplate(listTemplate, {
      paperTitle: paper.title || "",
      paperId: paper.id || "",
      backLink: `/papers/${paper.id}/decision`,
      listItems,
      emptyState,
      statusMessage: statusMessage || "",
    });
  }

  function requireSession(headers = {}) {
    return getSession(headers, sessionService);
  }

  function ensureInvitationAccepted({ reviewerId, paperId } = {}) {
    const invitations = dataAccess.listReviewInvitationsByReviewer(reviewerId) || [];
    return invitations.some(
      (invitation) =>
        String(invitation.paperId || "").trim() === String(paperId || "").trim() &&
        String(invitation.status || "").trim() === "accepted"
    );
  }

  async function handleGetForm({ headers = {}, params } = {}) {
    const session = requireSession(headers);
    if (!session) {
      if (wantsJson(headers)) {
        return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
      }
      return { status: 302, headers: { Location: "/login.html" }, body: "" };
    }

    const paperId = String((params && params.paper_id) || "").trim();
    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      if (wantsJson(headers)) {
        return json(404, { errorCode: "not_found", message: "Paper not found." });
      }
      return {
        status: 404,
        headers: { "Content-Type": "text/plain" },
        body: "Not found",
      };
    }

    const isAssigned = authz.canAccessAssignedPaper({
      reviewerId: session.user_id,
      paperId,
    });
    if (!isAssigned) {
      const payload = buildErrorResponse({
        errorCode: "access_denied",
        message: "Access denied.",
        nextStep: "Open a paper from your assigned papers list.",
        backLink: "/reviewer/assignments",
      });
      if (wantsJson(headers)) {
        return json(403, payload);
      }
      return {
        status: 403,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Access Denied",
          content: renderErrorView(payload),
        }),
      };
    }

    if (!ensureInvitationAccepted({ reviewerId: session.user_id, paperId })) {
      const payload = buildErrorResponse({
        errorCode: "invitation_required",
        message: "Review invitation must be accepted before submission.",
        nextStep: "Accept the review invitation to submit your review.",
        backLink: "/review-invitations",
      });
      if (wantsJson(headers)) {
        return json(403, payload);
      }
      return {
        status: 403,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Invitation Required",
          content: renderErrorView(payload),
        }),
      };
    }

    const existing = reviewModel.findByReviewerAndPaper({
      reviewerId: session.user_id,
      paperId,
    });

    if (wantsJson(headers)) {
      return json(200, {
        paperId,
        paperTitle: paper.title,
        alreadySubmitted: Boolean(existing),
      });
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderPage({
        title: "Submit Review",
        content: renderForm({
          paper,
          values: existing
            ? {
                ...((existing && existing.required_fields) || {}),
                ...((existing && existing.optional_fields) || {}),
              }
            : {},
          formMessage: existing
            ? `Review submitted on ${existing.submitted_at}.`
            : "",
          immutable: Boolean(existing),
        }),
        scripts: '<script src="/js/review_form.js" defer></script>',
      }),
    };
  }

  async function handlePost({ headers = {}, params, body } = {}) {
    const session = requireSession(headers);
    const wants = wantsJson(headers);
    if (!session) {
      if (wants) {
        return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
      }
      return { status: 302, headers: { Location: "/login.html" }, body: "" };
    }

    const paperId = String((params && params.paper_id) || "").trim();
    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      if (wants) {
        return json(404, { errorCode: "not_found", message: "Paper not found." });
      }
      return {
        status: 404,
        headers: { "Content-Type": "text/plain" },
        body: "Not found",
      };
    }

    const isAssigned = authz.canAccessAssignedPaper({
      reviewerId: session.user_id,
      paperId,
    });
    if (!isAssigned) {
      const message = "You are not authorized to submit a review for this paper.";
      if (wants) {
        return json(403, { errorCode: "not_authorized", message });
      }
      return {
        status: 403,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Access Denied",
          content: renderForm({
            paper,
            values: body || {},
            formMessage: message,
          }),
          scripts: '<script src="/js/review_form.js" defer></script>',
        }),
      };
    }

    if (!ensureInvitationAccepted({ reviewerId: session.user_id, paperId })) {
      const message = "You must accept the review invitation before submitting.";
      if (wants) {
        return json(403, { errorCode: "invitation_required", message });
      }
      return {
        status: 403,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Invitation Required",
          content: renderForm({
            paper,
            values: body || {},
            formMessage: message,
          }),
          scripts: '<script src="/js/review_form.js" defer></script>',
        }),
      };
    }

    const payload = body || {};
    const requiredFields = payload.requiredFields || {
      comment: payload.comment,
    };
    const optionalFields = payload.optionalFields || {
      notes: payload.notes,
    };
    const simulateFailure =
      payload.simulate_failure === "1" || payload.simulate_failure === 1 || false;

    const result = reviewModel.create({
      reviewerId: session.user_id,
      paperId,
      requiredFields,
      optionalFields,
      simulateFailure,
    });

    if (result.type === "success") {
      const successMessage =
        "Review submitted successfully. It is now visible to the editor.";
      if (wants) {
        return json(201, {
          message: successMessage,
          reviewId: result.review.review_id,
          status: result.review.status,
        });
      }
      return {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Review Submitted",
          content: renderForm({
            paper,
            values: result.review.required_fields,
            successMessage,
            immutable: true,
          }),
          scripts: '<script src="/js/review_form.js" defer></script>',
        }),
      };
    }

    if (result.type === "duplicate") {
      if (wants) {
        return json(409, { errorCode: "duplicate_review", message: result.message });
      }
      return {
        status: 409,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Review Already Submitted",
          content: renderForm({
            paper,
            values: (result.review && result.review.required_fields) || requiredFields,
            formMessage: REVIEW_MESSAGES.IMMUTABLE,
            immutable: true,
          }),
          scripts: '<script src="/js/review_form.js" defer></script>',
        }),
      };
    }

    if (result.type === "validation_error") {
      if (wants) {
        return json(400, {
          errorCode: "validation_error",
          message: result.message,
          fieldErrors: result.fieldErrors,
        });
      }
      return {
        status: 400,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Review Validation",
          content: renderForm({
            paper,
            values: { comment: requiredFields.comment, notes: optionalFields.notes },
            fieldErrors: result.fieldErrors,
          }),
          scripts: '<script src="/js/review_form.js" defer></script>',
        }),
      };
    }

    const failureMessage = REVIEW_MESSAGES.SAVE_FAILURE;
    if (wants) {
      return json(500, { errorCode: "save_failure", message: failureMessage });
    }
    return {
      status: 500,
      headers: { "Content-Type": "text/html" },
      body: renderPage({
        title: "Review Submission Failed",
        content: renderForm({
          paper,
          values: { comment: requiredFields.comment, notes: optionalFields.notes },
          formMessage: failureMessage,
        }),
        scripts: '<script src="/js/review_form.js" defer></script>',
      }),
    };
  }

  async function handleList({ headers = {}, params } = {}) {
    const session = requireSession(headers);
    if (!session) {
      if (wantsJson(headers)) {
        return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
      }
      return { status: 302, headers: { Location: "/login.html" }, body: "" };
    }

    const paperId = String((params && params.paper_id) || "").trim();
    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      if (wantsJson(headers)) {
        return json(404, { errorCode: "not_found", message: "Paper not found." });
      }
      return {
        status: 404,
        headers: { "Content-Type": "text/plain" },
        body: "Not found",
      };
    }

    const reviews = reviewModel.listByPaperId(paperId);
    if (wantsJson(headers)) {
      return json(200, { items: reviews });
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderPage({
        title: "Paper Reviews",
        content: renderList({ paper, items: reviews }),
        scripts: '<script src="/js/editor_reviews.js" defer></script>',
      }),
    };
  }

  return {
    handleGetForm,
    handlePost,
    handleList,
  };
}

module.exports = {
  createReviewController,
};
