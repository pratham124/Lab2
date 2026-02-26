const REGISTRATION_STATUS = {
  UNPAID: "unpaid",
  PENDING_CONFIRMATION: "pending_confirmation",
  PAID_CONFIRMED: "paid_confirmed",
};

const PAYMENT_TRANSACTION_STATUS = {
  INITIATED: "initiated",
  PENDING_CONFIRMATION: "pending_confirmation",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  DECLINED: "declined",
};

const REGISTRATION_STATUS_LABELS = {
  [REGISTRATION_STATUS.UNPAID]: "Unpaid",
  [REGISTRATION_STATUS.PENDING_CONFIRMATION]: "Pending Confirmation",
  [REGISTRATION_STATUS.PAID_CONFIRMED]: "Paid/Confirmed",
};

const PAYMENT_STATUS_LABELS = {
  [PAYMENT_TRANSACTION_STATUS.INITIATED]: "Initiated",
  [PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION]: "Pending Confirmation",
  [PAYMENT_TRANSACTION_STATUS.SUCCEEDED]: "Succeeded",
  [PAYMENT_TRANSACTION_STATUS.FAILED]: "Failed",
  [PAYMENT_TRANSACTION_STATUS.DECLINED]: "Declined",
};

function normalizeStatus(value, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || fallback;
}

function normalizeRegistrationStatus(value) {
  const normalized = normalizeStatus(value, REGISTRATION_STATUS.UNPAID);
  if (Object.values(REGISTRATION_STATUS).includes(normalized)) {
    return normalized;
  }
  return REGISTRATION_STATUS.UNPAID;
}

function normalizePaymentStatus(value) {
  const normalized = normalizeStatus(value, PAYMENT_TRANSACTION_STATUS.INITIATED);
  if (Object.values(PAYMENT_TRANSACTION_STATUS).includes(normalized)) {
    return normalized;
  }
  return PAYMENT_TRANSACTION_STATUS.INITIATED;
}

module.exports = {
  REGISTRATION_STATUS,
  PAYMENT_TRANSACTION_STATUS,
  REGISTRATION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  normalizeRegistrationStatus,
  normalizePaymentStatus,
};
