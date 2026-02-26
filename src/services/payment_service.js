const {
  REGISTRATION_STATUS,
  PAYMENT_TRANSACTION_STATUS,
  normalizePaymentStatus,
} = require("../models/status_codes");
const { createPaymentTransaction } = require("../models/payment_transaction");

const PENDING_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function createPaymentService({ datastoreService, messageService, auditService, loggingService, clock } = {}) {
  if (!datastoreService) {
    throw new Error("datastoreService is required");
  }

  const now = typeof clock === "function" ? clock : () => new Date();
  const audit = auditService;
  const logger = loggingService;

  function isPendingTimeout(registration) {
    if (!registration || registration.status !== REGISTRATION_STATUS.PENDING_CONFIRMATION) {
      return false;
    }
    const updatedAt = Date.parse(String(registration.status_updated_at));
    if (!Number.isFinite(updatedAt)) {
      return false;
    }
    return now().getTime() - updatedAt > PENDING_TIMEOUT_MS;
  }

  function evaluatePendingTimeout(registration) {
    if (!isPendingTimeout(registration)) {
      return registration;
    }

    const updated = datastoreService.updateRegistrationStatus({
      registrationId: registration.registration_id,
      status: REGISTRATION_STATUS.UNPAID,
      reasonCode: "pending_timeout",
      updatedAt: now().toISOString(),
    });

    const latestPayment = datastoreService.getLatestPaymentRecord(registration.registration_id);
    if (audit && typeof audit.logPendingTimeout === "function") {
      audit.logPendingTimeout({
        registrationId: registration.registration_id,
        paymentId: latestPayment ? latestPayment.payment_id : "",
      });
    }

    return updated || registration;
  }

  function getRegistrationSummary({ registrationId } = {}) {
    const registration = datastoreService.getRegistrationById(registrationId);
    if (!registration) {
      return { type: "not_found" };
    }

    return { type: "success", registration: evaluatePendingTimeout(registration) };
  }

  function initiatePayment({ registrationId, actorId } = {}) {
    const registration = datastoreService.getRegistrationById(registrationId);
    if (!registration) {
      return { type: "not_found" };
    }

    const normalized = evaluatePendingTimeout(registration);
    if (normalized.status === REGISTRATION_STATUS.PAID_CONFIRMED) {
      return {
        type: "already_paid",
        registration: normalized,
        latestRecord: datastoreService.getLatestPaymentRecord(registrationId),
      };
    }

    if (normalized.status === REGISTRATION_STATUS.PENDING_CONFIRMATION) {
      return {
        type: "pending",
        registration: normalized,
        latestRecord: datastoreService.getLatestPaymentRecord(registrationId),
      };
    }

    try {
      const gatewayReference = datastoreService.generateGatewayReference();
      const paymentInput = createPaymentTransaction({
        registration_id: registrationId,
        amount: normalized.fee_amount,
        status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
        created_at: now().toISOString(),
        gateway_reference: gatewayReference,
        currency: "USD",
      });

      const result = datastoreService.savePaymentAndRegistration({
        registrationId,
        paymentInput,
        newStatus: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        updatedAt: now().toISOString(),
      });

      if (audit && typeof audit.logPaymentInitiated === "function") {
        audit.logPaymentInitiated({
          registrationId,
          paymentId: result.payment ? result.payment.payment_id : "",
          amount: paymentInput.amount,
          gatewayReference: paymentInput.gateway_reference,
          actorId,
        });
      }

      return {
        type: "initiated",
        registration: result.registration || normalized,
        payment: result.payment,
      };
    } catch (error) {
      if (logger && typeof logger.logPaymentError === "function") {
        logger.logPaymentError({
          registration_id: registrationId,
          error_code: error && error.code,
          reason: "initiation_failed",
        });
      }

      return { type: "service_unavailable" };
    }
  }

  function confirmPayment({ registrationId, gatewayReference, status, actorId } = {}) {
    const normalizedReference = String(gatewayReference || "").trim();
    const normalizedRegistrationId = String(registrationId || "").trim();

    if (!normalizedReference || !normalizedRegistrationId) {
      return { type: "validation_error", error: "missing_parameters" };
    }

    const existing = datastoreService.findPaymentByGatewayReference(normalizedReference);
    if (existing) {
      const registration = datastoreService.getRegistrationById(existing.registration_id);
      if (!registration) {
        return { type: "not_found" };
      }

      let statusInput = status;
      if (!statusInput) {
        statusInput = existing.status;
      }
      if (!statusInput) {
        statusInput = PAYMENT_TRANSACTION_STATUS.SUCCEEDED;
      }
      const paymentStatus = normalizePaymentStatus(statusInput);
      const shouldUpdate =
        existing.status === PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION ||
        existing.status === PAYMENT_TRANSACTION_STATUS.INITIATED;

      if (!shouldUpdate) {
        if (audit && typeof audit.logPaymentDuplicateConfirmation === "function") {
          audit.logPaymentDuplicateConfirmation({
            registrationId: existing.registration_id,
            paymentId: existing.payment_id,
            gatewayReference: existing.gateway_reference,
          });
        }
        return {
          type: "duplicate",
          registration: evaluatePendingTimeout(registration),
        };
      }

      let newRegistrationStatus = REGISTRATION_STATUS.UNPAID;
      let reasonCode = "";

      if (paymentStatus === PAYMENT_TRANSACTION_STATUS.SUCCEEDED) {
        newRegistrationStatus = REGISTRATION_STATUS.PAID_CONFIRMED;
      } else if (paymentStatus === PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION) {
        newRegistrationStatus = REGISTRATION_STATUS.PENDING_CONFIRMATION;
      } else if (paymentStatus === PAYMENT_TRANSACTION_STATUS.DECLINED) {
        reasonCode = "declined";
      } else if (paymentStatus === PAYMENT_TRANSACTION_STATUS.FAILED) {
        reasonCode = "invalid_details";
      }

      const confirmedAt = now().toISOString();
      datastoreService.updatePaymentRecord(existing.payment_id, {
        status: paymentStatus,
        confirmed_at: confirmedAt,
      });
      const updatedRegistration = datastoreService.updateRegistrationStatus({
        registrationId: existing.registration_id,
        status: newRegistrationStatus,
        reasonCode,
        updatedAt: confirmedAt,
      });

      if (newRegistrationStatus === REGISTRATION_STATUS.PAID_CONFIRMED) {
        if (audit && typeof audit.logPaymentConfirmed === "function") {
          audit.logPaymentConfirmed({
            registrationId: existing.registration_id,
            paymentId: existing.payment_id,
            gatewayReference: existing.gateway_reference,
            actorId,
          });
        }
      } else if (audit && typeof audit.logPaymentFailed === "function") {
        audit.logPaymentFailed({
          registrationId: existing.registration_id,
          paymentId: existing.payment_id,
          gatewayReference: existing.gateway_reference,
          reasonCode,
        });
      }

      return {
        type: "processed",
        registration: updatedRegistration || registration,
      };
    }

    const registration = datastoreService.getRegistrationById(normalizedRegistrationId);
    if (!registration) {
      return { type: "not_found" };
    }
    const paymentStatus = normalizePaymentStatus(status || PAYMENT_TRANSACTION_STATUS.SUCCEEDED);
    const confirmedAt = now().toISOString();

    const paymentInput = createPaymentTransaction({
      registration_id: normalizedRegistrationId,
      amount: registration.fee_amount,
      status: paymentStatus,
      created_at: confirmedAt,
      confirmed_at: confirmedAt,
      gateway_reference: normalizedReference,
      currency: "USD",
    });

    let newRegistrationStatus = REGISTRATION_STATUS.UNPAID;
    let reasonCode = "";

    if (paymentStatus === PAYMENT_TRANSACTION_STATUS.SUCCEEDED) {
      newRegistrationStatus = REGISTRATION_STATUS.PAID_CONFIRMED;
    } else if (paymentStatus === PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION) {
      newRegistrationStatus = REGISTRATION_STATUS.PENDING_CONFIRMATION;
    } else if (paymentStatus === PAYMENT_TRANSACTION_STATUS.DECLINED) {
      reasonCode = "declined";
    } else if (paymentStatus === PAYMENT_TRANSACTION_STATUS.FAILED) {
      reasonCode = "invalid_details";
    }

    const result = datastoreService.savePaymentAndRegistration({
      registrationId: normalizedRegistrationId,
      paymentInput,
      newStatus: newRegistrationStatus,
      reasonCode,
      updatedAt: confirmedAt,
    });

    if (newRegistrationStatus === REGISTRATION_STATUS.PAID_CONFIRMED) {
      if (audit && typeof audit.logPaymentConfirmed === "function") {
        audit.logPaymentConfirmed({
          registrationId: normalizedRegistrationId,
          paymentId: result.payment ? result.payment.payment_id : "",
          gatewayReference: normalizedReference,
          actorId,
        });
      }
    } else if (audit && typeof audit.logPaymentFailed === "function") {
      audit.logPaymentFailed({
        registrationId: normalizedRegistrationId,
        paymentId: result.payment ? result.payment.payment_id : "",
        gatewayReference: normalizedReference,
        reasonCode,
      });
    }

    return {
      type: "processed",
      registration: result.registration || registration,
    };
  }

  function getPaymentStatus({ registrationId } = {}) {
    const registration = datastoreService.getRegistrationById(registrationId);
    if (!registration) {
      return { type: "not_found" };
    }

    const normalized = evaluatePendingTimeout(registration);
    return {
      type: "success",
      registration: normalized,
      latestRecord: datastoreService.getLatestPaymentRecord(registrationId),
    };
  }

  function getPaymentRecords({ registrationId } = {}) {
    const registration = datastoreService.getRegistrationById(registrationId);
    if (!registration) {
      return { type: "not_found" };
    }

    evaluatePendingTimeout(registration);
    const records = datastoreService.listPaymentTransactionsByRegistration(registrationId);
    return {
      type: "success",
      registration,
      records,
    };
  }

  return {
    getRegistrationSummary,
    initiatePayment,
    confirmPayment,
    getPaymentStatus,
    getPaymentRecords,
  };
}

module.exports = {
  createPaymentService,
};
