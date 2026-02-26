const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REGISTRATION_STATUS,
  PAYMENT_TRANSACTION_STATUS,
  REGISTRATION_STATUS_LABELS,
  normalizeRegistrationStatus,
  normalizePaymentStatus,
} = require("../../src/models/status_codes");
const { createRegistration, updateRegistrationStatus } = require("../../src/models/registration");
const { createPaymentTransaction } = require("../../src/models/payment_transaction");
const { createMessageService } = require("../../src/services/message_service");
const { createAuthGuard } = require("../../src/controllers/auth_guard");
const { createLoggingService } = require("../../src/services/logging_service");
const { createAuditService } = require("../../src/services/audit_service");
const { createDatastoreService } = require("../../src/services/datastore_service");
const { createPaymentService } = require("../../src/services/payment_service");

function makeRegistration(overrides = {}) {
  return createRegistration({
    registration_id: "R1",
    attendee_id: "T1",
    category: "Regular",
    fee_amount: 200,
    status: REGISTRATION_STATUS.UNPAID,
    status_updated_at: "2026-02-01T10:00:00.000Z",
    ...overrides,
  });
}

test("status codes normalize and labels", () => {
  assert.equal(normalizeRegistrationStatus("paid_confirmed"), REGISTRATION_STATUS.PAID_CONFIRMED);
  assert.equal(normalizeRegistrationStatus("INVALID"), REGISTRATION_STATUS.UNPAID);
  assert.equal(normalizePaymentStatus("declined"), PAYMENT_TRANSACTION_STATUS.DECLINED);
  assert.equal(normalizePaymentStatus("bad"), PAYMENT_TRANSACTION_STATUS.INITIATED);
  assert.equal(normalizePaymentStatus(""), PAYMENT_TRANSACTION_STATUS.INITIATED);
  assert.equal(REGISTRATION_STATUS_LABELS[REGISTRATION_STATUS.PAID_CONFIRMED], "Paid/Confirmed");
});

test("registration model create/update", () => {
  const registration = createRegistration({ registration_id: "R1", fee_amount: "200" });
  assert.equal(registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(registration.fee_amount, 200);

  const emptyAmount = createRegistration({ registration_id: "R2", fee_amount: "" });
  assert.equal(emptyAmount.fee_amount, null);
  const badAmount = createRegistration({ registration_id: "R3", fee_amount: "nope" });
  assert.equal(badAmount.fee_amount, null);
  const alias = createRegistration({ registrationId: "R4", feeAmount: 150, status: "paid_confirmed" });
  assert.equal(alias.registration_id, "R4");
  assert.equal(alias.fee_amount, 150);
  const alias2 = createRegistration({ attendeeId: "T9", category: "VIP" });
  assert.equal(alias2.attendee_id, "T9");
  assert.equal(alias2.category, "VIP");
  const alias3 = createRegistration({ registration_id: "", registrationId: "R5" });
  assert.equal(alias3.registration_id, "R5");

  const updated = updateRegistrationStatus(registration, {
    status: "paid_confirmed",
    reasonCode: "done",
    updatedAt: "2026-02-02T00:00:00.000Z",
  });
  assert.equal(updated.status, REGISTRATION_STATUS.PAID_CONFIRMED);
  assert.equal(updated.status_reason, "done");

  assert.equal(updateRegistrationStatus(null, { status: "unpaid" }), null);
  const updatedDefault = updateRegistrationStatus(registration, { status: "unpaid" });
  assert.equal(Boolean(updatedDefault.status_updated_at), true);
  const updatedSame = updateRegistrationStatus(registration, {});
  assert.equal(updatedSame.status, REGISTRATION_STATUS.UNPAID);
});

test("payment transaction model handles amount, currency, and ids", () => {
  const payment = createPaymentTransaction({ amount: "200", gateway_reference: "gw_1" });
  assert.equal(payment.amount, 200);
  assert.equal(payment.currency, "USD");
  assert.equal(payment.gateway_reference, "gw_1");
  assert.equal(Boolean(payment.payment_id), true);

  const invalid = createPaymentTransaction({ amount: -5, currency: "usd" });
  assert.equal(invalid.amount, null);
  assert.equal(invalid.currency, "USD");
});

test("payment transaction generateId fallback branch", () => {
  const crypto = require("crypto");
  const original = crypto.randomUUID;
  crypto.randomUUID = undefined;
  const payment = createPaymentTransaction({ amount: 10 });
  assert.equal(Boolean(payment.payment_id), true);
  crypto.randomUUID = original;
});

test("message service error and status responses", () => {
  const messages = createMessageService({ labels: { registration: { unpaid: "Custom Unpaid" } } });
  assert.equal(messages.statusLabelForRegistration("unknown"), "Unknown");
  assert.equal(messages.statusLabelForRegistration("unpaid"), "Custom Unpaid");
  const statusMessage = messages.statusMessageForRegistration(
    REGISTRATION_STATUS.UNPAID,
    "invalid_details"
  );
  assert.equal(statusMessage.includes("invalid"), true);

  const error = messages.errorForCode("declined");
  assert.equal(error.code, "declined");
  assert.equal(error.canRetry, true);

  const fallback = messages.errorForCode("unknown_error");
  assert.equal(fallback.message.includes("Something"), true);
  const undefinedCode = messages.errorForCode();
  assert.equal(typeof undefinedCode.code, "undefined");

  const registration = makeRegistration();
  const response = messages.buildStatusResponse(registration, { reasonCode: "pending_timeout" });
  assert.equal(response.reason_code, "pending_timeout");
  assert.equal(messages.buildStatusResponse(null), null);
  const override = messages.buildStatusResponse(registration, { message: "Override" });
  assert.equal(override.message, "Override");
  assert.equal(messages.statusLabelForRegistration(), "Custom Unpaid");
  const defaultStatusMessage = messages.statusMessageForRegistration();
  assert.equal(defaultStatusMessage.includes("Payment has not been completed"), true);
  assert.equal(messages.statusMessageForRegistration("unknown_status"), "");
  const defaultMessage = messages.statusMessageForRegistration("paid_confirmed");
  assert.equal(defaultMessage.includes("Payment confirmed"), true);
  const explicitUnknownReason = messages.statusMessageForRegistration("paid_confirmed", "no_such_reason");
  assert.equal(explicitUnknownReason.includes("Payment confirmed"), true);
  const unknownStatusResponse = messages.buildStatusResponse({ registration_id: "R1" }, {});
  assert.equal(unknownStatusResponse.status_code, "unpaid");
  assert.equal(typeof unknownStatusResponse.message, "string");
  const emptyReason = messages.buildStatusResponse(registration, { reasonCode: "" });
  assert.equal(typeof emptyReason.message, "string");
  assert.equal(typeof unknownStatusResponse.reason_code, "undefined");
  const unknownStatusResponse2 = messages.buildStatusResponse({ registration_id: "R1", status: "mystery" }, {});
  assert.equal(typeof unknownStatusResponse2.message, "undefined");
  assert.equal(unknownStatusResponse2.status_label, "Unknown");
});

test("auth guard blocks when missing actor", () => {
  const guard = createAuthGuard({
    authService: { resolveActor() { return null; } },
    messageService: createMessageService(),
  });
  const result = guard.requireAttendee({});
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 401);
});

