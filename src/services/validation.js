const REQUIRED_PENDING_STATUSES = new Set(["invited", "pending", "in_progress"]);

function normalizeOutcome(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "accepted") {
    return "accept";
  }
  if (normalized === "rejected") {
    return "reject";
  }
  if (normalized === "accept" || normalized === "reject") {
    return normalized;
  }
  return null;
}

function isEditorRole(roleValue) {
  const role = String(roleValue || "").trim().toLowerCase();
  return role === "editor";
}

function areRequiredReviewsComplete({ assignments, requiredCount }) {
  const list = Array.isArray(assignments) ? assignments : [];
  const needed = Number.isFinite(Number(requiredCount)) ? Number(requiredCount) : 0;

  const requiredAssignments = list.filter((assignment) => Boolean(assignment && assignment.required));
  const submittedRequired = requiredAssignments.filter(
    (assignment) => String(assignment.status || "").trim().toLowerCase() === "submitted"
  ).length;
  const hasPendingRequired = requiredAssignments.some((assignment) =>
    REQUIRED_PENDING_STATUSES.has(String(assignment.status || "").trim().toLowerCase())
  );

  return submittedRequired >= needed && !hasPendingRequired;
}

module.exports = {
  normalizeOutcome,
  isEditorRole,
  areRequiredReviewsComplete,
};
