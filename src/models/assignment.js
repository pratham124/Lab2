const {
  MAX_REVIEWER_WORKLOAD,
  getReviewerConferenceWorkload,
  isAtOrAboveWorkloadLimit,
} = require("./workload_count");

function normalizeId(value) {
  return String(value || "").trim();
}

function createAssignment({ id, paperId, reviewerId, conferenceId, assignedAt } = {}) {
  return {
    id: normalizeId(id) || `assign_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    paperId: normalizeId(paperId),
    reviewerId: normalizeId(reviewerId),
    conferenceId: normalizeId(conferenceId),
    assignedAt: assignedAt || new Date().toISOString(),
  };
}

async function createAssignmentWithWorkloadGuard({
  conferenceId,
  paperId,
  reviewerId,
  loadAssignments,
  persistAssignment,
  limit = MAX_REVIEWER_WORKLOAD,
} = {}) {
  if (typeof loadAssignments !== "function") {
    throw new Error("loadAssignments is required");
  }
  if (typeof persistAssignment !== "function") {
    throw new Error("persistAssignment is required");
  }

  let firstReadCount;
  try {
    firstReadCount = await getReviewerConferenceWorkload({
      reviewerId,
      conferenceId,
      loadAssignments,
    });
  } catch (error) {
    return {
      type: "verification_error",
      errorCode: "WORKLOAD_VERIFICATION_FAILED",
    };
  }

  if (isAtOrAboveWorkloadLimit(firstReadCount, limit)) {
    return {
      type: "limit_error",
      errorCode: "WORKLOAD_LIMIT_REACHED",
      workloadCount: firstReadCount,
      limit,
    };
  }

  let secondReadCount;
  try {
    secondReadCount = await getReviewerConferenceWorkload({
      reviewerId,
      conferenceId,
      loadAssignments,
    });
  } catch (error) {
    return {
      type: "verification_error",
      errorCode: "WORKLOAD_VERIFICATION_FAILED",
    };
  }

  if (isAtOrAboveWorkloadLimit(secondReadCount, limit)) {
    return {
      type: "concurrency_conflict",
      errorCode: "CONCURRENT_WORKLOAD_CONFLICT",
      workloadCount: secondReadCount,
      limit,
    };
  }

  try {
    const assignment = await persistAssignment({ conferenceId, paperId, reviewerId });
    return {
      type: "success",
      assignment,
      workloadCount: secondReadCount + 1,
      limit,
    };
  } catch (error) {
    if (error && error.code === "workload_conflict") {
      return {
        type: "concurrency_conflict",
        errorCode: "CONCURRENT_WORKLOAD_CONFLICT",
        workloadCount: secondReadCount,
        limit,
      };
    }

    return {
      type: "verification_error",
      errorCode: "WORKLOAD_VERIFICATION_FAILED",
    };
  }
}

module.exports = {
  createAssignment,
  createAssignmentWithWorkloadGuard,
};
