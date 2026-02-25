const { getValidationError } = require("./validation_errors");

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeReviewerIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function createAssignmentService({
  dataAccess,
  notificationService,
  invitationCreationService,
  failureLogger,
} = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const notifier =
    notificationService && typeof notificationService.sendReviewerInvitations === "function"
      ? notificationService
      : {
          async sendReviewerInvitations() {
            return { type: "sent", failures: [] };
          },
        };

  const logger =
    failureLogger && typeof failureLogger.log === "function"
      ? failureLogger
      : {
          log() {},
        };

  const invitationCreator =
    invitationCreationService && typeof invitationCreationService.createForAssignments === "function"
      ? invitationCreationService
      : {
          async createForAssignments() {
            return [];
          },
        };

  function validationFailure(key, status = 400, details = {}) {
    const error = getValidationError(key);
    return {
      type: "validation_error",
      status,
      errorCode: error.code,
      message: error.message,
      ...details,
    };
  }

  function validateSelection({ paperId, reviewerIds } = {}) {
    const normalizedPaperId = String(paperId || "").trim();
    const normalizedReviewerIds = normalizeReviewerIds(reviewerIds);
    const uniqueReviewerIds = unique(normalizedReviewerIds);

    const paper = dataAccess.getPaperById(normalizedPaperId);
    if (!paper) {
      return validationFailure("invalidPaper", 404);
    }

    if (paper.status === "assigned" || dataAccess.getAssignmentsByPaperId(normalizedPaperId).length > 0) {
      return validationFailure("alreadyAssigned", 400);
    }

    const eligibleReviewers = dataAccess.listEligibleReviewers(normalizedPaperId);
    if (eligibleReviewers.length < 3) {
      return validationFailure("insufficientEligibleReviewers", 409);
    }

    if (normalizedReviewerIds.length !== 3) {
      return validationFailure("invalidReviewerCount", 400, {
        requiredCount: 3,
        providedCount: normalizedReviewerIds.length,
      });
    }

    if (uniqueReviewerIds.length !== 3) {
      return validationFailure("duplicateReviewers", 400);
    }

    const reviewers = [];
    for (const reviewerId of uniqueReviewerIds) {
      const reviewer = dataAccess.getReviewerById(reviewerId);
      if (!reviewer || !reviewer.eligibilityStatus) {
        return validationFailure("ineligibleReviewer", 400);
      }

      if (Number(reviewer.currentAssignmentCount || 0) >= 5) {
        return validationFailure("reviewerWorkloadExceeded", 400, {
          reviewerId,
        });
      }

      reviewers.push(reviewer);
    }

    return {
      type: "ok",
      status: 200,
      paper,
      reviewers,
      reviewerIds: uniqueReviewerIds,
    };
  }

  async function assignReviewers({ paperId, reviewerIds } = {}) {
    const validation = validateSelection({ paperId, reviewerIds });
    if (validation.type !== "ok") {
      return validation;
    }

    let assignments;
    try {
      assignments = dataAccess.createAssignments({
        paperId: validation.paper.id,
        reviewerIds: validation.reviewerIds,
      });
    } catch (error) {
      if (error && error.code === "already_assigned") {
        return validationFailure("alreadyAssigned", 400);
      }
      if (error && error.code === "invalid_paper") {
        return validationFailure("invalidPaper", 404);
      }
      logger.log({
        event: "reviewer_assignment_save_failure",
        paper_id: validation.paper.id,
        reviewer_ids: validation.reviewerIds,
        error_code: error && error.message ? error.message : "UNKNOWN_ERROR",
        at: new Date().toISOString(),
      });
      const failure = getValidationError("assignmentSaveFailed");
      return {
        type: "system_error",
        status: 500,
        errorCode: failure.code,
        message: failure.message,
      };
    }

    const notificationResult = await notifier.sendReviewerInvitations({
      paper: validation.paper,
      reviewers: validation.reviewers,
      assignments,
    });

    await invitationCreator.createForAssignments({
      paper: validation.paper,
      assignments,
    });

    const base = {
      type: "success",
      status: 200,
      paperId: validation.paper.id,
      assignmentCount: assignments.length,
      assignments,
    };

    if (notificationResult && notificationResult.type === "partial_failure") {
      return {
        ...base,
        warningCode: notificationResult.warningCode,
        warningMessage: notificationResult.warningMessage,
        invitationFailures: notificationResult.failures,
      };
    }

    return base;
  }

  return {
    validateSelection,
    assignReviewers,
  };
}

module.exports = {
  createAssignmentService,
  __test: {
    normalizeReviewerIds,
    unique,
  },
};
