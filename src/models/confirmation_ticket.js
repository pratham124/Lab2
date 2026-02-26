const crypto = require("crypto");

function normalizeAmount(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return amount;
}

function generateId() {
  if (typeof crypto.randomUUID === "function") {
    return `ticket_${crypto.randomUUID()}`;
  }
  return `ticket_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function createConfirmationTicket(input = {}) {
  const ticketId = String(input.ticket_id || input.ticketId || "").trim() || generateId();
  const attendeeId = String(input.attendee_id || input.attendeeId || "").trim();
  const paymentReference = String(input.payment_reference || input.paymentReference || "").trim();
  const invoiceNumber = String(input.invoice_number || input.invoiceNumber || "").trim();
  const issuedAt = String(input.issued_at || input.issuedAt || new Date().toISOString()).trim();
  const retentionExpiresAt = String(
    input.retention_expires_at || input.retentionExpiresAt || ""
  ).trim();

  return {
    ticket_id: ticketId,
    attendee_id: attendeeId,
    payment_reference: paymentReference,
    invoice_number: invoiceNumber,
    amount: normalizeAmount(input.amount),
    registration_status: String(input.registration_status || input.registrationStatus || "Paid").trim() || "Paid",
    issued_at: issuedAt,
    retention_expires_at: retentionExpiresAt || null,
  };
}

module.exports = {
  createConfirmationTicket,
};
