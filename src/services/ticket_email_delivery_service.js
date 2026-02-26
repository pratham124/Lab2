const { normalizeEmail, isValidEmailFormat } = require("./email_utils");

function createTicketEmailDeliveryService({ notifier, deliveryAttemptService, auditLog, clock } = {}) {
  const emailer =
    notifier && typeof notifier.sendEmail === "function"
      ? notifier
      : {
          async sendEmail() {},
        };
  const attempts = deliveryAttemptService;
  const logger = auditLog;
  const now = typeof clock === "function" ? clock : () => new Date();

  async function deliverTicket({ ticket, recipientEmail, ticketLink, channel = "email" } = {}) {
    const resolvedChannel = String(channel || "").trim().toLowerCase() || "email";
    if (resolvedChannel !== "email") {
      return { type: "invalid_channel", status: 400 };
    }

    if (!ticket || !ticket.ticket_id) {
      return { type: "validation_error", status: 400 };
    }

    const normalizedRecipient = normalizeEmail(recipientEmail || "");
    if (!normalizedRecipient || !isValidEmailFormat(normalizedRecipient)) {
      return { type: "validation_error", status: 400 };
    }

    const subject = "Your payment confirmation ticket";
    const linkLine = ticketLink ? `Ticket access: ${ticketLink}` : "";
    const body = [
      "Your payment confirmation ticket has been issued.",
      `Invoice number: ${ticket.invoice_number || ""}`,
      `Payment reference: ${ticket.payment_reference || ""}`,
      linkLine,
      "You can also view the ticket in your CMS account.",
    ]
      .filter(Boolean)
      .join("\n");

    const attemptedAt = now().toISOString();

    try {
      await emailer.sendEmail({
        to: normalizedRecipient,
        subject,
        body,
      });

      const result = attempts
        ? attempts.recordAttempt({
            ticketId: ticket.ticket_id,
            recipientEmail: normalizedRecipient,
            channel: "email",
            status: "delivered",
            attemptedAt,
          })
        : { type: "recorded", attempt: null };

      if (logger && typeof logger.logDeliveryAttempt === "function") {
        logger.logDeliveryAttempt({
          ticketId: ticket.ticket_id,
          recipientEmail: normalizedRecipient,
          status: "delivered",
        });
      }

      return { type: "delivered", status: 200, attempt: result.attempt || null };
    } catch (error) {
      const failureReason = error && error.message ? error.message : "email_delivery_failed";
      const result = attempts
        ? attempts.recordAttempt({
            ticketId: ticket.ticket_id,
            recipientEmail: normalizedRecipient,
            channel: "email",
            status: "failed",
            attemptedAt,
            failureReason,
          })
        : { type: "recorded", attempt: null };

      if (logger && typeof logger.logDeliveryFailure === "function") {
        logger.logDeliveryFailure({
          ticketId: ticket.ticket_id,
          recipientEmail: normalizedRecipient,
          reason: failureReason,
        });
      }

      return {
        type: "failed",
        status: 503,
        attempt: result.attempt || null,
        error: failureReason,
      };
    }
  }

  return {
    deliverTicket,
  };
}

module.exports = {
  createTicketEmailDeliveryService,
};
