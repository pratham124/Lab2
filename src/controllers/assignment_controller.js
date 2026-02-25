const fs = require("fs");
const path = require("path");
const { getSession, wantsJson, json } = require("./controller_utils");

function loadTemplate() {
  return fs.readFileSync(path.join(__dirname, "..", "views", "assign_reviewers.html"), "utf8");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(template, model) {
  return template
    /* c8 ignore next */
    .replace("{{paperTitle}}", escapeHtml(model.paperTitle || ""))
    .replace("{{paperId}}", escapeHtml(model.paperId || ""))
    .replace("{{successMessage}}", escapeHtml(model.successMessage || ""))
    .replace("{{errorMessage}}", escapeHtml(model.errorMessage || ""))
    .replace("{{warningMessage}}", escapeHtml(model.warningMessage || ""))
    .replace("{{reviewerOptions}}", model.reviewerOptions || "");
}

function normalizeSelectedReviewers(body = {}) {
  if (Array.isArray(body.reviewer_ids)) {
    return body.reviewer_ids;
  }
  if (typeof body.reviewer_ids === "string") {
    return [body.reviewer_ids];
  }
  if (Array.isArray(body.reviewerIds)) {
    return body.reviewerIds;
  }
  return [];
}

function createAssignmentController({ assignmentService, sessionService, dataAccess } = {}) {
  if (!assignmentService) {
    throw new Error("assignmentService is required");
  }

  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const template = loadTemplate();

  function requireEditor(headers) {
    const session = getSession(headers, sessionService);
    if (!session) {
      return { ok: false, status: 401, errorCode: "session_expired", message: "Session expired." };
    }
    if (session.role !== "editor") {
      return { ok: false, status: 403, errorCode: "forbidden", message: "Editor role is required." };
    }
    return { ok: true, session };
  }

  function renderForm({ paperId, successMessage, errorMessage, warningMessage, selectedIds } = {}) {
    const paper = dataAccess.getPaperById(paperId);
    const eligible = dataAccess.listEligibleReviewers(paperId);
    const selectedSet = new Set((selectedIds || []).map((id) => String(id || "").trim()));

    const reviewerOptions = eligible
      .map((reviewer) => {
        const checked = selectedSet.has(reviewer.id) ? "checked" : "";
        return `<label class="reviewer-item"><input type="checkbox" name="reviewer_ids" value="${escapeHtml(
          reviewer.id
        )}" ${checked} /> ${escapeHtml(reviewer.name)} (Current load: ${escapeHtml(
          reviewer.currentAssignmentCount
        )})</label>`;
      })
      .join("\n");

    return renderTemplate(template, {
      paperTitle: (paper && paper.title) || "Unknown paper",
      paperId,
      successMessage,
      errorMessage,
      warningMessage,
      reviewerOptions,
    });
  }

  async function handleGetForm({ headers, params } = {}) {
    const auth = requireEditor(headers || {});
    if (!auth.ok) {
      if (wantsJson(headers || {})) {
        return json(auth.status, { errorCode: auth.errorCode, message: auth.message });
      }
      if (auth.status === 401) {
        return { status: 302, headers: { Location: "/login.html" }, body: "" };
      }
      return { status: 403, headers: { "Content-Type": "text/plain" }, body: "Forbidden" };
    }

    const paperId = String((params && (params.paper_id || params.paperId)) || "").trim();
    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      return json(404, { errorCode: "invalid_paper", message: "Paper not found." });
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderForm({ paperId }),
    };
  }

  async function handleGetEligibleReviewers({ headers, params } = {}) {
    const auth = requireEditor(headers || {});
    if (!auth.ok) {
      return json(auth.status, { errorCode: auth.errorCode, message: auth.message });
    }

    const paperId = String((params && (params.paper_id || params.paperId)) || "").trim();
    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      return json(404, { errorCode: "invalid_paper", message: "Paper not found." });
    }

    return json(200, {
      paper_id: paper.id,
      eligible_reviewers: dataAccess.listEligibleReviewers(paperId),
    });
  }

  async function handlePostAssignment({ headers, params, body } = {}) {
    const auth = requireEditor(headers || {});
    if (!auth.ok) {
      if (wantsJson(headers || {})) {
        return json(auth.status, { errorCode: auth.errorCode, message: auth.message });
      }
      if (auth.status === 401) {
        return { status: 302, headers: { Location: "/login.html" }, body: "" };
      }
      return { status: 403, headers: { "Content-Type": "text/plain" }, body: "Forbidden" };
    }

    const paperId = String((params && (params.paper_id || params.paperId)) || "").trim();
    const reviewerIds = normalizeSelectedReviewers(body || {});
    const result = await assignmentService.assignReviewers({ paperId, reviewerIds });

    if (result.type === "validation_error") {
      if (wantsJson(headers || {})) {
        return json(result.status || 400, {
          errorCode: result.errorCode,
          message: result.message,
        });
      }
      return {
        status: result.status || 400,
        headers: { "Content-Type": "text/html" },
        body: renderForm({
          paperId,
          errorMessage: result.message,
          selectedIds: reviewerIds,
        }),
      };
    }

    if (result.type === "system_error") {
      if (wantsJson(headers || {})) {
        return json(500, {
          errorCode: result.errorCode,
          message: result.message,
        });
      }
      return {
        status: 500,
        headers: { "Content-Type": "text/html" },
        body: renderForm({
          paperId,
          errorMessage: result.message,
          selectedIds: reviewerIds,
        }),
      };
    }

    if (wantsJson(headers || {})) {
      return json(200, {
        paper_id: result.paperId,
        assignment_count: result.assignmentCount,
        warningCode: result.warningCode,
        warningMessage: result.warningMessage,
      });
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderForm({
        paperId,
        successMessage: "Reviewers assigned successfully.",
        warningMessage: result.warningMessage || "",
      }),
    };
  }

  async function handleGetAssignments({ headers, params } = {}) {
    const auth = requireEditor(headers || {});
    if (!auth.ok) {
      return json(auth.status, { errorCode: auth.errorCode, message: auth.message });
    }

    const paperId = String((params && (params.paper_id || params.paperId)) || "").trim();
    const paper = dataAccess.getPaperById(paperId);
    if (!paper) {
      return json(404, { errorCode: "invalid_paper", message: "Paper not found." });
    }

    return json(200, {
      paper_id: paperId,
      assignments: dataAccess.getAssignmentsByPaperId(paperId),
    });
  }

  return {
    handleGetForm,
    handleGetEligibleReviewers,
    handlePostAssignment,
    handleGetAssignments,
  };
}

module.exports = {
  createAssignmentController,
};
