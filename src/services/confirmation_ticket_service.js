const { createPaymentConfirmation } = require("../models/payment_confirmation");
const { createConfirmationTicket } = require("../models/confirmation_ticket");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value) {
  const timestamp = Date.parse(String(value || "").trim());
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}

function createConfirmationTicketService({
  deliveryService,
  deliveryAttemptService,
  auditLog,
  clock,
  conferenceEndDate,
} = {}) {
  const ticketsById = new Map();
  const ticketsByReference = new Map();
  const ticketsByAttendee = new Map();
  const confirmationsByReference = new Map();
  const invoiceNumbers = new Set();
  const now = typeof clock === "function" ? clock : () => new Date();

  function retentionExpiry() {
    const end = parseDate(conferenceEndDate) || now();
    return new Date(end.getTime() + 90 * MS_PER_DAY).toISOString();
  }

  function generateInvoiceNumber() {
    for (let i = 0; i < 10; i += 1) {
      const candidate = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;
      if (!invoiceNumbers.has(candidate)) {
        invoiceNumbers.add(candidate);
        return candidate;
      }
    }
    return null;
  }

  function storeTicket(ticket) {
    ticketsById.set(ticket.ticket_id, ticket);
    ticketsByReference.set(ticket.payment_reference, ticket.ticket_id);
    const existing = ticketsByAttendee.get(ticket.attendee_id) || [];
    existing.push(ticket.ticket_id);
    ticketsByAttendee.set(ticket.attendee_id, existing);
  }

  function isExpired(ticket) {
    if (!ticket || !ticket.retention_expires_at) {
      return false;
    }
    const expiresAt = Date.parse(String(ticket.retention_expires_at));
    if (!Number.isFinite(expiresAt)) {
      return false;
    }
    return now().getTime() > expiresAt;
  }

  function listTicketsForAttendee({ attendeeId, includeExpired = false } = {}) {
    const normalizedAttendeeId = String(attendeeId || "").trim();
    if (!normalizedAttendeeId) {
      return [];
    }

    const ids = ticketsByAttendee.get(normalizedAttendeeId) || [];
    return ids
      .map((id) => ticketsById.get(id))
      .filter(Boolean)
      .filter((ticket) => (includeExpired ? true : !isExpired(ticket)));
  }

  function getTicketByPaymentReference(paymentReference) {
    const normalizedReference = String(paymentReference || "").trim();
    if (!normalizedReference) {
      return null;
    }

    const ticketId = ticketsByReference.get(normalizedReference);
    return ticketId ? ticketsById.get(ticketId) : null;
  }

  async function createTicketFromConfirmation(input = {}) {
    const paymentReference = String(
      input.payment_reference || input.paymentReference || ""
    ).trim();
    const attendeeId = String(input.attendee_id || input.attendeeId || "").trim();
    const amount = input.amount;
    const currency = input.currency;
    const paymentStatus = String(input.payment_status || input.paymentStatus || "confirmed")
      .trim()
      .toLowerCase();
    const confirmedAt = input.confirmed_at || input.confirmedAt || now().toISOString();

    if (!paymentReference || !attendeeId || amount === null || typeof amount === "undefined") {
      return { type: "validation_error", status: 400 };
    }

    if (paymentStatus && paymentStatus !== "confirmed") {
      return { type: "validation_error", status: 400 };
    }

    const existingTicket = getTicketByPaymentReference(paymentReference);
    if (existingTicket) {
      return { type: "duplicate", status: 200, ticket: existingTicket };
    }

    const confirmation = createPaymentConfirmation({
      payment_reference: paymentReference,
      attendee_id: attendeeId,
      amount,
      currency,
      payment_status: paymentStatus || "confirmed",
      confirmed_at: confirmedAt,
    });

    confirmationsByReference.set(paymentReference, confirmation);

    const invoiceNumber = generateInvoiceNumber();
    if (!invoiceNumber) {
      if (auditLog && typeof auditLog.logTicketGenerationFailure === "function") {
        auditLog.logTicketGenerationFailure({
          paymentReference,
          attendeeId,
          reason: "invoice_generation_failed",
        });
      }
      return { type: "error", status: 500, reason: "invoice_generation_failed" };
    }

    const ticket = createConfirmationTicket({
      attendee_id: attendeeId,
      payment_reference: paymentReference,
      invoice_number: invoiceNumber,
      amount: confirmation.amount,
      registration_status: "Paid",
      issued_at: confirmation.confirmed_at,
      retention_expires_at: retentionExpiry(),
    });

    storeTicket(ticket);

    if (auditLog && typeof auditLog.logTicketCreated === "function") {
      auditLog.logTicketCreated({
        ticketId: ticket.ticket_id,
        attendeeId,
        paymentReference,
        invoiceNumber: ticket.invoice_number,
      });
    }

    let deliveryResult = null;
    if (deliveryService && typeof deliveryService.deliverTicket === "function") {
      deliveryResult = await deliveryService.deliverTicket({
        ticket,
        recipientEmail: input.recipient_email || input.recipientEmail || input.email,
        ticketLink: input.ticketLink || "",
        channel: "email",
      });
    }

    return {
      type: "created",
      status: 201,
      ticket,
      confirmation,
      deliveryResult,
    };
  }

  function getTicketForAttendee({ attendeeId, ticketId } = {}) {
    const normalizedAttendeeId = String(attendeeId || "").trim();
    const normalizedTicketId = String(ticketId || "").trim();

    const ticket = ticketsById.get(normalizedTicketId);
    if (!ticket) {
      return { type: "not_found", status: 404 };
    }

    if (!normalizedAttendeeId || ticket.attendee_id !== normalizedAttendeeId) {
      if (auditLog && typeof auditLog.logAccessDenied === "function") {
        auditLog.logAccessDenied({
          attendeeId: normalizedAttendeeId,
          ticketId: normalizedTicketId,
        });
      }
      return { type: "forbidden", status: 403 };
    }

    if (isExpired(ticket)) {
      return { type: "expired", status: 410, ticket };
    }

    return { type: "success", status: 200, ticket };
  }

  function listDeliveryAttempts(ticketId) {
    if (!deliveryAttemptService || typeof deliveryAttemptService.listAttemptsByTicketId !== "function") {
      return [];
    }
    return deliveryAttemptService.listAttemptsByTicketId(ticketId);
  }

  return {
    createTicketFromConfirmation,
    listTicketsForAttendee,
    getTicketForAttendee,
    getTicketByPaymentReference,
    listDeliveryAttempts,
  };
}

module.exports = {
  createConfirmationTicketService,
};
