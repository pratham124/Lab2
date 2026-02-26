function createErrorMessage({ message, canRetry } = {}) {
  return {
    message: String(message || "").trim(),
    canRetry: Boolean(canRetry),
  };
}

module.exports = {
  createErrorMessage,
};
