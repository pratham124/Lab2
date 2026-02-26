const test = require("node:test");
const assert = require("node:assert/strict");

const { createConfirmationTicketService } = require("../../src/services/confirmation_ticket_service");
const { createDeliveryAttemptService } = require("../../src/services/delivery_attempt_service");
const { createTicketEmailDeliveryService } = require("../../src/services/ticket_email_delivery_service");
const { createTicketAuditLog } = require("../../src/services/ticket_audit_log");

function createLogSink() {
  const entries = [];
  return {
    entries,
    logger: {
      log(message) {
        entries.push(message);
      },
    },
  };
}

function findLogEvent(entries, eventName) {
  return entries
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .find((entry) => entry.event === eventName);
}

test("confirmationTicketService validates required fields and payment status", async () => {
  const service = createConfirmationTicketService({ clock: () => new Date("2026-02-01T00:00:00.000Z") });

  const missing = await service.createTicketFromConfirmation({ paymentReference: "", attendeeId: "T1" });
  assert.equal(missing.type, "validation_error");

  const badStatus = await service.createTicketFromConfirmation({
    paymentReference: "PAY-1",
    attendeeId: "T1",
    amount: 200,
    paymentStatus: "pending",
  });
  assert.equal(badStatus.type, "validation_error");
});

test("confirmationTicketService creates tickets, handles duplicates, and enforces retention", async () => {
  const now = "2026-02-01T10:00:00.000Z";
  const conferenceEndDate = "2026-02-10T00:00:00.000Z";
  const service = createConfirmationTicketService({
    clock: () => new Date(now),
    conferenceEndDate,
  });

  const created = await service.createTicketFromConfirmation({
    paymentReference: "PAY-2",
    attendeeId: "T1",
    amount: 200,
    currency: "USD",
    paymentStatus: "confirmed",
  });

  assert.equal(created.type, "created");
  assert.ok(created.ticket.invoice_number);

  const duplicate = await service.createTicketFromConfirmation({
    paymentReference: "PAY-2",
    attendeeId: "T1",
    amount: 200,
    currency: "USD",
    paymentStatus: "confirmed",
  });
  assert.equal(duplicate.type, "duplicate");
  assert.equal(duplicate.ticket.ticket_id, created.ticket.ticket_id);

  const listActive = service.listTicketsForAttendee({ attendeeId: "T1" });
  assert.equal(listActive.length, 1);
  assert.equal(service.listTicketsForAttendee({ attendeeId: "" }).length, 0);
  assert.equal(service.getTicketByPaymentReference(""), null);

  const expiredService = createConfirmationTicketService({
    clock: () => new Date("2026-06-30T00:00:00.000Z"),
    conferenceEndDate,
  });
  await expiredService.createTicketFromConfirmation({
    paymentReference: "PAY-3",
    attendeeId: "T2",
    amount: 100,
    paymentStatus: "confirmed",
  });
  assert.equal(expiredService.listTicketsForAttendee({ attendeeId: "T2" }).length, 0);
  assert.equal(
    expiredService.listTicketsForAttendee({ attendeeId: "T2", includeExpired: true }).length,
    1
  );

  const missing = expiredService.getTicketForAttendee({ attendeeId: "T2", ticketId: "missing" });
  assert.equal(missing.type, "not_found");

  const createdExpired = await expiredService.createTicketFromConfirmation({
    paymentReference: "PAY-4",
    attendeeId: "T3",
    amount: 100,
    paymentStatus: "confirmed",
  });
  const forbidden = expiredService.getTicketForAttendee({
    attendeeId: "T2",
    ticketId: createdExpired.ticket.ticket_id,
  });
  assert.equal(forbidden.type, "forbidden");

  const expired = expiredService.getTicketForAttendee({
    attendeeId: "T3",
    ticketId: createdExpired.ticket.ticket_id,
  });
  assert.equal(expired.type, "expired");
});

