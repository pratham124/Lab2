function createErrorPayload({ errorCode, summary, affectedItemId, conflicts, recommendedAction } = {}) {
  const payload = {
    errorCode: String(errorCode || "").trim(),
    summary: String(summary || "").trim(),
    affectedItemId: String(affectedItemId || "").trim(),
    recommendedAction: String(recommendedAction || "").trim(),
  };

  if (Array.isArray(conflicts) && conflicts.length > 0) {
    payload.conflicts = conflicts.map((value) => String(value || "").trim()).filter(Boolean);
  }

  return payload;
}

module.exports = {
  createErrorPayload,
};
