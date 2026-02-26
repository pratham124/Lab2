const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");
const { createConfirmationTicketService } = require("../../src/services/confirmation_ticket_service");
const { createTicketEmailDeliveryService } = require("../../src/services/ticket_email_delivery_service");
const { createDeliveryAttemptService } = require("../../src/services/delivery_attempt_service");
const { createTicketAuditLog } = require("../../src/services/ticket_audit_log");

function injectRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const reqBody = body ? Buffer.from(body, "utf8") : Buffer.alloc(0);
    let sent = false;
    const req = new Readable({
      read() {
        if (sent) {
          return;
        }
        sent = true;
        if (reqBody.length > 0) {
          this.push(reqBody);
        }
        this.push(null);
      },
    });

    req.method = options.method || "GET";
    req.url = options.path;
    req.headers = options.headers || { host: "localhost" };

    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        callback();
      },
    });

    res.writeHead = function writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers || {};
      return res;
    };

    res.end = function end(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resolve({
        status: res.statusCode || 200,
        headers: res.headers || {},
        body: Buffer.concat(chunks).toString("utf8"),
      });
      return res;
    };

    try {
      server.emit("request", req, res);
    } catch (error) {
      reject(error);
    }
  });
}

function parseJson(response) {
  return JSON.parse(response.body);
}

function jsonBody(payload) {
  return JSON.stringify(payload);
}

function authHeaders(userId = "T1") {
  return { host: "localhost", "x-user-id": userId, accept: "application/json" };
}

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

function createFixture({
  now = "2026-02-01T10:00:00.000Z",
  conferenceEndDate = "2026-02-10T00:00:00.000Z",
  notifier,
  confirmationTicketServiceOverride,
} = {}) {
  const clock = () => new Date(now);
  const logSink = createLogSink();
  const ticketAuditLog = createTicketAuditLog({ logger: logSink.logger });
  const deliveryAttemptService = createDeliveryAttemptService({ clock });
  const ticketEmailDeliveryService = createTicketEmailDeliveryService({
    notifier,
    deliveryAttemptService,
    auditLog: ticketAuditLog,
    clock,
  });
  const confirmationTicketService =
    confirmationTicketServiceOverride ||
    createConfirmationTicketService({
      deliveryService: ticketEmailDeliveryService,
      deliveryAttemptService,
      auditLog: ticketAuditLog,
      clock,
      conferenceEndDate,
    });

  const { server } = createAppServer({
    confirmationTicketService,
    deliveryAttemptService,
    ticketEmailDeliveryService,
    ticketAuditLog,
  });

  return {
    server,
    confirmationTicketService,
    deliveryAttemptService,
    logEntries: logSink.entries,
    now,
    conferenceEndDate,
  };
}

test("AT-UC22-01 — Ticket Generated and Accessible After Successful Payment (Main Success Scenario)", async () => {
  const { server, now, conferenceEndDate } = createFixture();

  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-001",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: now,
      recipientEmail: "attendee@example.com",
    })
  );

  assert.equal(response.status, 201);
  const payload = parseJson(response);
  assert.ok(payload.ticketId);
  assert.equal(payload.attendeeId, "T1");
  assert.equal(payload.paymentReference, "PAY-001");
  assert.ok(payload.invoiceNumber);
  assert.equal(payload.amount, 200);
  assert.equal(payload.registrationStatus, "Paid");
  assert.equal(payload.issuedAt, now);

  const expectedRetention = new Date(
    new Date(conferenceEndDate).getTime() + 90 * 24 * 60 * 60 * 1000
  ).toISOString();
  assert.equal(payload.retentionExpiresAt, expectedRetention);

  const issuedDelta = Math.abs(Date.parse(payload.issuedAt) - Date.parse(now));
  assert.ok(issuedDelta <= 2 * 60 * 1000);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 1);
  assert.equal(listPayload.tickets[0].ticketId, payload.ticketId);

  const htmlResponse = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", "content-type": "application/x-www-form-urlencoded" },
    },
    [
      "paymentReference=PAY-001-HTML",
      "attendeeId=T1",
      "amount=200",
      "currency=USD",
      `confirmedAt=${encodeURIComponent(now)}`,
      "recipientEmail=attendee%40example.com",
    ].join("&")
  );
  assert.equal(htmlResponse.status, 201);
  assert.ok(htmlResponse.body.includes("ticket has been issued"));
});

test("AT-UC22-02 — Ticket Delivered via Email (Delivery Success)", async () => {
  const sent = [];
  const notifier = {
    async sendEmail(payload) {
      sent.push(payload);
    },
  };

  const { server, deliveryAttemptService } = createFixture({ notifier });

  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-EMAIL",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "attendee@example.com",
    })
  );

  assert.equal(response.status, 201);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "attendee@example.com");

  const ticket = parseJson(response);
  const attempts = deliveryAttemptService.listAttemptsByTicketId(ticket.ticketId);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, "delivered");
  assert.equal(attempts[0].channel, "email");
});