test("confirmationTicketService emits generation failure when invoice number cannot be created", async () => {
  const now = "2026-02-01T10:00:00.000Z";
  const logSink = createLogSink();
  const ticketAuditLog = createTicketAuditLog({ logger: logSink.logger });

  const originalRandom = Math.random;
  const originalNow = Date.now;
  Math.random = () => 0.123456;
  Date.now = () => 1738400000000;

  try {
    const service = createConfirmationTicketService({
      clock: () => new Date(now),
      auditLog: ticketAuditLog,
    });

    const first = await service.createTicketFromConfirmation({
      paymentReference: "PAY-INV-1",
      attendeeId: "T1",
      amount: 120,
      paymentStatus: "confirmed",
    });
    assert.equal(first.type, "created");

    const second = await service.createTicketFromConfirmation({
      paymentReference: "PAY-INV-2",
      attendeeId: "T1",
      amount: 120,
      paymentStatus: "confirmed",
    });
    assert.equal(second.type, "error");
    assert.equal(second.reason, "invoice_generation_failed");

    const failureLog = findLogEvent(logSink.entries, "ticket_generation_failed");
    assert.ok(failureLog);
  } finally {
    Math.random = originalRandom;
    Date.now = originalNow;
  }
});

test("confirmationTicketService handles invalid conference end date and delivery attempts fallback", async () => {
  const service = createConfirmationTicketService({
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
    conferenceEndDate: "not-a-date",
  });

  const created = await service.createTicketFromConfirmation({
    paymentReference: "PAY-INVALID-END",
    attendeeId: "T9",
    amount: 50,
    paymentStatus: "",
    email: "t9@example.com",
  });
  assert.equal(created.type, "created");
  assert.ok(created.ticket.retention_expires_at);

  const byRef = service.getTicketByPaymentReference("PAY-INVALID-END");
  assert.equal(byRef.ticket_id, created.ticket.ticket_id);

  const attempts = service.listDeliveryAttempts(created.ticket.ticket_id);
  assert.equal(attempts.length, 0);

  const ticket = service.getTicketByPaymentReference("PAY-INVALID-END");
  ticket.retention_expires_at = "not-a-date";
  const invalidExpiry = service.getTicketForAttendee({
    attendeeId: "",
    ticketId: ticket.ticket_id,
  });
  assert.equal(invalidExpiry.type, "forbidden");

  ticket.retention_expires_at = null;
  const nullExpiry = service.getTicketForAttendee({
    attendeeId: "T9",
    ticketId: ticket.ticket_id,
  });
  assert.equal(nullExpiry.type, "success");

  const missing = service.getTicketForAttendee({ attendeeId: "T9", ticketId: "" });
  assert.equal(missing.type, "not_found");

  ticket.retention_expires_at = "not-a-date";
  const listedWithInvalidExpiry = service.listTicketsForAttendee({ attendeeId: "T9" });
  assert.equal(listedWithInvalidExpiry.length, 1);
});

test("confirmationTicketService covers list fallback, payment status fallback, and recipient_email delivery", async () => {
  const deliveredTo = [];
  const service = createConfirmationTicketService({
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
    deliveryService: {
      async deliverTicket({ recipientEmail }) {
        deliveredTo.push(recipientEmail);
        return { type: "delivered", status: 200 };
      },
    },
  });

  const none = service.listTicketsForAttendee({ attendeeId: "NO-TICKETS" });
  assert.deepEqual(none, []);

  const created = await service.createTicketFromConfirmation({
    paymentReference: "PAY-SPACE-STATUS",
    attendeeId: "T10",
    amount: 80,
    payment_status: "   ",
    recipient_email: "snake@example.com",
  });
  assert.equal(created.type, "created");
  assert.equal(created.confirmation.payment_status, "confirmed");
  assert.equal(deliveredTo[0], "snake@example.com");

  const createdCamel = await service.createTicketFromConfirmation({
    paymentReference: "PAY-CAMEL-EMAIL",
    attendeeId: "T11",
    amount: 81,
    recipientEmail: "camel@example.com",
  });
  assert.equal(createdCamel.type, "created");
  assert.equal(deliveredTo[1], "camel@example.com");

  const createdEmail = await service.createTicketFromConfirmation({
    paymentReference: "PAY-PLAIN-EMAIL",
    attendeeId: "T12",
    amount: 82,
    email: "plain@example.com",
  });
  assert.equal(createdEmail.type, "created");
  assert.equal(deliveredTo[2], "plain@example.com");
});

