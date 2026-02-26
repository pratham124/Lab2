function createTicketAuditLog({ logger } = {}) {
  const sink = logger && typeof logger.log === "function" ? logger : console;

  function write(event, details = {}) {
    sink.log(
      JSON.stringify({
        event: String(event).trim(),
        at: new Date().toISOString(),
        ...details,
      })
    );
  }

  function logTicketCreated({ ticketId, attendeeId, paymentReference, invoiceNumber } = {}) {
    write("ticket_created", {
      ticket_id: String(ticketId || "").trim(),
      attendee_id: String(attendeeId || "").trim(),
      payment_reference: String(paymentReference || "").trim(),
      invoice_number: String(invoiceNumber || "").trim(),
    });
  }

  function logDuplicateConfirmation({ ticketId, attendeeId, paymentReference } = {}) {
    write("ticket_confirmation_duplicate", {
      ticket_id: String(ticketId || "").trim(),
      attendee_id: String(attendeeId || "").trim(),
      payment_reference: String(paymentReference || "").trim(),
    });
  }

  function logDeliveryAttempt({ ticketId, recipientEmail, status } = {}) {
    write("ticket_delivery_attempt", {
      ticket_id: String(ticketId || "").trim(),
      recipient_email: String(recipientEmail || "").trim(),
      status: String(status || "").trim(),
    });
  }

  function logDeliveryFailure({ ticketId, recipientEmail, reason } = {}) {
    write("ticket_delivery_failed", {
      ticket_id: String(ticketId || "").trim(),
      recipient_email: String(recipientEmail || "").trim(),
      reason: String(reason || "").trim(),
    });
  }

  function logTicketGenerationFailure({ paymentReference, attendeeId, reason } = {}) {
    write("ticket_generation_failed", {
      payment_reference: String(paymentReference || "").trim(),
      attendee_id: String(attendeeId || "").trim(),
      reason: String(reason || "").trim(),
    });
  }

  function logAccessDenied({ attendeeId, ticketId } = {}) {
    write("ticket_access_denied", {
      attendee_id: String(attendeeId || "").trim(),
      ticket_id: String(ticketId || "").trim(),
    });
  }

  return {
    logTicketCreated,
    logDuplicateConfirmation,
    logDeliveryAttempt,
    logDeliveryFailure,
    logTicketGenerationFailure,
    logAccessDenied,
  };
}

module.exports = {
  createTicketAuditLog,
};
