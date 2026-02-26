const test = require("node:test");
const assert = require("node:assert/strict");

const { createConfirmationTicket } = require("../../src/models/confirmation_ticket");
const { createPaymentConfirmation } = require("../../src/models/payment_confirmation");
const { createAttendeeAccount } = require("../../src/models/attendee_account");
const { createDeliveryAttempt } = require("../../src/models/delivery_attempt");
const { buildErrorResponse, ERROR_STATUS } = require("../../src/controllers/error_responses");


test("models normalize and default fields", () => {
  const crypto = require("crypto");
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = undefined;

  const ticket = createConfirmationTicket({
    ticketId: "T-1",
    attendeeId: "A1",
    paymentReference: "P1",
    invoiceNumber: "INV-1",
    amount: "200",
    registrationStatus: "Paid",
  });
  assert.equal(ticket.amount, 200);
  assert.equal(ticket.registration_status, "Paid");
  assert.ok(ticket.issued_at);

  const ticketDefaults = createConfirmationTicket({
    attendeeId: "A2",
    paymentReference: "P2",
    invoiceNumber: "INV-2",
    amount: "-1",
  });
  assert.equal(ticketDefaults.amount, null);
  assert.equal(ticketDefaults.registration_status, "Paid");
  assert.equal(ticketDefaults.retention_expires_at, null);
  assert.ok(String(ticketDefaults.ticket_id).startsWith("ticket_"));

  const ticketWithStatus = createConfirmationTicket({
    attendeeId: "A4",
    paymentReference: "P4",
    invoiceNumber: "INV-4",
    amount: 10,
    registration_status: " ",
  });
  assert.equal(ticketWithStatus.registration_status, "Paid");

  const ticketEmptyAmount = createConfirmationTicket({
    attendeeId: "A3",
    paymentReference: "P3",
    invoiceNumber: "INV-3",
    amount: "",
  });
  assert.equal(ticketEmptyAmount.amount, null);

  const confirmation = createPaymentConfirmation({
    paymentReference: "P1",
    attendeeId: "A1",
    amount: "150",
    currency: "usd",
  });
  assert.equal(confirmation.amount, 150);
  assert.equal(confirmation.currency, "USD");
  assert.equal(confirmation.payment_status, "confirmed");

  const confirmationDefaults = createPaymentConfirmation({
    paymentReference: "P2",
    attendeeId: "A2",
    amount: "bad",
  });
  assert.equal(confirmationDefaults.amount, null);
  assert.equal(confirmationDefaults.currency, "USD");
  assert.ok(confirmationDefaults.confirmed_at);

  const confirmationNull = createPaymentConfirmation({
    paymentReference: "P3",
    attendeeId: "A3",
    amount: null,
  });
  assert.equal(confirmationNull.amount, null);

  const confirmationEmptyStatus = createPaymentConfirmation({
    paymentReference: "P4",
    attendeeId: "A4",
    amount: 10,
    payment_status: " ",
  });
  assert.equal(confirmationEmptyStatus.payment_status, "confirmed");

  const attendee = createAttendeeAccount({
    attendeeId: "A1",
    name: "Ada",
    email: "ada@example.com",
    ticketIds: ["T-1", "", "T-2"],
  });
  assert.deepEqual(attendee.ticket_ids, ["T-1", "T-2"]);

  const attendeeDefaults = createAttendeeAccount({});
  assert.deepEqual(attendeeDefaults.ticket_ids, []);

  const attempt = createDeliveryAttempt({
    ticketId: "T-1",
    recipientEmail: "ada@example.com",
    status: "failed",
    channel: "email",
  });
  assert.equal(attempt.status, "failed");
  assert.equal(attempt.channel, "email");

  const attemptDefault = createDeliveryAttempt({
    ticketId: "T-2",
    recipientEmail: "ada@example.com",
    status: "unknown",
  });
  assert.equal(attemptDefault.status, "delivered");
  assert.ok(String(attemptDefault.delivery_id).startsWith("delivery_"));

  crypto.randomUUID = () => "fixed-uuid";
  const attemptUuid = createDeliveryAttempt({
    ticketId: "T-3",
    recipientEmail: "ada@example.com",
    status: "delivered",
    channel: " SMS ",
  });
  assert.equal(attemptUuid.delivery_id, "delivery_fixed-uuid");
  assert.equal(attemptUuid.channel, "sms");

  const attemptFailed = createDeliveryAttempt({
    ticketId: "T-4",
    recipientEmail: "ada@example.com",
    status: "FAILED",
    channel: "",
  });
  assert.equal(attemptFailed.status, "failed");
  assert.equal(attemptFailed.channel, "email");

  crypto.randomUUID = originalRandomUUID;
});

test("error_responses provides defaults and overrides", () => {
  const payload = buildErrorResponse("ticket_retention_expired");
  assert.equal(payload.code, "ticket_retention_expired");
  assert.equal(ERROR_STATUS.ticket_retention_expired, 410);

  const overridden = buildErrorResponse("access_denied", { message: "Nope", retryable: true });
  assert.equal(overridden.message, "Nope");
  assert.equal(overridden.retryable, true);
  assert.ok(overridden.support_contact);

  const fallback = buildErrorResponse("unknown_code");
  assert.equal(fallback.code, "error");
});

test("ticket and delivery models cover snake_case and empty fallback branches", () => {
  const snakeTicket = createConfirmationTicket({
    attendee_id: " A-SNAKE ",
    payment_reference: " P-SNAKE ",
    invoice_number: " INV-SNAKE ",
  });
  assert.equal(snakeTicket.attendee_id, "A-SNAKE");
  assert.equal(snakeTicket.payment_reference, "P-SNAKE");
  assert.equal(snakeTicket.invoice_number, "INV-SNAKE");

  const emptyTicket = createConfirmationTicket();
  assert.equal(emptyTicket.attendee_id, "");
  assert.equal(emptyTicket.payment_reference, "");
  assert.equal(emptyTicket.invoice_number, "");

  const snakeAttempt = createDeliveryAttempt({
    ticket_id: " T-SNAKE ",
    recipient_email: " user@example.com ",
    channel: "   ",
    status: null,
  });
  assert.equal(snakeAttempt.ticket_id, "T-SNAKE");
  assert.equal(snakeAttempt.recipient_email, "user@example.com");
  assert.equal(snakeAttempt.channel, "email");
  assert.equal(snakeAttempt.status, "delivered");
});

test("payment confirmation and delivery attempt handle snake_case and empty ids", () => {
  const snakeConfirmation = createPaymentConfirmation({
    payment_reference: " PAY-SNAKE ",
    attendee_id: " ATT-SNAKE ",
    amount: 1,
  });
  assert.equal(snakeConfirmation.payment_reference, "PAY-SNAKE");
  assert.equal(snakeConfirmation.attendee_id, "ATT-SNAKE");

  const emptyConfirmation = createPaymentConfirmation();
  assert.equal(emptyConfirmation.payment_reference, "");
  assert.equal(emptyConfirmation.attendee_id, "");

  const emptyAttempt = createDeliveryAttempt();
  assert.equal(emptyAttempt.ticket_id, "");
  assert.equal(emptyAttempt.recipient_email, "");
});
