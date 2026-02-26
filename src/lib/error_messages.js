function buildErrorMessage({ category, nextStep, reportIssueAvailable = false, message } = {}) {
  return {
    message:
      String(message || "").trim() || "Schedule details cannot be retrieved at this time.",
    category: String(category || "service_unavailable").trim() || "service_unavailable",
    nextStep:
      String(nextStep || "").trim() || "Retry, check connection, or contact support/admin.",
    reportIssueAvailable: Boolean(reportIssueAvailable),
  };
}

module.exports = {
  buildErrorMessage,
};
