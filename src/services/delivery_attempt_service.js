const { createDeliveryAttempt } = require("../models/delivery_attempt");

function createDeliveryAttemptService({ store, clock } = {}) {
  const attemptsById = new Map();
  const attemptsByTicket = new Map();
  const now = typeof clock === "function" ? clock : () => new Date();

  function recordAttempt({
    ticketId,
    recipientEmail,
    channel = "email",
    status,
    failureReason,
    attemptedAt,
  } = {}) {
    const normalizedTicketId = String(ticketId || "").trim();
    const normalizedRecipient = String(recipientEmail || "").trim();
    if (!normalizedTicketId || !normalizedRecipient) {
      return { type: "validation_error", status: 400 };
    }

    const attempt = createDeliveryAttempt({
      ticket_id: normalizedTicketId,
      recipient_email: normalizedRecipient,
      channel,
      status,
      attempted_at: attemptedAt || now().toISOString(),
      failure_reason: failureReason || null,
    });

    if (store && typeof store.recordDeliveryAttempt === "function") {
      try {
        store.recordDeliveryAttempt(attempt);
      } catch (_error) {
        // ignore store write failures
      }
    } else {
      attemptsById.set(attempt.delivery_id, attempt);
      const entries = attemptsByTicket.get(normalizedTicketId) || [];
      entries.push(attempt.delivery_id);
      attemptsByTicket.set(normalizedTicketId, entries);
    }

    return { type: "recorded", status: 200, attempt };
  }

  function listAttemptsByTicketId(ticketId) {
    const normalizedTicketId = String(ticketId || "").trim();
    if (!normalizedTicketId) {
      return [];
    }

    if (store && typeof store.listDeliveryAttemptsByTicketId === "function") {
      return store.listDeliveryAttemptsByTicketId(normalizedTicketId) || [];
    }

    const ids = attemptsByTicket.get(normalizedTicketId) || [];
    return ids.map((id) => attemptsById.get(id)).filter(Boolean);
  }

  return {
    recordAttempt,
    listAttemptsByTicketId,
  };
}

module.exports = {
  createDeliveryAttemptService,
};
