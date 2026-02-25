const { getSession, json } = require("./controller_utils");
const {
  createAssignmentWithWorkloadGuard,
} = require("../models/assignment");
const {
  workloadLimitMessage,
  workloadVerificationMessage,
  concurrencyConflictMessage,
  successPayload,
} = require("../views/reviewer_assignment_view");

function getReviewerId(body = {}) {
  if (typeof body.reviewer_id === "string") {
    return body.reviewer_id;
  }
  if (typeof body.reviewerId === "string") {
    return body.reviewerId;
  }
  return "";
}

function createReviewerAssignmentController({ sessionService, dataAccess, workloadLogger } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const logger =
    workloadLogger && typeof workloadLogger.logVerificationFailure === "function"
      ? workloadLogger
      : { logVerificationFailure() {} };

  function requireEditor(headers) {
    const session = getSession(headers, sessionService);
    if (!session) {
      return { ok: false, status: 401, code: "NOT_AUTHENTICATED", message: "Not authenticated." };
    }
    if (session.role !== "editor") {
      return { ok: false, status: 403, code: "FORBIDDEN_NOT_EDITOR", message: "Editor role is required." };
    }
    return { ok: true, session };
  }

  async function handlePostAssignment({ headers, params, body } = {}) {
    const auth = requireEditor(headers || {});
    if (!auth.ok) {
      return json(auth.status, { code: auth.code, message: auth.message });
    }

    const conferenceId = String((params && (params.conference_id || params.conferenceId)) || "").trim();
    const paperId = String((params && (params.paper_id || params.paperId)) || "").trim();
    const reviewerId = String(getReviewerId(body || "")).trim();

    const paper = dataAccess.getPaperByConferenceAndId(conferenceId, paperId);
    if (!paper) {
      return json(404, { code: "PAPER_NOT_FOUND", message: "Paper not found." });
    }

    const reviewer = dataAccess.getReviewerById(reviewerId);
    if (!reviewer) {
      return json(400, { code: "INVALID_REVIEWER", message: "Reviewer is invalid." });
    }

    const result = await createAssignmentWithWorkloadGuard({
      conferenceId,
      paperId,
      reviewerId,
      loadAssignments: () => dataAccess.listAssignmentsByConference(conferenceId),
      persistAssignment: (input) => dataAccess.createSingleAssignment(input),
    });

    if (result.type === "verification_error") {
      logger.logVerificationFailure({
        conferenceId,
        paperId,
        reviewerId,
        reason: result.errorCode,
      });
      return json(400, {
        code: "WORKLOAD_VERIFICATION_FAILED",
        message: workloadVerificationMessage(),
      });
    }

    if (result.type === "limit_error") {
      return json(400, {
        code: "WORKLOAD_LIMIT_REACHED",
        message: workloadLimitMessage(result.limit),
      });
    }

    if (result.type === "concurrency_conflict") {
      return json(409, {
        code: "CONCURRENT_WORKLOAD_CONFLICT",
        message: concurrencyConflictMessage(result.limit),
      });
    }

    return json(201, successPayload(result.assignment));
  }

  return {
    handlePostAssignment,
  };
}

module.exports = {
  createReviewerAssignmentController,
};
