const crypto = require("crypto");

const DELIVERY_STATUS = new Set(["delivered", "failed"]);

function generateId() {
  if (typeof crypto.randomUUID === "function") {
    return `delivery_${crypto.randomUUID()}`;
  }
  return `delivery_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (DELIVERY_STATUS.has(status)) {
    return status;
  }
  return "delivered";
}

function createDeliveryAttempt(input = {}) {
  return {
    delivery_id: String(input.delivery_id || input.deliveryId || "").trim() || generateId(),
    ticket_id: String(input.ticket_id || input.ticketId || "").trim(),
    recipient_email: String(input.recipient_email || input.recipientEmail || "").trim(),
    channel: String(input.channel || "email").trim().toLowerCase() || "email",
    status: normalizeStatus(input.status),
    attempted_at: String(input.attempted_at || input.attemptedAt || new Date().toISOString()).trim(),
    failure_reason: input.failure_reason || input.failureReason || null,
  };
}

module.exports = {
  createDeliveryAttempt,
};
