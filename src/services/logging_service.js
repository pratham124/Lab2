function createLoggingService({ sink } = {}) {
  const logger = sink && typeof sink.log === "function" ? sink : console;

  function redactPaymentPayload(payload = {}) {
    const redacted = { ...payload };
    const sensitiveKeys = [
      "card_number",
      "cardNumber",
      "pan",
      "cvv",
      "cvc",
      "security_code",
      "securityCode",
      "expiry",
      "expiration",
      "exp_month",
      "exp_year",
    ];

    for (const key of sensitiveKeys) {
      if (Object.prototype.hasOwnProperty.call(redacted, key)) {
        delete redacted[key];
      }
    }

    return redacted;
  }

  function write(entry) {
    logger.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry,
      })
    );
  }

  return {
    logSaveFailure({ submission_id, author_id, reason, error_code }) {
      write({
        event: "draft_save_failure",
        submission_id,
        author_id,
        reason: reason || "unknown",
        error_code: error_code || "UNKNOWN_ERROR",
      });
    },

    logUnauthorizedAccess({ submission_id, actor_author_id, owner_author_id, action }) {
      write({
        event: "draft_unauthorized_access",
        submission_id,
        actor_author_id,
        owner_author_id,
        action: action || "unknown",
      });
    },

    logPaymentEvent({ event, details } = {}) {
      write({
        event: event || "payment_event",
        ...redactPaymentPayload(details || {}),
      });
    },

    logPaymentError({ registration_id, reason, error_code } = {}) {
      write({
        event: "payment_error",
        registration_id,
        reason: reason || "unknown",
        error_code: error_code || "UNKNOWN_ERROR",
      });
    },
  };
}

module.exports = {
  createLoggingService,
};
