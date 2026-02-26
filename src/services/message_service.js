const { REGISTRATION_STATUS_LABELS, REGISTRATION_STATUS } = require("../models/status_codes");

const ERROR_MESSAGES = {
  invalid_details: {
    message: "Payment details are invalid or incomplete. Please review and try again.",
    canRetry: true,
  },
  declined: {
    message: "Payment was declined. Please try another card or contact your bank.",
    canRetry: true,
  },
  service_unavailable: {
    message: "Online payment is temporarily unavailable. Please try again later.",
    canRetry: true,
  },
  not_eligible_already_paid: {
    message: "This registration is already paid. No further payment is needed.",
    canRetry: false,
  },
  pending_timeout: {
    message: "Payment confirmation timed out. Please retry your payment.",
    canRetry: true,
  },
  auth_required: {
    message: "Please log in to continue.",
    canRetry: false,
  },
  not_found: {
    message: "Registration not found.",
    canRetry: false,
  },
  missing_parameters: {
    message: "Required payment details are missing.",
    canRetry: false,
  },
};

const STATUS_MESSAGES = {
  [REGISTRATION_STATUS.UNPAID]: "Payment has not been completed.",
  [REGISTRATION_STATUS.PENDING_CONFIRMATION]:
    "Payment is pending confirmation from the gateway. Please check back soon.",
  [REGISTRATION_STATUS.PAID_CONFIRMED]: "Payment confirmed. Thank you.",
};

function createMessageService({ labels } = {}) {
  const registrationLabels = {
    ...REGISTRATION_STATUS_LABELS,
    ...(labels && labels.registration ? labels.registration : {}),
  };

  function statusLabelForRegistration(statusCode) {
    return registrationLabels[String(statusCode || REGISTRATION_STATUS.UNPAID).trim()] || "Unknown";
  }

  function statusMessageForRegistration(statusCode, reasonCode) {
    if (reasonCode && ERROR_MESSAGES[reasonCode]) {
      return ERROR_MESSAGES[reasonCode].message;
    }
    return STATUS_MESSAGES[String(statusCode || REGISTRATION_STATUS.UNPAID).trim()] || "";
  }

  function errorForCode(code) {
    const normalized = String(code || "").trim();
    const fallback = {
      message: "Something went wrong. Please try again.",
      canRetry: true,
    };
    const config = ERROR_MESSAGES[normalized] || fallback;
    return {
      message: config.message,
      canRetry: config.canRetry,
      code: normalized || undefined,
    };
  }

  function buildStatusResponse(registration, { reasonCode, message } = {}) {
    if (!registration) {
      return null;
    }
    const statusCode = String(registration.status || REGISTRATION_STATUS.UNPAID).trim();
    const resolvedReason = reasonCode || registration.status_reason || undefined;
    const resolvedMessage = message || statusMessageForRegistration(statusCode, resolvedReason);

    return {
      registrationId: registration.registration_id,
      status_code: statusCode,
      status_label: statusLabelForRegistration(statusCode),
      lastUpdatedAt: registration.status_updated_at,
      reason_code: resolvedReason || undefined,
      message: resolvedMessage || undefined,
    };
  }

  return {
    statusLabelForRegistration,
    statusMessageForRegistration,
    errorForCode,
    buildStatusResponse,
  };
}

module.exports = {
  createMessageService,
};
