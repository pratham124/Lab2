const { normalizeOutcome } = require("../services/validation");

function createDecision({ id, paperId, outcome, recordedAt, final, notificationStatus } = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  if (!paperId || !normalizedOutcome) {
    throw new Error("invalid_decision");
  }

  return {
    id: String(id || `decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    paperId: String(paperId),
    outcome: normalizedOutcome,
    recordedAt: recordedAt || new Date().toISOString(),
    final: final !== false,
    notificationStatus: notificationStatus || "failed",
  };
}

module.exports = {
  createDecision,
};
