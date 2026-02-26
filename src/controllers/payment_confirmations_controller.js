const path = require("path");
const responseService = require("../services/response_service");
const { wantsJson } = require("./controller_utils");
const { buildErrorResponse } = require("./error_responses");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPaymentConfirmationsController({
  confirmationTicketService,
  response,
  auditLog,
  errorResponseBuilder,
} = {}) {
  if (!confirmationTicketService) {
    throw new Error("confirmationTicketService is required");
  }

  const responses = response || responseService;
  const buildError = errorResponseBuilder || buildErrorResponse;
  const layoutPath = path.join(__dirname, "..", "views", "layout.html");
  const resultPath = path.join(__dirname, "..", "views", "payment_confirmation_result.html");
  const errorPath = path.join(__dirname, "..", "views", "error_generic.html");

  function renderLayout({ title, content } = {}) {
    return responses.renderView({
      templatePath: layoutPath,
      replacements: {
        title: escapeHtml(title || "Payment Confirmation"),
        styles: "",
        scripts: "",
        content,
      },
    });
  }

  function renderResultView({ message, ticketId, invoiceNumber } = {}) {
    return responses.renderView({
      templatePath: resultPath,
      replacements: {
        message: escapeHtml(message || "Payment confirmation received."),
        ticketId: escapeHtml(ticketId || ""),
        invoiceNumber: escapeHtml(invoiceNumber || ""),
      },
    });
  }

  function renderErrorView({ title, message, nextStep, supportContact, backLink } = {}) {
    return responses.renderView({
      templatePath: errorPath,
      replacements: {
        title: escapeHtml(title || "Ticket Error"),
        message: escapeHtml(message || "We could not generate your ticket."),
        nextStep: escapeHtml(nextStep || "Please try again later."),
        supportContact: escapeHtml(supportContact || ""),
        backLink: escapeHtml(backLink || "/"),
      },
    });
  }

  function serializeTicket(ticket, deliveryAttempts) {
    if (!ticket) {
      return null;
    }
    return {
      ticketId: ticket.ticket_id,
      attendeeId: ticket.attendee_id,
      paymentReference: ticket.payment_reference,
      invoiceNumber: ticket.invoice_number,
      amount: ticket.amount,
      registrationStatus: ticket.registration_status,
      issuedAt: ticket.issued_at,
      retentionExpiresAt: ticket.retention_expires_at,
      deliveryAttempts: deliveryAttempts || [],
    };
  }

  async function handleCreate({ headers, body } = {}) {
    const payload = body || {};
    const result = await confirmationTicketService.createTicketFromConfirmation({
      paymentReference: payload.paymentReference || payload.payment_reference,
      attendeeId: payload.attendeeId || payload.attendee_id,
      amount: payload.amount,
      currency: payload.currency,
      paymentStatus: payload.paymentStatus || payload.payment_status,
      confirmedAt: payload.confirmedAt || payload.confirmed_at,
      recipientEmail: payload.recipientEmail || payload.recipient_email || payload.email,
      ticketLink: payload.ticketLink,
    });

    if (result.type === "validation_error") {
      const errorPayload = buildError("ticket_generation_failed", {
        code: "invalid_confirmation",
        message: "Invalid payment confirmation details.",
        retryable: false,
      }) || {};
      if (wantsJson(headers || {})) {
        return responses.json(400, errorPayload);
      }
      const message = errorPayload.message || undefined;
      const supportContact = errorPayload.support_contact || undefined;
      const nextStep = errorPayload.message
        ? "Please verify the payment details and try again."
        : undefined;
      return responses.html(
        400,
        renderLayout({
          title: "Invalid Confirmation",
          content: renderErrorView({
            title: "Invalid Confirmation",
            message,
            nextStep,
            supportContact,
          }),
        })
      );
    }

    if (result.type === "error") {
      const errorPayload = buildError("ticket_generation_failed") || {};
      if (wantsJson(headers || {})) {
        return responses.json(500, errorPayload);
      }
      const message = errorPayload.message || undefined;
      const supportContact = errorPayload.support_contact || undefined;
      const nextStep = errorPayload.message ? "Please retry later or contact support." : undefined;
      return responses.html(
        500,
        renderLayout({
          title: "Ticket Error",
          content: renderErrorView({
            message,
            nextStep,
            supportContact,
          }),
        })
      );
    }

    if (result.type === "duplicate") {
      if (auditLog && typeof auditLog.logDuplicateConfirmation === "function") {
        auditLog.logDuplicateConfirmation({
          ticketId: result.ticket ? result.ticket.ticket_id : "",
          attendeeId: result.ticket ? result.ticket.attendee_id : "",
          paymentReference: result.ticket ? result.ticket.payment_reference : "",
        });
      }

      const deliveryAttempts = result.ticket
        ? confirmationTicketService.listDeliveryAttempts(result.ticket.ticket_id)
        : [];
      const responsePayload = serializeTicket(result.ticket, deliveryAttempts);

      if (wantsJson(headers || {})) {
        return responses.json(200, responsePayload);
      }

      const title = responsePayload ? "Payment Confirmation" : undefined;
      const message = responsePayload
        ? "Payment confirmation already processed. Your ticket remains available."
        : undefined;
      return responses.html(
        200,
        renderLayout({
          title,
          content: renderResultView({
            message,
            ticketId: responsePayload ? responsePayload.ticketId : "",
            invoiceNumber: responsePayload ? responsePayload.invoiceNumber : "",
          }),
        })
      );
    }

    const deliveryAttempts = result.ticket
      ? confirmationTicketService.listDeliveryAttempts(result.ticket.ticket_id)
      : [];
    const responsePayload = serializeTicket(result.ticket, deliveryAttempts);

    if (wantsJson(headers || {})) {
      return responses.json(201, responsePayload);
    }

    const title = responsePayload ? "Payment Confirmation" : undefined;
    const message = responsePayload ? "Your payment confirmation ticket has been issued." : undefined;
    return responses.html(
      201,
      renderLayout({
        title,
        content: renderResultView({
          message,
          ticketId: responsePayload ? responsePayload.ticketId : "",
          invoiceNumber: responsePayload ? responsePayload.invoiceNumber : "",
        }),
      })
    );
  }

  return {
    handleCreate,
  };
}

module.exports = {
  createPaymentConfirmationsController,
};