test("confirmationTicketService uses default clock fallback when clock is omitted", async () => {
  const service = createConfirmationTicketService();
  const created = await service.createTicketFromConfirmation({
    paymentReference: "PAY-DEFAULT-CLOCK",
    attendeeId: "T13",
    amount: 10,
  });

  assert.equal(created.type, "created");
  assert.ok(created.ticket.issued_at);
  assert.ok(created.ticket.retention_expires_at);
});

test("ticketEmailDeliveryService validates channel and recipient and records delivery attempts", async () => {
  const attempts = createDeliveryAttemptService({ clock: () => new Date("2026-02-01T00:00:00.000Z") });
  const logSink = createLogSink();
  const auditLog = createTicketAuditLog({ logger: logSink.logger });

  const service = createTicketEmailDeliveryService({
    notifier: { async sendEmail() {} },
    deliveryAttemptService: attempts,
    auditLog,
  });

  const invalidChannel = await service.deliverTicket({
    ticket: { ticket_id: "T1" },
    recipientEmail: "test@example.com",
    channel: "sms",
  });
  assert.equal(invalidChannel.type, "invalid_channel");

  const missingTicket = await service.deliverTicket({
    ticket: null,
    recipientEmail: "test@example.com",
  });
  assert.equal(missingTicket.type, "validation_error");

  const invalidRecipient = await service.deliverTicket({
    ticket: { ticket_id: "T1" },
    recipientEmail: "bad",
  });
  assert.equal(invalidRecipient.type, "validation_error");

  const blankRecipient = await service.deliverTicket({
    ticket: { ticket_id: "T1" },
    recipientEmail: "   ",
  });
  assert.equal(blankRecipient.type, "validation_error");

  const delivered = await service.deliverTicket({
    ticket: { ticket_id: "T1", invoice_number: "INV-1", payment_reference: "PAY-1" },
    recipientEmail: "test@example.com",
    ticketLink: "https://example.com/tickets/T1",
  });
  assert.equal(delivered.type, "delivered");
  assert.equal(attempts.listAttemptsByTicketId("T1").length, 1);

  const failingService = createTicketEmailDeliveryService({
    notifier: {
      async sendEmail() {
        throw new Error("smtp down");
      },
    },
    deliveryAttemptService: attempts,
    auditLog,
  });

  const failed = await failingService.deliverTicket({
    ticket: { ticket_id: "T2", invoice_number: "INV-2", payment_reference: "PAY-2" },
    recipientEmail: "test@example.com",
  });
  assert.equal(failed.type, "failed");
  assert.equal(attempts.listAttemptsByTicketId("T2").length, 1);

  const defaultNotifierService = createTicketEmailDeliveryService({
    deliveryAttemptService: attempts,
    auditLog,
  });
  const defaultDelivered = await defaultNotifierService.deliverTicket({
    ticket: { ticket_id: "T3", invoice_number: "INV-3", payment_reference: "PAY-3" },
    recipientEmail: "TEST@EXAMPLE.COM",
    ticketLink: "",
  });
  assert.equal(defaultDelivered.type, "delivered");

  const failureLog = findLogEvent(logSink.entries, "ticket_delivery_failed");
  assert.ok(failureLog);
});

