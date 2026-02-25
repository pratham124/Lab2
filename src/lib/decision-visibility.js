function canViewDecision({ decision, requestingAuthorId, submittingAuthorId } = {}) {
  if (!decision || !decision.published_at) {
    return false;
  }

  return String(requestingAuthorId || "") === String(submittingAuthorId || "");
}

module.exports = {
  canViewDecision,
};
