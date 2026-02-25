function createWorkloadLoggingController({ logger } = {}) {
  const output = logger && typeof logger.error === "function" ? logger : console;

  function logVerificationFailure({ conferenceId, paperId, reviewerId, reason } = {}) {
    const entry = {
      event: "workload_verification_failure",
      conference_id: String(conferenceId || "").trim(),
      paper_id: String(paperId || "").trim(),
      reviewer_id: String(reviewerId || "").trim(),
      reason: String(reason || "WORKLOAD_VERIFICATION_FAILED"),
      at: new Date().toISOString(),
    };
    output.error(entry);
    return entry;
  }

  return {
    logVerificationFailure,
  };
}

module.exports = {
  createWorkloadLoggingController,
};