test("AT-UC22-03 — Email Delivery Failure Does Not Block Access in CMS (Extension 5a)", async () => {
  const notifier = {
    async sendEmail() {
      throw new Error("email service down");
    },
  };

  const { server, deliveryAttemptService, logEntries } = createFixture({ notifier });

  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-002",
      attendeeId: "T2",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t2@example.com",
    })
  );

  assert.equal(response.status, 201);
  const ticket = parseJson(response);

  const attempts = deliveryAttemptService.listAttemptsByTicketId(ticket.ticketId);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, "failed");

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T2"),
  });
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 1);
  assert.equal(listPayload.tickets[0].ticketId, ticket.ticketId);

  const failureLog = findLogEvent(logEntries, "ticket_delivery_failed");
  assert.ok(failureLog);
});

test("AT-UC22-04 — Ticket Generation/Storage Failure After Payment Confirmation (Extension 3a)", async () => {
  const logSink = createLogSink();
  const ticketAuditLog = createTicketAuditLog({ logger: logSink.logger });
  const confirmationTicketServiceOverride = {
    async createTicketFromConfirmation(payload) {
      ticketAuditLog.logTicketGenerationFailure({
        paymentReference: payload.paymentReference || payload.payment_reference,
        attendeeId: payload.attendeeId || payload.attendee_id,
        reason: "storage_unavailable",
      });
      return { type: "error", status: 500 };
    },
    listTicketsForAttendee() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "not_found", status: 404 };
    },
    listDeliveryAttempts() {
      return [];
    },
  };

  const { server } = createFixture({ confirmationTicketServiceOverride });

  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-003",
      attendeeId: "T3",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t3@example.com",
    })
  );

  assert.equal(response.status, 500);
  const payload = parseJson(response);
  assert.ok(payload.message.includes("couldn't generate"));
  assert.ok(payload.support_contact);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T3"),
  });
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 0);

  const failureLog = findLogEvent(logSink.entries, "ticket_generation_failed");
  assert.ok(failureLog);
});

test("AT-UC22-05 — Authorization: Attendee Can Only Access Their Own Ticket (Extension 7a)", async () => {
  const { server } = createFixture();

  const created = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-004",
      attendeeId: "T2",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t2@example.com",
    })
  );
  const ticket = parseJson(created);

  const denied = await injectRequest(server, {
    method: "GET",
    path: `/me/tickets/${ticket.ticketId}`,
    headers: authHeaders("T1"),
  });

  assert.equal(denied.status, 403);
  const payload = parseJson(denied);
  assert.equal(payload.code, "access_denied");
  assert.equal(denied.body.includes(ticket.ticketId), false);
});

test("AT-UC22-06 — Ticket Persists and Can Be Retrieved Later", async () => {
  const { server } = createFixture();

  const created = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-005",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t1@example.com",
    })
  );
  const ticket = parseJson(created);

  const listNow = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  const listNowPayload = parseJson(listNow);
  assert.equal(listNowPayload.tickets.length, 1);
  assert.equal(listNowPayload.tickets[0].ticketId, ticket.ticketId);

  const listLater = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  const listLaterPayload = parseJson(listLater);
  assert.equal(listLaterPayload.tickets.length, 1);
  assert.equal(listLaterPayload.tickets[0].ticketId, ticket.ticketId);
});

test("AT-UC22-07 — Idempotency: Duplicate Payment Confirmation Does Not Create Duplicate Tickets", async () => {
  const { server, logEntries } = createFixture();

  const created = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-006",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t1@example.com",
    })
  );
  assert.equal(created.status, 201);
  const firstTicket = parseJson(created);

  const duplicate = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-006",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t1@example.com",
    })
  );
  assert.equal(duplicate.status, 200);
  const duplicatePayload = parseJson(duplicate);
  assert.equal(duplicatePayload.ticketId, firstTicket.ticketId);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 1);

  const duplicateLog = findLogEvent(logEntries, "ticket_confirmation_duplicate");
  assert.ok(duplicateLog);
});

test("AT-UC22-08 — Retention Boundary: Ticket Not Accessible After Retention Window", async () => {
  const { server } = createFixture({
    now: "2026-02-01T10:00:00.000Z",
    conferenceEndDate: "2025-01-01T00:00:00.000Z",
  });

  const created = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: { host: "localhost", accept: "application/json", "content-type": "application/json" },
    },
    jsonBody({
      paymentReference: "PAY-007",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t1@example.com",
    })
  );
  const ticket = parseJson(created);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 0);

  const detail = await injectRequest(server, {
    method: "GET",
    path: `/me/tickets/${ticket.ticketId}`,
    headers: authHeaders("T1"),
  });
  assert.equal(detail.status, 410);
  const detailPayload = parseJson(detail);
  assert.equal(detailPayload.code, "ticket_retention_expired");
  assert.ok(detailPayload.message.includes("retention period"));
});