test("auth guard allows when actor present", () => {
  const guard = createAuthGuard({
    authService: { resolveActor() { return { id: "A1" }; } },
    messageService: createMessageService(),
  });
  const result = guard.requireAttendee({});
  assert.equal(result.ok, true);
  assert.equal(result.actor.id, "A1");
});

test("auth guard defaults when no dependencies provided", () => {
  const guard = createAuthGuard();
  const result = guard.requireAttendee({});
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 401);
});

test("logging service redacts sensitive payment fields", () => {
  const entries = [];
  const logger = { log(entry) { entries.push(entry); } };
  const loggingService = createLoggingService({ sink: logger });

  loggingService.logPaymentEvent({
    event: "payment_event",
    details: { card_number: "4111", cvv: "123", other: "ok" },
  });

  const payload = JSON.parse(entries[0]);
  assert.equal(typeof payload.card_number, "undefined");
  assert.equal(typeof payload.cvv, "undefined");
  assert.equal(payload.other, "ok");

  loggingService.logPaymentEvent({ details: {} });
  loggingService.logPaymentEvent({});
  loggingService.logPaymentError({ registration_id: "R1", reason: "fail" });
  loggingService.logPaymentError({ registration_id: "R2" });
  const eventPayload = JSON.parse(entries[1]);
  assert.equal(eventPayload.event, "payment_event");
  const eventPayload2 = JSON.parse(entries[2]);
  assert.equal(eventPayload2.event, "payment_event");
  const errorPayload = JSON.parse(entries[3]);
  assert.equal(errorPayload.event, "payment_error");
  const errorPayload2 = JSON.parse(entries[4]);
  assert.equal(errorPayload2.reason, "unknown");
  assert.equal(errorPayload2.error_code, "UNKNOWN_ERROR");
});

test("logging service default sink does not throw", () => {
  const loggingService = createLoggingService();
  loggingService.logPaymentEvent({ details: { card_number: "4111" } });
});

test("audit service writes expected event names", () => {
  const entries = [];
  const logger = { log(entry) { entries.push(entry); } };
  const audit = createAuditService({ logger });
  audit.logPaymentInitiated({ registrationId: "R1", card_number: "4111", cvv: "123" });
  audit.logPaymentConfirmed({ registrationId: "R1" });
  audit.logPaymentFailed({ registrationId: "R1", reasonCode: "declined" });
  audit.logPaymentDuplicateConfirmation({ registrationId: "R1" });
  audit.logPendingTimeout({ registrationId: "R1" });

  const events = entries.map((entry) => JSON.parse(entry).event);
  assert.deepEqual(events, [
    "payment_initiated",
    "payment_confirmed",
    "payment_failed",
    "payment_confirmation_duplicate",
    "payment_pending_timeout",
  ]);
  const firstEntry = JSON.parse(entries[0]);
  assert.equal(typeof firstEntry.card_number, "undefined");
  assert.equal(typeof firstEntry.cvv, "undefined");
});

test("audit service default logger does not throw", () => {
  const original = console.log;
  console.log = () => {};
  try {
    const audit = createAuditService();
    audit.logPaymentInitiated({ registrationId: "R1" });
  } finally {
    console.log = original;
  }
});

test("audit service accepts warn-capable logger", () => {
  const entries = [];
  const audit = createAuditService({ logger: { log(entry) { entries.push(entry); } } });
  audit.logPaymentInitiated({ registrationId: "R1" });
  assert.equal(entries.length, 1);
});

test("audit service falls back to console when logger lacks log", () => {
  const entries = [];
  const original = console.log;
  console.log = (value) => entries.push(value);
  const audit = createAuditService({ logger: {} });
  audit.logPaymentInitiated({ registrationId: "R1" });
  console.log = original;
  assert.equal(entries.length, 1);
});

test("audit service logs default fields when args missing", () => {
  const entries = [];
  const audit = createAuditService({ logger: { log(entry) { entries.push(JSON.parse(entry)); } } });
  audit.logPaymentInitiated();
  audit.logPaymentConfirmed();
  audit.logPaymentFailed();
  audit.logPaymentDuplicateConfirmation();
  audit.logPendingTimeout();
  assert.equal(entries.length, 5);
  assert.equal(entries[0].registration_id, "");
});

