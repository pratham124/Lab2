function createReviewer({ id, name, currentAssignmentCount, eligibilityStatus } = {}) {
  return {
    id: String(id || "").trim(),
    name: String(name || "").trim(),
    currentAssignmentCount: Number(currentAssignmentCount || 0),
    eligibilityStatus:
      typeof eligibilityStatus === "boolean" ? eligibilityStatus : String(eligibilityStatus || "").trim() !== "false",
  };
}

module.exports = {
  createReviewer,
};
