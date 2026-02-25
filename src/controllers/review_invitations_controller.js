const fs = require("fs");
const path = require("path");
const { json, getSession } = require("./controller_utils");

function toInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return Math.floor(n);
}

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", "views", file), "utf8");
}

function createReviewInvitationsController({
  sessionService,
  reviewInvitationService,
  reviewInvitationActionService,
} = {}) {
  if (!reviewInvitationService) {
    throw new Error("reviewInvitationService is required");
  }
  if (!reviewInvitationActionService) {
    throw new Error("reviewInvitationActionService is required");
  }

  const layout = read("layout.html");
  const page = read("review-invitations.html");

  function requireSession(headers) {
    const session = getSession(headers || {}, sessionService);
    if (!session) {
      return null;
    }
    return session;
  }

  async function handleGetPage({ headers } = {}) {
    const session = requireSession(headers);
    if (!session) {
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    const html = layout
      .replace("{{title}}", "Review Invitations")
      .replace("{{styles}}", '<link rel="stylesheet" href="/css/review-invitations.css" />')
      .replace("{{scripts}}", '<script src="/js/dom.js"></script><script src="/js/review-invitations.js"></script>')
      .replace("{{content}}", page);

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: html,
    };
  }

  async function handleList({ headers, query } = {}) {
    const session = requireSession(headers);
    if (!session) {
      return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
    }

    try {
      const result = reviewInvitationService.listForReviewer({
        reviewerId: session.user_id,
        status: query && query.status ? query.status : "pending",
        page: toInt(query && query.page, 1),
        pageSize: toInt(query && query.page_size, 20),
      });

      return json(200, result);
    } catch (_error) {
      return json(500, {
        errorCode: "invitation_list_unavailable",
        message: "Invitations are unavailable right now. Please retry.",
      });
    }
  }

  async function handleGetDetail({ headers, params } = {}) {
    const session = requireSession(headers);
    if (!session) {
      return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
    }

    const detail = reviewInvitationService.getById({
      reviewerId: session.user_id,
      invitationId: params && params.invitation_id,
    });

    if (!detail) {
      return json(404, { errorCode: "invitation_not_found", message: "Invitation not found." });
    }

    if (detail === "forbidden") {
      return json(403, { errorCode: "forbidden", message: "Not authorized to view this invitation." });
    }

    return json(200, detail);
  }

  async function handleAction({ headers, params } = {}) {
    const session = requireSession(headers);
    if (!session) {
      return json(401, { errorCode: "not_authenticated", message: "Not authenticated." });
    }

    const action = String((params && params.action) || "").trim();
    if (!["accept", "reject"].includes(action)) {
      return json(400, { errorCode: "invalid_action", message: "Action must be accept or reject." });
    }

    try {
      const result = reviewInvitationActionService.respond({
        reviewerId: session.user_id,
        invitationId: params && params.invitation_id,
        action,
      });

      if (result.type === "not_found") {
        return json(404, { errorCode: "invitation_not_found", message: "Invitation not found." });
      }
      if (result.type === "forbidden") {
        return json(403, { errorCode: "forbidden", message: "Not authorized to update this invitation." });
      }
      if (result.type === "conflict") {
        return json(409, { errorCode: "invitation_already_processed", message: result.message });
      }

      return json(200, {
        id: result.invitation.id,
        status: result.invitation.status,
        respondedAt: result.invitation.respondedAt,
      });
    } catch (_error) {
      return json(500, {
        errorCode: "invitation_action_unavailable",
        message: "We could not process your request right now. Please retry.",
      });
    }
  }

  return {
    handleGetPage,
    handleList,
    handleGetDetail,
    handleAction,
  };
}

module.exports = {
  createReviewInvitationsController,
};