test("deliveryAttemptService validates inputs and supports store hooks", () => {
  const calls = [];
  const store = {
    recordDeliveryAttempt(attempt) {
      calls.push(attempt);
    },
    listDeliveryAttemptsByTicketId(ticketId) {
      if (ticketId === "T-STORE") {
        return [{ ticket_id: ticketId, status: "delivered" }];
      }
      return [];
    },
  };
  const service = createDeliveryAttemptService({ store });

  const invalid = service.recordAttempt({ ticketId: "", recipientEmail: "" });
  assert.equal(invalid.type, "validation_error");

  const recorded = service.recordAttempt({
    ticketId: "T-1",
    recipientEmail: "test@example.com",
    status: "delivered",
  });
  assert.equal(recorded.type, "recorded");
  assert.equal(calls.length, 1);

  const emptyList = service.listAttemptsByTicketId("");
  assert.equal(emptyList.length, 0);

  const throwingStore = createDeliveryAttemptService({
    store: {
      recordDeliveryAttempt() {
        throw new Error("fail");
      },
      listDeliveryAttemptsByTicketId() {
        return [];
      },
    },
  });
  const silent = throwingStore.recordAttempt({
    ticketId: "T-2",
    recipientEmail: "test@example.com",
    status: "delivered",
  });
  assert.equal(silent.type, "recorded");

  const list = service.listAttemptsByTicketId("T-STORE");
  assert.equal(list.length, 1);

  const storeList = service.listAttemptsByTicketId("missing");
  assert.equal(storeList.length, 0);

  const nullStoreListService = createDeliveryAttemptService({
    store: {
      listDeliveryAttemptsByTicketId() {
        return null;
      },
    },
  });
  const nullStoreList = nullStoreListService.listAttemptsByTicketId("T-NULL");
  assert.deepEqual(nullStoreList, []);
});

test("deliveryAttemptService uses in-memory storage when no store provided", () => {
  const service = createDeliveryAttemptService();
  const recorded = service.recordAttempt({
    ticketId: "T-MEM",
    recipientEmail: "mem@example.com",
    status: "delivered",
  });
  assert.equal(recorded.type, "recorded");
  const list = service.listAttemptsByTicketId("T-MEM");
  assert.equal(list.length, 1);

  const missingList = service.listAttemptsByTicketId("T-NOT-RECORDED");
  assert.deepEqual(missingList, []);
});

test("ticketAuditLog writes all events safely", () => {
  const logs = [];
  const audit = createTicketAuditLog({
    logger: {
      log(message) {
        logs.push(message);
      },
    },
  });

  audit.logTicketCreated({ ticketId: "T1", attendeeId: "A1", paymentReference: "P1", invoiceNumber: "INV1" });
  audit.logDuplicateConfirmation({ ticketId: "T1", attendeeId: "A1", paymentReference: "P1" });
  audit.logDeliveryAttempt({ ticketId: "T1", recipientEmail: "a@example.com", status: "delivered" });
  audit.logDeliveryFailure({ ticketId: "T1", recipientEmail: "a@example.com", reason: "smtp" });
  audit.logTicketGenerationFailure({ paymentReference: "P1", attendeeId: "A1", reason: "fail" });
  audit.logAccessDenied({ attendeeId: "A1", ticketId: "T1" });

  assert.equal(logs.length, 6);
});

test("ticketAuditLog normalizes empty fields across all events", () => {
  const logs = [];
  const audit = createTicketAuditLog({
    logger: {
      log(message) {
        logs.push(JSON.parse(message));
      },
    },
  });

  audit.logTicketCreated();
  audit.logDuplicateConfirmation();
  audit.logDeliveryAttempt();
  audit.logDeliveryFailure();
  audit.logTicketGenerationFailure();
  audit.logAccessDenied();

  assert.equal(logs.length, 6);
  assert.equal(logs[0].ticket_id, "");
  assert.equal(logs[0].attendee_id, "");
  assert.equal(logs[0].payment_reference, "");
  assert.equal(logs[0].invoice_number, "");
  assert.equal(logs[1].ticket_id, "");
  assert.equal(logs[1].attendee_id, "");
  assert.equal(logs[1].payment_reference, "");
  assert.equal(logs[2].ticket_id, "");
  assert.equal(logs[2].recipient_email, "");
  assert.equal(logs[2].status, "");
  assert.equal(logs[3].ticket_id, "");
  assert.equal(logs[3].recipient_email, "");
  assert.equal(logs[3].reason, "");
  assert.equal(logs[4].payment_reference, "");
  assert.equal(logs[4].attendee_id, "");
  assert.equal(logs[4].reason, "");
  assert.equal(logs[5].attendee_id, "");
  assert.equal(logs[5].ticket_id, "");
});