test("datastore service creates, updates, and enforces gateway uniqueness", () => {
  const datastore = createDatastoreService();
  const registration = makeRegistration();
  datastore.saveRegistration(registration);

  const payment = datastore.createPaymentRecord(
    createPaymentTransaction({
      registration_id: registration.registration_id,
      amount: 200,
      created_at: "2026-02-01T10:00:00.000Z",
      gateway_reference: "gw_unique",
    })
  );
  assert.equal(payment.gateway_reference, "gw_unique");

  assert.equal(datastore.ensureGatewayReferenceUnique("gw_unique").ok, false);

  assert.throws(() => {
    datastore.createPaymentRecord(
      createPaymentTransaction({
        registration_id: registration.registration_id,
        amount: 200,
        gateway_reference: "gw_unique",
      })
    );
  });

  const updated = datastore.updatePaymentRecord(payment.payment_id, { status: "succeeded" });
  assert.equal(updated.status, "succeeded");

  const missing = datastore.updatePaymentRecord("missing", { status: "succeeded" });
  assert.equal(missing, null);

  const latest = datastore.getLatestPaymentRecord(registration.registration_id);
  assert.equal(latest.gateway_reference, "gw_unique");
  assert.equal(datastore.ensureGatewayReferenceUnique("").ok, true);
  assert.equal(datastore.updateRegistrationStatus({ registrationId: "missing", status: "paid_confirmed" }), null);
  assert.equal(datastore.listPaymentTransactionsByRegistration("").length, 0);
  assert.equal(datastore.findPaymentByGatewayReference(""), null);
});

test("datastore rejects empty ids and registrations", () => {
  const datastore = createDatastoreService();
  assert.equal(datastore.getRegistrationById(""), null);
  assert.equal(datastore.saveRegistration(null), null);
});

test("datastore service generateGatewayReference fallback", () => {
  const crypto = require("crypto");
  const original = crypto.randomUUID;
  crypto.randomUUID = undefined;
  const datastore = createDatastoreService();
  const ref = datastore.generateGatewayReference();
  assert.equal(ref.startsWith("gw_"), true);
  crypto.randomUUID = original;
});

test("datastore savePaymentAndRegistration propagates payment record errors", () => {
  const datastore = createDatastoreService();
  datastore.createPaymentRecord(
    createPaymentTransaction({ registration_id: "R1", gateway_reference: "gw_dup" })
  );

  assert.throws(() => {
    datastore.savePaymentAndRegistration({
      registrationId: "R1",
      paymentInput: createPaymentTransaction({ registration_id: "R1", gateway_reference: "gw_dup" }),
    });
  });
});

test("datastore savePaymentAndRegistration handles store failure branch", () => {
  const warnings = [];
  const store = {
    createPaymentTransaction(payment) {
      return payment;
    },
    updateRegistrationStatus() {
      throw new Error("update_failed");
    },
  };
  const datastore = createDatastoreService({
    store,
    logger: { warn(entry) { warnings.push(entry); } },
  });

  const result = datastore.savePaymentAndRegistration({
    registrationId: "R1",
    paymentInput: createPaymentTransaction({
      registration_id: "R1",
      amount: 200,
      gateway_reference: "gw_store",
    }),
    newStatus: REGISTRATION_STATUS.PENDING_CONFIRMATION,
    updatedAt: "2026-02-01T10:00:00.000Z",
  });

  assert.equal(Boolean(result.payment), true);
  assert.equal(Boolean(warnings.length), true);
});

test("datastore service supports store-backed lookups", () => {
  const store = {
    getRegistrationById(id) {
      if (id === "R1") {
        return { registration_id: "R1", attendee_id: "T1", fee_amount: 200, status: "unpaid" };
      }
      return null;
    },
    findPaymentByGatewayReference(ref) {
      if (ref === "gw_store") {
        return createPaymentTransaction({ registration_id: "R1", gateway_reference: ref });
      }
      return null;
    },
    listPaymentTransactionsByRegistration(registrationId) {
      if (registrationId === "R1") {
        return [{ registration_id: "R1", gateway_reference: "gw_store", amount: 200 }];
      }
      return [];
    },
    updateRegistrationStatus({ registrationId, status }) {
      if (registrationId === "R1") {
        return { registration_id: "R1", status };
      }
      return null;
    },
    createPaymentTransaction(payment) {
      return { ...payment, saved: true };
    },
    updatePaymentTransaction(_id, updates) {
      return { registration_id: "R1", gateway_reference: "gw_store", ...updates };
    },
    saveRegistration(registration) {
      return registration;
    },
    savePaymentAndRegistration(payload) {
      return { payment: payload.paymentInput, registration: makeRegistration({ registration_id: payload.registrationId }) };
    },
  };
  const datastore = createDatastoreService({ store });
  const registration = datastore.getRegistrationById("R1");
  assert.equal(registration.registration_id, "R1");
  assert.equal(datastore.findPaymentByGatewayReference("gw_store").gateway_reference, "gw_store");
  assert.equal(datastore.ensureGatewayReferenceUnique("gw_store").ok, false);
  assert.equal(datastore.listPaymentTransactionsByRegistration("R1").length, 1);
  assert.equal(datastore.updateRegistrationStatus({ registrationId: "R1", status: "paid_confirmed" }).status, "paid_confirmed");
  assert.equal(datastore.createPaymentRecord(createPaymentTransaction({ registration_id: "R1" })).registration_id, "R1");
  assert.equal(datastore.updatePaymentRecord("id", { status: "succeeded" }).status, "succeeded");
  assert.equal(datastore.saveRegistration(makeRegistration({ registration_id: "R2" })).registration_id, "R2");
  assert.equal(Boolean(datastore.savePaymentAndRegistration({ registrationId: "R2", paymentInput: { payment_id: "p1" } }).payment), true);
  assert.equal(datastore.getRegistrationById("missing"), null);
  assert.equal(datastore.listPaymentTransactionsByRegistration("missing").length, 0);
});

test("datastore service store paths return nulls safely", () => {
  const store = {
    getRegistrationById() { return null; },
    listPaymentTransactionsByRegistration() { return null; },
    findPaymentByGatewayReference() { return null; },
    updatePaymentTransaction() { return null; },
  };
  const datastore = createDatastoreService({ store });
  assert.equal(datastore.getRegistrationById("R1"), null);
  assert.equal(datastore.listPaymentTransactionsByRegistration("R1").length, 0);
  assert.equal(datastore.findPaymentByGatewayReference("gw"), null);
  assert.equal(datastore.updatePaymentRecord("id", { status: "succeeded" }), null);
});

