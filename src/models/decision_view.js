function createDecisionView({ paperId, paperTitle, outcome, recordedAt, final } = {}) {
  return {
    paperId: String(paperId || ""),
    paperTitle: String(paperTitle || ""),
    outcome: String(outcome || ""),
    recordedAt: recordedAt || null,
    final: Boolean(final),
  };
}

module.exports = {
  createDecisionView,
};
