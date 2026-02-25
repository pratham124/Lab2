const fs = require("fs");
const path = require("path");
const { getSession, wantsJson, json } = require("./controller_utils");
const { buildErrorResponse } = require("../services/error_response");

function read(file) {
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

function createAssignedPapersController({ sessionService, assignmentService } = {}) {
  if (!assignmentService) {
    throw new Error("assignmentService is required");
  }

  const layout = read("layout.html");
  const listTemplate = read("assigned_papers_list.html");
  const viewTemplate = read("assigned_paper_view.html");
  const errorTemplate = read("error_message.html");

  function requireSession(headers = {}) {
    return getSession(headers, sessionService);
  }

  function renderPage({ title, content }) {
    return layout
      .replace("{{title}}", escapeHtml(title))
      .replace("{{styles}}", "")
      .replace("{{scripts}}", "")
      .replace("{{content}}", content);
  }

  function renderList(items = []) {
    const listItems = items
      .map(
        (item) =>
          `<li><a href="/reviewer/assignments/${escapeHtml(item.paperId)}">${escapeHtml(
            item.title
          )}</a></li>`
      )
      .join("\n");

    return listTemplate
      .replace("{{listItems}}", listItems)
      .replace(
        "{{emptyState}}",
        items.length ? "" : '<p class="assigned-papers__empty">No papers are currently assigned.</p>'
      );
  }

  function renderPaperView({ paper } = {}) {
    return viewTemplate
      .replaceAll("{{paperTitle}}", escapeHtml(paper.title))
      .replace("{{paperContent}}", escapeHtml(paper.content))
      .replace("{{backLink}}", "/reviewer/assignments")
      .replace("{{reviewLink}}", `/papers/${escapeHtml(paper.paperId)}/reviews/new`);
  }

  function renderErrorView(errorPayload) {
    return errorTemplate
      .replace("{{errorMessage}}", escapeHtml(errorPayload.message))
      .replace("{{nextStep}}", escapeHtml(errorPayload.nextStep))
      .replace("{{backLink}}", escapeHtml(errorPayload.backLink));
  }

  async function handleList({ headers } = {}) {
    const session = requireSession(headers || {});
    if (!session) {
      if (wantsJson(headers || {})) {
        return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
      }
      return { status: 302, headers: { Location: "/login.html" }, body: "" };
    }

    try {
      const items = assignmentService.listAssignedPapers({ reviewerId: session.user_id });
      if (wantsJson(headers || {})) {
        return json(200, { items });
      }
      return {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Assigned Papers",
          content: renderList(items),
        }),
      };
    } catch (_error) {
      const payload = buildErrorResponse({
        errorCode: "assigned_papers_unavailable",
        message: "Unable to load assigned papers.",
        nextStep: "Please try again later.",
      });
      if (wantsJson(headers || {})) {
        return json(500, payload);
      }
      return {
        status: 500,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Assigned Papers Error",
          content: renderErrorView(payload),
        }),
      };
    }
  }

  async function handleView({ headers, params } = {}) {
    const session = requireSession(headers || {});
    if (!session) {
      if (wantsJson(headers || {})) {
        return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
      }
      return { status: 302, headers: { Location: "/login.html" }, body: "" };
    }

    const paperId = String((params && params.paper_id) || "").trim();
    try {
      const result = assignmentService.getAssignedPaperContent({
        reviewerId: session.user_id,
        paperId,
      });

      if (result.type === "forbidden") {
        const payload = buildErrorResponse({
          errorCode: "access_denied",
          message: "Access denied.",
          nextStep: "Open a paper from your assigned papers list.",
        });
        if (wantsJson(headers || {})) {
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

      if (result.type === "manuscript_unavailable") {
        const payload = buildErrorResponse({
          errorCode: "manuscript_unavailable",
          message: "Manuscript unavailable.",
          nextStep: "Please try again later or contact the conference administrator.",
        });
        if (wantsJson(headers || {})) {
          return json(409, payload);
        }
        return {
          status: 409,
          headers: { "Content-Type": "text/html" },
          body: renderPage({
            title: "Manuscript Unavailable",
            content: renderErrorView(payload),
          }),
        };
      }

      if (wantsJson(headers || {})) {
        return json(200, {
          paperId: result.paperId,
          title: result.title,
          content: result.content,
          reviewInfo: result.reviewInfo,
        });
      }
      return {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Assigned Paper",
          content: renderPaperView({ paper: result }),
        }),
      };
    } catch (_error) {
      const payload = buildErrorResponse({
        errorCode: "paper_retrieval_failed",
        message: "Unable to load assigned papers.",
        nextStep: "Please try again later.",
      });
      if (wantsJson(headers || {})) {
        return json(500, payload);
      }
      return {
        status: 500,
        headers: { "Content-Type": "text/html" },
        body: renderPage({
          title: "Assigned Papers Error",
          content: renderErrorView(payload),
        }),
      };
    }
  }

  async function handleDownloadAttempt({ headers } = {}) {
    if (wantsJson(headers || {})) {
      return json(404, {
        errorCode: "download_not_available",
        message: "Download is not available for assigned papers.",
      });
    }
    return {
      status: 404,
      headers: { "Content-Type": "text/plain" },
      body: "Download is not available.",
    };
  }

  return {
    handleList,
    handleView,
    handleDownloadAttempt,
  };
}

module.exports = {
  createAssignedPapersController,
};
