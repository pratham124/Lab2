function buildErrorResponse({ message, nextStep, returnTo, errorId } = {}) {
  const payload = {
    message: String(message || "Unable to load completed reviews.").trim() ||
      "Unable to load completed reviews.",
    nextStep: String(nextStep || "Please try again later.").trim() || "Please try again later.",
    returnTo: String(returnTo || "/papers").trim() || "/papers",
  };

  const normalizedErrorId = String(errorId || "").trim();
  if (normalizedErrorId) {
    payload.errorId = normalizedErrorId;
  }

  return payload;
}

module.exports = {
  buildErrorResponse,
};
