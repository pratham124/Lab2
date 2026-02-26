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

function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return currency || "USD";
}

function createPaymentConfirmation(input = {}) {
  const paymentReference = String(
    input.payment_reference || input.paymentReference || ""
  ).trim();
  const attendeeId = String(input.attendee_id || input.attendeeId || "").trim();
  const confirmedAt = String(
    input.confirmed_at || input.confirmedAt || new Date().toISOString()
  ).trim();

  return {
    payment_reference: paymentReference,
    attendee_id: attendeeId,
    amount: normalizeAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    payment_status: String(input.payment_status || input.paymentStatus || "confirmed").trim() ||
      "confirmed",
    confirmed_at: confirmedAt,
  };
}

module.exports = {
  createPaymentConfirmation,
};
