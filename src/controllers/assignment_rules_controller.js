const { getSession, json } = require("./controller_utils");

function normalizeReviewerIds(body = {}) {
  if (Array.isArray(body.reviewerIds)) {
    return body.reviewerIds;
  }
  if (Array.isArray(body.reviewer_ids)) {
    return body.reviewer_ids;
  }
  if (typeof body.reviewerIds === "string") {
    return [body.reviewerIds];
  }
  return [];
}

function createAssignmentRulesController({ assignmentRuleValidationService, sessionService } = {}) {
  if (!assignmentRuleValidationService) {
    throw new Error("assignmentRuleValidationService is required");
  }

  function requireRole(headers, allowedRoles) {
    const session = getSession(headers, sessionService);
    if (!session) {
      return { ok: false, status: 401, body: { errorCode: "session_expired", message: "Session expired." } };
    }
    if (!allowedRoles.includes(session.role)) {
      return { ok: false, status: 403, body: { errorCode: "forbidden", message: "Insufficient permissions." } };
    }
    return { ok: true, session };
  }

  async function handlePostReviewerAssignments({ headers, params, body } = {}) {
    const auth = requireRole(headers || {}, ["editor"]);
    if (!auth.ok) {
      return json(auth.status, auth.body);
    }

    const paperId = String((params && (params.paperId || params.paper_id)) || "").trim();
    const reviewerIds = normalizeReviewerIds(body || {});
    const result = await assignmentRuleValidationService.validateAndSave({
      paperId,
      reviewerIds,
      editorId: auth.session.user_id,
    });

    if (result.type === "success") {
      return json(200, {
        paper_id: result.paperId,
        assignment_count: result.assignmentCount,
      });
    }

    if (result.type === "violations") {
      return json(422, {
        violations: result.violations,
      });
    }

    if (result.type === "validation_unavailable") {
      return json(503, {
        message: result.message,
      });
    }

    return json(result.status || 400, {
      errorCode: result.errorCode || "validation_error",
      message: result.message || "Validation error.",
    });
  }

  async function handleGetViolationAuditLogs({ headers } = {}) {
    const auth = requireRole(headers || {}, ["admin"]);
    if (!auth.ok) {
      return json(auth.status, auth.body);
    }

    return json(200, {
      entries: assignmentRuleValidationService.listViolationAuditLogs(),
    });
  }

  return {
    handlePostReviewerAssignments,
    handleGetViolationAuditLogs,
  };
}

module.exports = {
  createAssignmentRulesController,
};