test("datastore savePaymentAndRegistration warns on update failure", () => {
  const warnings = [];
  const datastore = createDatastoreService({
    store: {
      createPaymentTransaction(payment) { return payment; },
      updateRegistrationStatus() {
        const error = new Error("");
        error.message = "";
        throw error;
      },
    },
    logger: { warn(entry) { warnings.push(entry); } },
  });

  datastore.savePaymentAndRegistration({
    registrationId: "R1",
    paymentInput: createPaymentTransaction({ registration_id: "R1", gateway_reference: "gw_warn" }),
    newStatus: "pending_confirmation",
  });
  assert.equal(warnings.length, 1);
});

test("payment service handles initiation branches and service errors", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ status: REGISTRATION_STATUS.PAID_CONFIRMED }));
  const paymentService = createPaymentService({ datastoreService: datastore, clock: () => new Date("2026-02-01T10:00:00.000Z") });

  const alreadyPaid = paymentService.initiatePayment({ registrationId: "R1" });
  assert.equal(alreadyPaid.type, "already_paid");

  datastore.saveRegistration(makeRegistration({ registration_id: "R2", status: REGISTRATION_STATUS.PENDING_CONFIRMATION }));
  const pending = paymentService.initiatePayment({ registrationId: "R2" });
  assert.equal(pending.type, "pending");

  datastore.saveRegistration(makeRegistration({ registration_id: "R3", status: REGISTRATION_STATUS.UNPAID }));
  const initiated = paymentService.initiatePayment({ registrationId: "R3" });
  assert.equal(initiated.type, "initiated");
  assert.equal(initiated.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);

  const missing = paymentService.initiatePayment({ registrationId: "missing" });
  assert.equal(missing.type, "not_found");

  const summary = paymentService.getRegistrationSummary({ registrationId: "R3" });
  assert.equal(summary.type, "success");
  assert.equal(summary.registration.registration_id, "R3");

  const failingService = createPaymentService({
    datastoreService: {
      getRegistrationById() { return makeRegistration({ registration_id: "R4" }); },
      generateGatewayReference() { return "gw_fail"; },
      savePaymentAndRegistration() { throw new Error("fail"); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const unavailable = failingService.initiatePayment({ registrationId: "R4" });
  assert.equal(unavailable.type, "service_unavailable");
});

test("payment service confirm branches and timeout evaluation", () => {
  const now = "2026-02-02T12:00:00.000Z";
  const auditEvents = [];
  const auditService = {
    logPaymentFailed(details) { auditEvents.push(details); },
    logPaymentConfirmed(details) { auditEvents.push(details); },
    logPendingTimeout(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({
    registration_id: "R1",
    status: REGISTRATION_STATUS.UNPAID,
  }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date(now),
  });

  const validation = paymentService.confirmPayment({ registrationId: "", gatewayReference: "" });
  assert.equal(validation.type, "validation_error");

  const summary = paymentService.getRegistrationSummary({ registrationId: "missing" });
  assert.equal(summary.type, "not_found");

  const notFound = paymentService.confirmPayment({ registrationId: "missing", gatewayReference: "gw" });
  assert.equal(notFound.type, "not_found");

  datastore.createPaymentRecord(
    createPaymentTransaction({
      registration_id: "R1",
      amount: 200,
      gateway_reference: "gw_dup",
    })
  );
  const duplicate = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_dup",
    status: "succeeded",
  });
  assert.equal(duplicate.type, "processed");
  assert.equal(duplicate.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);

  const success = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_ok",
    status: "succeeded",
  });
  assert.equal(success.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);

  const declined = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_declined",
    status: "declined",
  });
  assert.equal(declined.registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(declined.registration.status_reason, "declined");

  const failed = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_failed",
    status: "failed",
  });
  assert.equal(failed.registration.status_reason, "invalid_details");

  const pendingConfirm = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_pending",
    status: "pending_confirmation",
  });
  assert.equal(pendingConfirm.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);

  const pendingRecord = datastore.createPaymentRecord(
    createPaymentTransaction({
      registration_id: "R1",
      amount: 200,
      gateway_reference: "gw_pending_existing",
      status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
    })
  );
  const pendingExisting = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: pendingRecord.gateway_reference,
    status: "pending_confirmation",
  });
  assert.equal(pendingExisting.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
  const updateFailDatastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R9", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return createPaymentTransaction({
          registration_id: "R9",
          gateway_reference: "gw_update_fail",
          status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
        });
      },
      updatePaymentTransaction() {
        return null;
      },
      updateRegistrationStatus() {
        return null;
      },
    },
  });
  const updateFailService = createPaymentService({
    datastoreService: updateFailDatastore,
    clock: () => new Date(now),
  });
  const updateFail = updateFailService.confirmPayment({
    registrationId: "R9",
    gatewayReference: "gw_update_fail",
    status: "succeeded",
  });
  assert.equal(updateFail.type, "processed");
  const declineExisting = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: pendingRecord.gateway_reference,
    status: "declined",
  });
  assert.equal(declineExisting.registration.status_reason, "declined");
  assert.equal(auditEvents.length > 0, true);

  const pendingRecord2 = datastore.createPaymentRecord(
    createPaymentTransaction({
      registration_id: "R1",
      amount: 200,
      gateway_reference: "gw_pending_existing_2",
      status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
    })
  );
  const failExisting = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: pendingRecord2.gateway_reference,
    status: "failed",
  });
  assert.equal(failExisting.registration.status_reason, "invalid_details");

  const pendingRegistration = makeRegistration({
    registration_id: "R2",
    status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
    status_updated_at: "2026-01-31T10:00:00.000Z",
  });
  datastore.saveRegistration(pendingRegistration);
  const statusResult = paymentService.getPaymentStatus({ registrationId: "R2" });
  assert.equal(statusResult.registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(statusResult.registration.status_reason, "pending_timeout");

  datastore.saveRegistration(makeRegistration({
    registration_id: "R3",
    status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
    status_updated_at: "not-a-date",
  }));
  const invalidDate = paymentService.getPaymentStatus({ registrationId: "R3" });
  assert.equal(invalidDate.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);

  datastore.saveRegistration(makeRegistration({
    registration_id: "R3b",
    status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
    status_updated_at: "",
  }));
  const emptyDate = paymentService.getPaymentStatus({ registrationId: "R3b" });
  assert.equal(emptyDate.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);

  const missingRef = paymentService.confirmPayment({ registrationId: "R1", gatewayReference: "" });
  assert.equal(missingRef.type, "validation_error");

  const orphan = createPaymentTransaction({
    registration_id: "R_missing",
    amount: 200,
    gateway_reference: "gw_orphan",
    status: PAYMENT_TRANSACTION_STATUS.SUCCEEDED,
  });
  datastore.createPaymentRecord(orphan);
  const orphanConfirm = paymentService.confirmPayment({
    registrationId: "R_missing",
    gatewayReference: "gw_orphan",
    status: "succeeded",
  });
  assert.equal(orphanConfirm.type, "not_found");

  const settled = createPaymentTransaction({
    registration_id: "R1",
    amount: 200,
    gateway_reference: "gw_settled",
    status: PAYMENT_TRANSACTION_STATUS.SUCCEEDED,
  });
  datastore.createPaymentRecord(settled);
  const duplicateFinal = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_settled",
    status: "succeeded",
  });
  assert.equal(duplicateFinal.type, "duplicate");

  datastore.saveRegistration(makeRegistration({ registration_id: "R4", status: REGISTRATION_STATUS.UNPAID }));
  const confirmedNew = paymentService.confirmPayment({
    registrationId: "R4",
    gatewayReference: "gw_new_success",
    status: "succeeded",
  });
  assert.equal(confirmedNew.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);

  const updateExisting = paymentService.confirmPayment({
    registrationId: "R1",
    gatewayReference: "gw_pending",
    status: "succeeded",
  });
  assert.equal(updateExisting.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);

  const failedNew = paymentService.confirmPayment({
    registrationId: "R4",
    gatewayReference: "gw_new_failed",
    status: "failed",
  });
  assert.equal(failedNew.registration.status_reason, "invalid_details");
  assert.equal(auditEvents.length > 0, true);

  datastore.saveRegistration(makeRegistration({ registration_id: "R5", fee_amount: null, status: REGISTRATION_STATUS.UNPAID }));
  const failedNew2 = paymentService.confirmPayment({
    registrationId: "R5",
    gatewayReference: "gw_new_failed2",
    status: "failed",
  });
  assert.equal(failedNew2.registration.status_reason, "invalid_details");
});

