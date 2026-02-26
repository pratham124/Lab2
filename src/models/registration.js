const { normalizeRegistrationStatus, REGISTRATION_STATUS } = require("./status_codes");

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

function createRegistration(input = {}) {
  const now = new Date().toISOString();
  const status = normalizeRegistrationStatus(input.status || REGISTRATION_STATUS.UNPAID);
  return {
    registration_id: String(input.registration_id || input.registrationId || "").trim(),
    attendee_id: String(input.attendee_id || input.attendeeId || "").trim(),
    category: String(input.category || "").trim(),
    fee_amount: normalizeAmount(input.fee_amount ?? input.feeAmount),
    status,
    status_reason: String(input.status_reason || input.statusReason || "").trim(),
    status_updated_at: String(input.status_updated_at || input.statusUpdatedAt || now).trim(),
  };
}

function updateRegistrationStatus(registration, { status, reasonCode, updatedAt } = {}) {
  if (!registration) {
    return null;
  }

  const nextStatus = normalizeRegistrationStatus(status || registration.status);
  return {
    ...registration,
    status: nextStatus,
    status_reason: String(reasonCode || "").trim(),
    status_updated_at: String(updatedAt || new Date().toISOString()).trim(),
  };
}

module.exports = {
  createRegistration,
  updateRegistrationStatus,
};
