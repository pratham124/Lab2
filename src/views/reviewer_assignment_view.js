const {
  MAX_REVIEWER_WORKLOAD,
} = require("../models/workload_count");

function workloadLimitMessage(limit = MAX_REVIEWER_WORKLOAD) {
  return `This reviewer has reached the maximum workload of ${limit} assigned papers for this conference.`;
}

function workloadVerificationMessage() {
  return "Reviewer workload cannot be verified at this time. Please try again later.";
}

function concurrencyConflictMessage(limit = MAX_REVIEWER_WORKLOAD) {
  return `Another assignment was completed first and this action would exceed the workload limit of ${limit}.`;
}

function successPayload(assignment) {
  return {
    assignment_id: String((assignment && assignment.id) || "").trim(),
    reviewer_id: String((assignment && assignment.reviewerId) || "").trim(),
    paper_id: String((assignment && assignment.paperId) || "").trim(),
    conference_id: String((assignment && assignment.conferenceId) || "").trim(),
    assigned_at: assignment && assignment.assignedAt ? assignment.assignedAt : new Date().toISOString(),
  };
}

module.exports = {
  workloadLimitMessage,
  workloadVerificationMessage,
  concurrencyConflictMessage,
  successPayload,
};
