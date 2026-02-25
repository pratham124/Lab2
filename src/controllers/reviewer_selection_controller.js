const { getSession, json } = require("./controller_utils");
const {
  MAX_REVIEWER_WORKLOAD,
  getReviewerConferenceWorkload,
} = require("../models/workload_count");
const {
  listSelectableReviewers,
} = require("../models/reviewer");
const {
  renderSelectableReviewerList,
} = require("../views/reviewer_selection_view");

function createReviewerSelectionController({ sessionService, dataAccess } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

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

  async function handleGetSelectableReviewers({ headers, params } = {}) {
    const auth = requireEditor(headers || {});
    if (!auth.ok) {
      return json(auth.status, { code: auth.code, message: auth.message });
    }

    const conferenceId = String((params && (params.conference_id || params.conferenceId)) || "").trim();
    const paperId = String((params && (params.paper_id || params.paperId)) || "").trim();
    const paper = dataAccess.getPaperByConferenceAndId(conferenceId, paperId);
    if (!paper) {
      return json(404, { code: "PAPER_NOT_FOUND", message: "Paper not found." });
    }

    const reviewers = dataAccess.listReviewersByConferenceId(conferenceId);
    let assignmentsForConference;
    try {
      assignmentsForConference = dataAccess.listAssignmentsByConference(conferenceId);
    } catch (error) {
      return json(400, {
        code: "WORKLOAD_VERIFICATION_FAILED",
        message: "Reviewer workload cannot be verified at this time. Please try again later.",
      });
    }
    const workloadCounts = {};

    for (const reviewer of reviewers) {
      const reviewerId = String((reviewer && reviewer.id) || "").trim();
      try {
        workloadCounts[reviewerId] = await getReviewerConferenceWorkload({
          reviewerId,
          conferenceId,
          loadAssignments: async () => assignmentsForConference,
        });
      } catch (error) {
        return json(400, {
          code: "WORKLOAD_VERIFICATION_FAILED",
          message: "Reviewer workload cannot be verified at this time. Please try again later.",
        });
      }
    }

    const selectable = listSelectableReviewers({
      reviewers,
      workloadCountsByReviewerId: workloadCounts,
      limit: MAX_REVIEWER_WORKLOAD,
    });

    return json(200, renderSelectableReviewerList(selectable));
  }

  return {
    handleGetSelectableReviewers,
  };
}

module.exports = {
  createReviewerSelectionController,
};
