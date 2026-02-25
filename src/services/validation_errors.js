const VALIDATION_ERRORS = {
  invalidPaper: {
    code: "invalid_paper",
    message: "Paper not found.",
  },
  alreadyAssigned: {
    code: "already_assigned",
    message: "Reviewers are already assigned for this paper.",
  },
  invalidReviewerCount: {
    code: "invalid_reviewer_count",
    message: "Exactly 3 reviewers are required.",
  },
  insufficientEligibleReviewers: {
    code: "insufficient_eligible_reviewers",
    message: "At least 3 eligible reviewers are required before assignment.",
  },
  duplicateReviewers: {
    code: "duplicate_reviewers",
    message: "Reviewer selection must contain 3 unique reviewers.",
  },
  ineligibleReviewer: {
    code: "ineligible_reviewer",
    message: "One or more selected reviewers are not eligible.",
  },
  reviewerWorkloadExceeded: {
    code: "reviewer_workload_exceeded",
    message: "One or more selected reviewers exceed the maximum workload of 5 papers.",
  },
  workloadLimitReached: {
    code: "WORKLOAD_LIMIT_REACHED",
    message: "This reviewer has reached the maximum workload of 5 assigned papers for this conference.",
  },
  workloadVerificationFailed: {
    code: "WORKLOAD_VERIFICATION_FAILED",
    message: "Reviewer workload cannot be verified at this time. Please try again later.",
  },
  concurrentWorkloadConflict: {
    code: "CONCURRENT_WORKLOAD_CONFLICT",
    message: "Another assignment was completed first and this action would exceed the workload limit of 5.",
  },
  assignmentSaveFailed: {
    code: "assignment_save_failed",
    message: "Could not save reviewer assignments at this time.",
  },
};

function getValidationError(key) {
  return VALIDATION_ERRORS[key] || { code: "validation_error", message: "Validation error." };
}

module.exports = {
  VALIDATION_ERRORS,
  getValidationError,
};
