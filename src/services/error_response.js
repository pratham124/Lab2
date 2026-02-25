function buildErrorResponse({
  errorCode = "assigned_papers_unavailable",
  message = "Unable to load assigned papers.",
  nextStep = "Please try again later.",
  backLink = "/reviewer/assignments",
} = {}) {
  return {
    errorCode: String(errorCode || "").trim() || "assigned_papers_unavailable",
    message: String(message || "").trim() || "Unable to load assigned papers.",
    nextStep: String(nextStep || "").trim() || "Please try again later.",
    backLink: String(backLink || "").trim() || "/reviewer/assignments",
  };
}

module.exports = {
  buildErrorResponse,
};