test("ticketAuditLog falls back to console when no logger provided", () => {
  const original = console.log;
  console.log = () => {};
  try {
    const audit = createTicketAuditLog();
    audit.logTicketCreated({ ticketId: "T2", attendeeId: "A2", paymentReference: "P2", invoiceNumber: "INV2" });
  } finally {
    console.log = original;
  }
});

test("ticketEmailDeliveryService covers fallback branches for attempts and failure reason", async () => {
  const deliveredService = createTicketEmailDeliveryService({
    notifier: {
      async sendEmail() {},
    },
  });

  const delivered = await deliveredService.deliverTicket({
    ticket: { ticket_id: "T-FALLBACKS" },
    recipientEmail: "fallback@example.com",
    channel: "",
  });
  assert.equal(delivered.type, "delivered");
  assert.equal(delivered.status, 200);
  assert.equal(delivered.attempt, null);

  const failedService = createTicketEmailDeliveryService({
    notifier: {
      async sendEmail() {
        throw {};
      },
    },
  });

  const failed = await failedService.deliverTicket({
    ticket: { ticket_id: "T-FAIL-FALLBACK" },
    recipientEmail: "fail@example.com",
  });
  assert.equal(failed.type, "failed");
  assert.equal(failed.status, 503);
  assert.equal(failed.error, "email_delivery_failed");
  assert.equal(failed.attempt, null);

  const missingRecipient = await deliveredService.deliverTicket({
    ticket: { ticket_id: "T-MISSING-RECIPIENT" },
  });
  assert.equal(missingRecipient.type, "validation_error");
});

test("ticketEmailDeliveryService handles recordAttempt results without attempt payload", async () => {
  const noAttemptService = {
    recordAttempt() {
      return { type: "recorded" };
    },
  };

  const deliveredService = createTicketEmailDeliveryService({
    notifier: { async sendEmail() {} },
    deliveryAttemptService: noAttemptService,
    auditLog: {},
  });
  const delivered = await deliveredService.deliverTicket({
    ticket: { ticket_id: "T-NO-ATTEMPT", invoice_number: "", payment_reference: "" },
    recipientEmail: "noattempt@example.com",
  });
  assert.equal(delivered.type, "delivered");
  assert.equal(delivered.attempt, null);

  const failedService = createTicketEmailDeliveryService({
    notifier: {
      async sendEmail() {
        throw new Error("boom");
      },
    },
    deliveryAttemptService: noAttemptService,
    auditLog: {},
  });
  const failed = await failedService.deliverTicket({
    ticket: { ticket_id: "T-NO-ATTEMPT-FAIL", invoice_number: "", payment_reference: "" },
    recipientEmail: "noattemptfail@example.com",
  });
  assert.equal(failed.type, "failed");
  assert.equal(failed.attempt, null);
});

test("ticketEmailDeliveryService uses provided clock for attempt timestamp", async () => {
  const captured = [];
  const service = createTicketEmailDeliveryService({
    clock: () => new Date("2026-02-01T12:34:56.000Z"),
    notifier: { async sendEmail() {} },
    deliveryAttemptService: {
      recordAttempt(input) {
        captured.push(input);
        return { type: "recorded", attempt: { attempted_at: input.attemptedAt } };
      },
    },
  });

  const delivered = await service.deliverTicket({
    ticket: { ticket_id: "T-CLOCK" },
    recipientEmail: "clock@example.com",
  });
  assert.equal(delivered.type, "delivered");
  assert.equal(captured[0].attemptedAt, "2026-02-01T12:34:56.000Z");
});
