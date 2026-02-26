function createAuditService({ logger } = {}) {
  const sink = logger && typeof logger.log === "function" ? logger : console;

  function write(event = "payment_audit", details = {}) {
    const scrubbed = { ...details };
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
      if (Object.prototype.hasOwnProperty.call(scrubbed, key)) {
        delete scrubbed[key];
      }
    }
    sink.log(
      JSON.stringify({
        event: String(event).trim(),
        at: new Date().toISOString(),
        ...scrubbed,
      })
    );
  }

  function logPaymentInitiated({ registrationId, paymentId, amount, gatewayReference, actorId, ...extra } = {}) {
    write("payment_initiated", {
      registration_id: String(registrationId || "").trim(),
      payment_id: String(paymentId || "").trim(),
      amount,
      gateway_reference: String(gatewayReference || "").trim(),
      actor_id: String(actorId || "").trim(),
      ...extra,
    });
  }

  function logPaymentConfirmed({ registrationId, paymentId, gatewayReference, actorId } = {}) {
    write("payment_confirmed", {
      registration_id: String(registrationId || "").trim(),
      payment_id: String(paymentId || "").trim(),
      gateway_reference: String(gatewayReference || "").trim(),
      actor_id: String(actorId || "").trim(),
    });
  }

  function logPaymentFailed({ registrationId, paymentId, gatewayReference, reasonCode } = {}) {
    write("payment_failed", {
      registration_id: String(registrationId || "").trim(),
      payment_id: String(paymentId || "").trim(),
      gateway_reference: String(gatewayReference || "").trim(),
      reason_code: String(reasonCode || "").trim(),
    });
  }

  function logPaymentDuplicateConfirmation({ registrationId, paymentId, gatewayReference } = {}) {
    write("payment_confirmation_duplicate", {
      registration_id: String(registrationId || "").trim(),
      payment_id: String(paymentId || "").trim(),
      gateway_reference: String(gatewayReference || "").trim(),
    });
  }

  function logPendingTimeout({ registrationId, paymentId } = {}) {
    write("payment_pending_timeout", {
      registration_id: String(registrationId || "").trim(),
      payment_id: String(paymentId || "").trim(),
    });
  }

  return {
    logPaymentInitiated,
    logPaymentConfirmed,
    logPaymentFailed,
    logPaymentDuplicateConfirmation,
    logPendingTimeout,
  };
}

module.exports = {
  createAuditService,
};
