const MAX_REVIEWER_WORKLOAD = 5;

class WorkloadVerificationError extends Error {
  constructor(message = "Unable to verify reviewer workload.") {
    super(message);
    this.name = "WorkloadVerificationError";
    this.code = "WORKLOAD_VERIFICATION_FAILED";
  }
}

function normalizeId(value) {
  return String(value || "").trim();
}

function countAssignmentsForReviewerConference(assignments = [], { reviewerId, conferenceId } = {}) {
  const normalizedReviewerId = normalizeId(reviewerId);
  const normalizedConferenceId = normalizeId(conferenceId);

  return assignments.filter((assignment) => {
    const assignmentReviewerId = normalizeId(assignment.reviewerId || assignment.reviewer_id);
    const assignmentConferenceId = normalizeId(assignment.conferenceId || assignment.conference_id);
    return assignmentReviewerId === normalizedReviewerId && assignmentConferenceId === normalizedConferenceId;
  }).length;
}

async function getReviewerConferenceWorkload({
  reviewerId,
  conferenceId,
  loadAssignments,
} = {}) {
  if (typeof loadAssignments !== "function") {
    throw new WorkloadVerificationError("Workload loader is not configured.");
  }

  let assignments;
  try {
    assignments = await loadAssignments();
  } catch (error) {
    throw new WorkloadVerificationError();
  }

  if (!Array.isArray(assignments)) {
    throw new WorkloadVerificationError();
  }

  return countAssignmentsForReviewerConference(assignments, { reviewerId, conferenceId });
}

function isAtOrAboveWorkloadLimit(count, limit = MAX_REVIEWER_WORKLOAD) {
  return Number(count || 0) >= Number(limit || MAX_REVIEWER_WORKLOAD);
}

module.exports = {
  MAX_REVIEWER_WORKLOAD,
  WorkloadVerificationError,
  countAssignmentsForReviewerConference,
  getReviewerConferenceWorkload,
  isAtOrAboveWorkloadLimit,
};