test("payment service confirm new pending confirmation triggers audit failed", () => {
  const auditEvents = [];
  const auditService = {
    logPaymentFailed(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R6", status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });

  const pending = paymentService.confirmPayment({
    registrationId: "R6",
    gatewayReference: "gw_pending_new",
    status: "pending_confirmation",
  });
  assert.equal(pending.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
  assert.equal(auditEvents.length, 1);
});

test("payment service confirm new success triggers audit confirmed", () => {
  const auditEvents = [];
  const auditService = {
    logPaymentConfirmed(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R7", status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });

  const success = paymentService.confirmPayment({
    registrationId: "R7",
    gatewayReference: "gw_success_new",
    status: "succeeded",
  });
  assert.equal(success.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);
  assert.equal(auditEvents.length, 1);
});

test("payment service confirm existing uses existing status when status not provided", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R8", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return {
          registration_id: "R8",
          gateway_reference: "gw_existing_status",
          status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
          payment_id: "p8",
        };
      },
      updatePaymentTransaction() { return null; },
      updateRegistrationStatus() { return null; },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({ registrationId: "R8", gatewayReference: "gw_existing_status" });
  assert.equal(result.type, "processed");
});

test("payment service pending timeout update failure returns original", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({
          registration_id: "R1",
          status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
          status_updated_at: "2026-01-01T00:00:00.000Z",
        });
      },
      updateRegistrationStatus() {
        return null;
      },
      listPaymentTransactionsByRegistration() {
        return [];
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R1" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout logs audit when exceeded", () => {
  const auditEvents = [];
  const auditService = {
    logPendingTimeout(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({
          registration_id: "R10",
          status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
          status_updated_at: "2026-01-01T00:00:00.000Z",
        });
      },
      updateRegistrationStatus() {
        return makeRegistration({
          registration_id: "R10",
          status: REGISTRATION_STATUS.UNPAID,
          status_updated_at: "2026-02-02T00:00:00.000Z",
        });
      },
      getLatestPaymentRecord() {
        return { payment_id: "p10" };
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R10" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(auditEvents.length, 1);
});

test("payment service pending timeout logs audit when no latest payment", () => {
  const auditEvents = [];
  const auditService = {
    logPendingTimeout(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({
          registration_id: "R16",
          status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
          status_updated_at: "2026-01-01T00:00:00.000Z",
        });
      },
      updateRegistrationStatus() {
        return makeRegistration({
          registration_id: "R16",
          status: REGISTRATION_STATUS.UNPAID,
          status_updated_at: "2026-02-02T00:00:00.000Z",
        });
      },
      getLatestPaymentRecord() {
        return null;
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R16" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(auditEvents.length, 1);
});

test("payment service pending timeout logs audit with no latest payment on summary", () => {
  const auditEvents = [];
  const auditService = {
    logPendingTimeout(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({
          registration_id: "R17",
          status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
          status_updated_at: "2026-01-01T00:00:00.000Z",
        });
      },
      updateRegistrationStatus() {
        return makeRegistration({
          registration_id: "R17",
          status: REGISTRATION_STATUS.UNPAID,
          status_updated_at: "2026-02-02T00:00:00.000Z",
        });
      },
      getLatestPaymentRecord() {
        return null;
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getRegistrationSummary({ registrationId: "R17" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(auditEvents.length, 1);
});

test("payment service pending timeout parses date for pending status", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(
    makeRegistration({
      registration_id: "R32",
      status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
      status_updated_at: "2026-02-01T00:00:00.000Z",
    })
  );
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T00:00:10.000Z"),
  });
  const result = paymentService.getRegistrationSummary({ registrationId: "R32" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout parses date via direct datastore", () => {
  const datastore = {
    getRegistrationById() {
      return makeRegistration({
        registration_id: "R33",
        status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        status_updated_at: "2026-02-01T00:00:00.000Z",
      });
    },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T00:00:10.000Z"),
  });
  const result = paymentService.getRegistrationSummary({ registrationId: "R33" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout parses date with raw registration", () => {
  const datastore = {
    getRegistrationById() {
      return {
        registration_id: "R35",
        status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        status_updated_at: "2026-02-01T00:00:00.000Z",
      };
    },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T00:00:10.000Z"),
  });
  const result = paymentService.getRegistrationSummary({ registrationId: "R35" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout parses date even when not exceeded", () => {
  const datastore = {
    getRegistrationById() {
      return {
        registration_id: "R37",
        status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        status_updated_at: "2026-02-01T00:00:00.000Z",
      };
    },
    getLatestPaymentRecord() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T00:00:05.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R37" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout logs audit with latest payment id", () => {
  const auditEvents = [];
  const auditService = {
    logPendingTimeout(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({
          registration_id: "R30",
          status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
          status_updated_at: "2026-01-01T00:00:00.000Z",
        });
      },
      updateRegistrationStatus() {
        return makeRegistration({
          registration_id: "R30",
          status: REGISTRATION_STATUS.UNPAID,
          status_updated_at: "2026-02-02T00:00:00.000Z",
        });
      },
      listPaymentTransactionsByRegistration() {
        return [
          {
            payment_id: "p30",
            registration_id: "R30",
            amount: 100,
            created_at: "2026-01-01T00:00:00.000Z",
            gateway_reference: "gw_p30",
          },
        ];
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R30" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.UNPAID);
  assert.equal(auditEvents[0].paymentId, "p30");
});
test("payment service initiate uses normalized registration when update fails", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R1", status: REGISTRATION_STATUS.UNPAID });
      },
      createPaymentTransaction(payment) {
        return payment;
      },
      updateRegistrationStatus() {
        return null;
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.initiatePayment({ registrationId: "R1" });
  assert.equal(result.type, "initiated");
  assert.equal(result.registration.status, REGISTRATION_STATUS.UNPAID);
});

test("payment service initiate logs audit with empty payment id when missing", () => {
  const auditEvents = [];
  const datastore = {
    getRegistrationById() {
      return makeRegistration({ registration_id: "R11", status: REGISTRATION_STATUS.UNPAID });
    },
    generateGatewayReference() {
      return "gw_empty";
    },
    savePaymentAndRegistration() {
      return {
        registration: makeRegistration({ registration_id: "R11", status: REGISTRATION_STATUS.PENDING_CONFIRMATION }),
        payment: null,
      };
    },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService: {
      logPaymentInitiated(details) { auditEvents.push(details); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.initiatePayment({ registrationId: "R11", actorId: "A11" });
  assert.equal(result.type, "initiated");
  assert.equal(auditEvents[0].paymentId, "");
});

test("payment service initiate skips audit when not provided", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R1" }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.initiatePayment({ registrationId: "R1" });
  assert.equal(result.type, "initiated");
});

test("payment service initiate logs errors when logger provided", () => {
  const errors = [];
  const paymentService = createPaymentService({
    datastoreService: {
      getRegistrationById() { return makeRegistration({ registration_id: "R1", status: REGISTRATION_STATUS.UNPAID }); },
      generateGatewayReference() { return "gw_err"; },
      savePaymentAndRegistration() { throw new Error("boom"); },
    },
    loggingService: {
      logPaymentError(details) { errors.push(details); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.initiatePayment({ registrationId: "R1" });
  assert.equal(result.type, "service_unavailable");
  assert.equal(errors.length, 1);
});

test("payment service confirm existing uses existing status fallback", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R1", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return { registration_id: "R1", gateway_reference: "gw_existing", status: undefined, payment_id: "p1" };
      },
      updatePaymentTransaction() { return null; },
      updateRegistrationStatus() { return null; },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({ registrationId: "R1", gatewayReference: "gw_existing" });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing uses existing declined status when status missing", () => {
  const auditEvents = [];
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R12", status: REGISTRATION_STATUS.UNPAID });
      },
      findPaymentByGatewayReference() {
        return {
          registration_id: "R12",
          gateway_reference: "gw_existing_declined",
          status: PAYMENT_TRANSACTION_STATUS.DECLINED,
          payment_id: "p12",
        };
      },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService: {
      logPaymentDuplicateConfirmation(details) { auditEvents.push(details); },
    },
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({ registrationId: "R12", gatewayReference: "gw_existing_declined" });
  assert.equal(result.type, "duplicate");
  assert.equal(auditEvents.length, 1);
});

test("payment service confirm new uses registration fee amount", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R9", fee_amount: 350, status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  paymentService.confirmPayment({
    registrationId: "R9",
    gatewayReference: "gw_amount",
    status: "succeeded",
  });
  const record = datastore.getLatestPaymentRecord("R9");
  assert.equal(record.amount, 350);
});

test("payment service confirm new defaults status when missing", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R19", fee_amount: 100, status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R19",
    gatewayReference: "gw_default_status",
  });
  assert.equal(result.type, "processed");
  assert.equal(result.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);
});

test("payment service confirm new allows null fee amount", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(
    makeRegistration({ registration_id: "R15", fee_amount: null, status: REGISTRATION_STATUS.UNPAID })
  );
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  paymentService.confirmPayment({
    registrationId: "R15",
    gatewayReference: "gw_amount_null",
    status: "succeeded",
  });
  const record = datastore.getLatestPaymentRecord("R15");
  assert.equal(record.amount, null);
});

test("payment service confirm new logs audit when payment record missing", () => {
  const auditEvents = [];
  const datastore = {
    getRegistrationById() {
      return makeRegistration({ registration_id: "R25", fee_amount: 100, status: REGISTRATION_STATUS.UNPAID });
    },
    savePaymentAndRegistration() {
      return {
        registration: makeRegistration({ registration_id: "R25", status: REGISTRATION_STATUS.PAID_CONFIRMED }),
        payment: null,
      };
    },
    findPaymentByGatewayReference() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService: {
      logPaymentConfirmed(details) { auditEvents.push(details); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R25",
    gatewayReference: "gw_missing_payment",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
  assert.equal(auditEvents[0].paymentId, "");
});

test("payment service confirm new failed logs audit when payment record missing", () => {
  const auditEvents = [];
  const datastore = {
    getRegistrationById() {
      return makeRegistration({ registration_id: "R26", fee_amount: 100, status: REGISTRATION_STATUS.UNPAID });
    },
    savePaymentAndRegistration() {
      return {
        registration: makeRegistration({
          registration_id: "R26",
          status: REGISTRATION_STATUS.UNPAID,
          status_reason: "invalid_details",
        }),
        payment: null,
      };
    },
    findPaymentByGatewayReference() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService: {
      logPaymentFailed(details) { auditEvents.push(details); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R26",
    gatewayReference: "gw_missing_payment_failed",
    status: "failed",
  });
  assert.equal(result.type, "processed");
  assert.equal(auditEvents[0].paymentId, "");
});

test("payment service confirm new returns original registration when save returns null", () => {
  const datastore = {
    getRegistrationById() {
      return makeRegistration({ registration_id: "R29", fee_amount: 90, status: REGISTRATION_STATUS.UNPAID });
    },
    savePaymentAndRegistration() {
      return { registration: null, payment: null };
    },
    findPaymentByGatewayReference() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R29",
    gatewayReference: "gw_null_reg",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
  assert.equal(result.registration.registration_id, "R29");
});

test("payment service pending timeout with valid date not exceeded", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(
    makeRegistration({
      registration_id: "R20",
      status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
      status_updated_at: "2026-02-02T00:00:00.000Z",
    })
  );
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R20" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout not exceeded with valid date in summary", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(
    makeRegistration({
      registration_id: "R21",
      status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
      status_updated_at: "2026-02-02T00:00:00.000Z",
    })
  );
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T00:00:30.000Z"),
  });
  const result = paymentService.getRegistrationSummary({ registrationId: "R21" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service pending timeout ignores invalid dates", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(
    makeRegistration({
      registration_id: "R27",
      status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
      status_updated_at: "invalid-date",
    })
  );
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R27" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.PENDING_CONFIRMATION);
});

test("payment service confirm existing uses provided status override", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R22", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return {
          registration_id: "R22",
          gateway_reference: "gw_existing_override",
          status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
          payment_id: "p22",
        };
      },
      updatePaymentTransaction() { return null; },
      updateRegistrationStatus() { return null; },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R22",
    gatewayReference: "gw_existing_override",
    status: "declined",
  });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing uses provided status when existing missing", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R28", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return {
          registration_id: "R28",
          gateway_reference: "gw_existing_missing",
          status: undefined,
          payment_id: "p28",
        };
      },
      updatePaymentTransaction() { return null; },
      updateRegistrationStatus() { return null; },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R28",
    gatewayReference: "gw_existing_missing",
    status: "declined",
  });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing normalizes provided status", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R33", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return {
          registration_id: "R33",
          gateway_reference: "gw_existing_norm",
          status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
          payment_id: "p33",
        };
      },
      updatePaymentTransaction() { return null; },
      updateRegistrationStatus() { return null; },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R33",
    gatewayReference: "gw_existing_norm",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing normalizes status via direct datastore", () => {
  const datastore = {
    findPaymentByGatewayReference() {
      return {
        registration_id: "R34",
        gateway_reference: "gw_existing_direct",
        status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
        payment_id: "p34",
      };
    },
    getRegistrationById() {
      return makeRegistration({ registration_id: "R34", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
    },
    updatePaymentRecord() { return null; },
    updateRegistrationStatus() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R34",
    gatewayReference: "gw_existing_direct",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing normalizes status with raw existing payment", () => {
  const datastore = {
    findPaymentByGatewayReference() {
      return {
        registration_id: "R36",
        gateway_reference: "gw_existing_raw",
        status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
        payment_id: "p36",
      };
    },
    getRegistrationById() {
      return {
        registration_id: "R36",
        status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        status_updated_at: "2026-02-01T00:00:00.000Z",
      };
    },
    updatePaymentRecord() { return null; },
    updateRegistrationStatus() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R36",
    gatewayReference: "gw_existing_raw",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing normalizes status when status omitted", () => {
  const datastore = {
    findPaymentByGatewayReference() {
      return {
        registration_id: "R38",
        gateway_reference: "gw_existing_omit",
        status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
        payment_id: "p38",
      };
    },
    getRegistrationById() {
      return {
        registration_id: "R38",
        status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        status_updated_at: "2026-02-01T00:00:00.000Z",
      };
    },
    updatePaymentRecord() { return null; },
    updateRegistrationStatus() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R38",
    gatewayReference: "gw_existing_omit",
  });
  assert.equal(result.type, "processed");
});

test("payment service confirm existing falls back to succeeded when status missing", () => {
  const datastore = {
    findPaymentByGatewayReference() {
      return {
        registration_id: "R39",
        gateway_reference: "gw_existing_fallback",
        status: undefined,
        payment_id: "p39",
      };
    },
    getRegistrationById() {
      return {
        registration_id: "R39",
        status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
        status_updated_at: "2026-02-01T00:00:00.000Z",
      };
    },
    updateRegistrationStatus() { return null; },
    getLatestPaymentRecord() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R39",
    gatewayReference: "gw_existing_fallback",
  });
  assert.equal(result.type, "duplicate");
});

test("payment service confirm existing uses provided status over existing", () => {
  const datastore = createDatastoreService({
    store: {
      getRegistrationById() {
        return makeRegistration({ registration_id: "R31", status: REGISTRATION_STATUS.PENDING_CONFIRMATION });
      },
      findPaymentByGatewayReference() {
        return {
          registration_id: "R31",
          gateway_reference: "gw_existing_override2",
          status: PAYMENT_TRANSACTION_STATUS.PENDING_CONFIRMATION,
          payment_id: "p31",
        };
      },
      updatePaymentTransaction() { return null; },
      updateRegistrationStatus() { return null; },
    },
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T12:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R31",
    gatewayReference: "gw_existing_override2",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
});
test("payment service confirm new failed triggers audit failed with reason", () => {
  const auditEvents = [];
  const auditService = {
    logPaymentFailed(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R13", fee_amount: 120, status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R13",
    gatewayReference: "gw_failed_new",
    status: "failed",
  });
  assert.equal(result.type, "processed");
  assert.equal(result.registration.status_reason, "invalid_details");
  assert.equal(auditEvents.length, 1);
});

test("payment service confirm new saves payment and logs audit confirmed with payment id", () => {
  const auditEvents = [];
  const datastore = {
    getRegistrationById() {
      return makeRegistration({ registration_id: "R17", fee_amount: 180, status: REGISTRATION_STATUS.UNPAID });
    },
    savePaymentAndRegistration() {
      return {
        registration: makeRegistration({ registration_id: "R17", status: REGISTRATION_STATUS.PAID_CONFIRMED }),
        payment: createPaymentTransaction({
          payment_id: "p17",
          registration_id: "R17",
          amount: 180,
          gateway_reference: "gw_r17",
          status: "succeeded",
        }),
      };
    },
    findPaymentByGatewayReference() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService: {
      logPaymentConfirmed(details) { auditEvents.push(details); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R17",
    gatewayReference: "gw_r17",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
  assert.equal(auditEvents[0].paymentId, "p17");
});

test("payment service confirm new failed logs audit failed with payment id", () => {
  const auditEvents = [];
  const datastore = {
    getRegistrationById() {
      return makeRegistration({ registration_id: "R18", fee_amount: 180, status: REGISTRATION_STATUS.UNPAID });
    },
    savePaymentAndRegistration() {
      return {
        registration: makeRegistration({
          registration_id: "R18",
          status: REGISTRATION_STATUS.UNPAID,
          status_reason: "invalid_details",
        }),
        payment: createPaymentTransaction({
          payment_id: "p18",
          registration_id: "R18",
          amount: 180,
          gateway_reference: "gw_r18",
          status: "failed",
        }),
      };
    },
    findPaymentByGatewayReference() { return null; },
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService: {
      logPaymentFailed(details) { auditEvents.push(details); },
    },
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R18",
    gatewayReference: "gw_r18",
    status: "failed",
  });
  assert.equal(result.type, "processed");
  assert.equal(auditEvents[0].paymentId, "p18");
});

test("payment service confirm new succeeds and logs audit confirmed", () => {
  const auditEvents = [];
  const auditService = {
    logPaymentConfirmed(details) { auditEvents.push(details); },
  };
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R14", fee_amount: 150, status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.confirmPayment({
    registrationId: "R14",
    gatewayReference: "gw_success_new2",
    status: "succeeded",
  });
  assert.equal(result.type, "processed");
  assert.equal(result.registration.status, REGISTRATION_STATUS.PAID_CONFIRMED);
  assert.equal(auditEvents.length, 1);
});

test("payment service isPendingTimeout false for non-pending", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R1", status: REGISTRATION_STATUS.UNPAID }));
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const result = paymentService.getPaymentStatus({ registrationId: "R1" });
  assert.equal(result.registration.status, REGISTRATION_STATUS.UNPAID);
});

test("payment service emits audit hooks when provided", () => {
  const auditCalls = [];
  const auditService = {
    logPaymentInitiated(details) { auditCalls.push({ event: "initiated", details }); },
    logPaymentConfirmed(details) { auditCalls.push({ event: "confirmed", details }); },
    logPaymentFailed(details) { auditCalls.push({ event: "failed", details }); },
    logPaymentDuplicateConfirmation(details) { auditCalls.push({ event: "duplicate", details }); },
    logPendingTimeout(details) { auditCalls.push({ event: "timeout", details }); },
  };
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R1" }));
  datastore.saveRegistration(makeRegistration({
    registration_id: "R2",
    status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
    status_updated_at: "2026-01-30T10:00:00.000Z",
  }));

  const paymentService = createPaymentService({
    datastoreService: datastore,
    auditService,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });

  paymentService.initiatePayment({ registrationId: "R1" });
  const reference = datastore.getLatestPaymentRecord("R1").gateway_reference;
  paymentService.confirmPayment({ registrationId: "R1", gatewayReference: reference, status: "succeeded" });
  paymentService.confirmPayment({ registrationId: "R1", gatewayReference: reference, status: "succeeded" });
  paymentService.confirmPayment({ registrationId: "R1", gatewayReference: "gw_fail", status: "failed" });
  paymentService.getPaymentStatus({ registrationId: "R2" });

  assert.equal(auditCalls.some((entry) => entry.event === "initiated"), true);
  assert.equal(auditCalls.some((entry) => entry.event === "confirmed"), true);
  assert.equal(auditCalls.some((entry) => entry.event === "failed"), true);
  assert.equal(auditCalls.some((entry) => entry.event === "duplicate"), true);
  assert.equal(auditCalls.some((entry) => entry.event === "timeout"), true);
});

test("payment service status and records not_found", () => {
  const paymentService = createPaymentService({
    datastoreService: createDatastoreService(),
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });

  assert.equal(paymentService.getPaymentStatus({ registrationId: "missing" }).type, "not_found");
  assert.equal(paymentService.getPaymentRecords({ registrationId: "missing" }).type, "not_found");
});

test("payment service records success path", () => {
  const datastore = createDatastoreService();
  datastore.saveRegistration(makeRegistration({ registration_id: "R1" }));
  datastore.createPaymentRecord(
    createPaymentTransaction({
      registration_id: "R1",
      amount: 200,
      gateway_reference: "gw_record",
    })
  );
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const result = paymentService.getPaymentRecords({ registrationId: "R1" });
  assert.equal(result.type, "success");
  assert.equal(result.records.length, 1);
});

test("payment service requires datastore", () => {
  assert.throws(() => createPaymentService(), /datastoreService is required/);
});
