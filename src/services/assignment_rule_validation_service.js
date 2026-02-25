function defaultRulesProvider() {
  return {
    requiredReviewerCount: 3,
    maxReviewerWorkload: 5,
  };
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

function createAssignmentRuleValidationService({
  dataAccess,
  rulesProvider,
  failureLogger,
} = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  const getRules =
    rulesProvider && typeof rulesProvider.getCurrentRules === "function"
      ? () => rulesProvider.getCurrentRules()
      : defaultRulesProvider;

  const logger =
    failureLogger && typeof failureLogger.log === "function"
      ? failureLogger
      : {
          log() {},
        };

  function buildCountViolation({ requiredCount, providedCount }) {
    const delta = requiredCount - providedCount;
    const correctiveAction =
      delta > 0
        ? `Add ${delta} more reviewer${delta === 1 ? "" : "s"} before saving.`
        : `Remove ${Math.abs(delta)} reviewer${Math.abs(delta) === 1 ? "" : "s"} before saving.`;
    return {
      violated_rule_id: "required_reviewer_count",
      rule_name: "Required Reviewer Count",
      violation_message: `Exactly ${requiredCount} reviewers are required.`,
      corrective_action_hint: correctiveAction,
    };
  }

  function buildWorkloadViolation({ reviewerId, limit }) {
    return {
      violated_rule_id: "reviewer_workload_limit",
      rule_name: "Reviewer Workload Limit",
      violation_message: `Reviewer ${reviewerId} has reached workload limit (${limit}) and cannot be assigned.`,
      affected_reviewer_id: reviewerId,
      corrective_action_hint: "Choose a different reviewer with available workload capacity.",
    };
  }

  function recordViolationAuditLogs({ editorId, paperId, violations }) {
    for (const violation of violations) {
      dataAccess.addAssignmentViolationAuditLog({
        editor_id: editorId,
        paper_id: paperId,
        violated_rule_id: violation.violated_rule_id,
        violation_message: violation.violation_message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  function getConferenceAssignments(paper) {
    const conferenceId = String((paper && paper.conferenceId) || "").trim();
    return dataAccess.listAssignmentsByConference(conferenceId);
  }

  async function validateAndSave({ paperId, reviewerIds, editorId } = {}) {
    const normalizedPaperId = String(paperId || "").trim();
    const normalizedReviewerIds = normalizeReviewerIds(reviewerIds);

    const paper = dataAccess.getPaperById(normalizedPaperId);
    if (!paper) {
      return {
        type: "validation_error",
        status: 404,
        errorCode: "invalid_paper",
        message: "Paper not found.",
      };
    }

    let conferenceAssignments;
    try {
      conferenceAssignments = getConferenceAssignments(paper);
    } catch (error) {
      logger.log({
        event: "assignment_validation_unavailable",
        paper_id: normalizedPaperId,
        error_code: error && error.message ? error.message : "UNKNOWN_ERROR",
        at: new Date().toISOString(),
      });
      return {
        type: "validation_unavailable",
        status: 503,
        message: "Validation cannot be completed now and the assignment is not saved.",
      };
    }

    const rules = getRules() || {};
    const requiredReviewerCount = Number(rules.requiredReviewerCount || 3);
    const maxReviewerWorkload = Number(rules.maxReviewerWorkload || 5);
    const violations = [];

    if (normalizedReviewerIds.length !== requiredReviewerCount) {
      violations.push(
        buildCountViolation({
          requiredCount: requiredReviewerCount,
          providedCount: normalizedReviewerIds.length,
        })
      );
    }

    for (const reviewerId of normalizedReviewerIds) {
      const reviewer = dataAccess.getReviewerById(reviewerId);
      if (!reviewer || !reviewer.eligibilityStatus) {
        continue;
      }
      const assignmentCount = conferenceAssignments.filter(
        (assignment) => String(assignment.reviewerId || "").trim() === reviewerId
      ).length;
      if (assignmentCount >= maxReviewerWorkload) {
        violations.push(
          buildWorkloadViolation({
            reviewerId,
            limit: maxReviewerWorkload,
          })
        );
      }
    }

    if (violations.length > 0) {
      recordViolationAuditLogs({
        editorId: String(editorId || "").trim(),
        paperId: normalizedPaperId,
        violations,
      });
      return {
        type: "violations",
        status: 422,
        violations,
      };
    }

    try {
      const assignments = dataAccess.createAssignments({
        paperId: normalizedPaperId,
        reviewerIds: normalizedReviewerIds,
      });
      return {
        type: "success",
        status: 200,
        paperId: normalizedPaperId,
        assignmentCount: assignments.length,
      };
    } catch (error) {
      logger.log({
        event: "assignment_validation_unavailable",
        paper_id: normalizedPaperId,
        error_code: error && error.message ? error.message : "UNKNOWN_ERROR",
        at: new Date().toISOString(),
      });
      return {
        type: "validation_unavailable",
        status: 503,
        message: "Validation cannot be completed now and the assignment is not saved.",
      };
    }
  }

  function listViolationAuditLogs() {
    return dataAccess.listAssignmentViolationAuditLogs();
  }

  return {
    validateAndSave,
    listViolationAuditLogs,
    __test: {
      normalizeReviewerIds,
      defaultRulesProvider,
      buildCountViolation,
      buildWorkloadViolation,
    },
  };
}

module.exports = {
  createAssignmentRuleValidationService,
};
