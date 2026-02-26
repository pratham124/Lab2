const SUPPORT_CONTACT = "support@conference.example";

const ERROR_RESPONSES = {
  ticket_generation_failed: {
    code: "ticket_generation_failed",
    message:
      "We couldn't generate your ticket at this time. Please try again later or contact support.",
    retryable: true,
    support_contact: SUPPORT_CONTACT,
  },
  ticket_not_found: {
    code: "ticket_not_found",
    message: "Ticket not found.",
    retryable: false,
    support_contact: SUPPORT_CONTACT,
  },
  ticket_retention_expired: {
    code: "ticket_retention_expired",
    message: "This ticket is no longer available because the retention period has ended.",
    retryable: false,
    support_contact: SUPPORT_CONTACT,
  },
  access_denied: {
    code: "access_denied",
    message: "Access denied.",
    retryable: false,
    support_contact: SUPPORT_CONTACT,
  },
};

const ERROR_STATUS = {
  ticket_generation_failed: 500,
  ticket_not_found: 404,
  ticket_retention_expired: 410,
  access_denied: 403,
};

function buildErrorResponse(code, overrides = {}) {
  const base = ERROR_RESPONSES[code] || {
    code: "error",
    message: "Something went wrong.",
    retryable: true,
    support_contact: SUPPORT_CONTACT,
  };
  return {
    ...base,
    ...overrides,
    code: overrides.code || base.code,
    message: overrides.message || base.message,
    retryable: typeof overrides.retryable === "boolean" ? overrides.retryable : base.retryable,
    support_contact: overrides.support_contact || base.support_contact,
  };
}

module.exports = {
  ERROR_RESPONSES,
  ERROR_STATUS,
  buildErrorResponse,
};
