const crypto = require("crypto");
const { normalizePaymentStatus, PAYMENT_TRANSACTION_STATUS } = require("./status_codes");

function toAmount(value) {
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
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return currency || "USD";
}

function createPaymentTransaction(input = {}) {
  const paymentId = String(input.payment_id || input.paymentId || "").trim() || generateId();
  const registrationId = String(input.registration_id || input.registrationId || "").trim();
  const gatewayReference = String(input.gateway_reference || input.gatewayReference || "").trim();
  const createdAt = String(input.created_at || input.createdAt || new Date().toISOString()).trim();
  const confirmedAt = input.confirmed_at || input.confirmedAt || null;

  return {
    payment_id: paymentId,
    registration_id: registrationId,
    amount: toAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    status: normalizePaymentStatus(input.status || PAYMENT_TRANSACTION_STATUS.INITIATED),
    created_at: createdAt,
    confirmed_at: confirmedAt ? String(confirmedAt).trim() : null,
    gateway_reference: gatewayReference,
  };
}

module.exports = {
  createPaymentTransaction,
};
