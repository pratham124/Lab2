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

function authHeaders(userId = "T1") {
  return { host: "localhost", "x-user-id": userId, accept: "application/json" };
}

function jsonHeaders() {
  return { host: "localhost", accept: "application/json", "content-type": "application/json" };
}

function createFixture({
  now = "2026-02-01T10:00:00.000Z",
  conferenceEndDate = "2026-02-10T00:00:00.000Z",
  notifier,
  confirmationTicketServiceOverride,
} = {}) {
  const clock = () => new Date(now);
  const ticketAuditLog = createTicketAuditLog({ logger: { log() {} } });
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

  return { server, confirmationTicketService, deliveryAttemptService };
}

test("UC-22 integration happy path: create ticket -> list -> detail", async () => {
  const { server } = createFixture();

  const create = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: jsonHeaders(),
    },
    JSON.stringify({
      paymentReference: "PAY-100",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t1@example.com",
    })
  );

  assert.equal(create.status, 201);
  const createdPayload = parseJson(create);
  assert.equal(createdPayload.attendeeId, "T1");
  assert.ok(createdPayload.ticketId);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  assert.equal(list.status, 200);
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 1);

  const detail = await injectRequest(server, {
    method: "GET",
    path: `/me/tickets/${createdPayload.ticketId}`,
    headers: authHeaders("T1"),
  });
  assert.equal(detail.status, 200);
  const detailPayload = parseJson(detail);
  assert.equal(detailPayload.ticketId, createdPayload.ticketId);
});

test("UC-22 integration invalid input: missing confirmation fields", async () => {
  const { server } = createFixture();

  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: jsonHeaders(),
    },
    JSON.stringify({})
  );

  assert.equal(response.status, 400);
  const payload = parseJson(response);
  assert.equal(payload.code, "invalid_confirmation");
});

test("UC-22 integration expected failure: unauthorized ticket access", async () => {
  const { server } = createFixture();

  const create = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: jsonHeaders(),
    },
    JSON.stringify({
      paymentReference: "PAY-200",
      attendeeId: "T2",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t2@example.com",
    })
  );
  const createdPayload = parseJson(create);

  const forbidden = await injectRequest(server, {
    method: "GET",
    path: `/me/tickets/${createdPayload.ticketId}`,
    headers: authHeaders("T1"),
  });

  assert.equal(forbidden.status, 403);
  const payload = parseJson(forbidden);
  assert.equal(payload.code, "access_denied");
});

test("UC-22 integration expected failure: retention expired returns 410", async () => {
  const { server } = createFixture({
    conferenceEndDate: "2025-01-01T00:00:00.000Z",
    now: "2026-02-01T10:00:00.000Z",
  });

  const create = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: jsonHeaders(),
    },
    JSON.stringify({
      paymentReference: "PAY-300",
      attendeeId: "T1",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t1@example.com",
    })
  );
  const createdPayload = parseJson(create);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T1"),
  });
  assert.equal(parseJson(list).tickets.length, 0);

  const detail = await injectRequest(server, {
    method: "GET",
    path: `/me/tickets/${createdPayload.ticketId}`,
    headers: authHeaders("T1"),
  });
  assert.equal(detail.status, 410);
  const payload = parseJson(detail);
  assert.equal(payload.code, "ticket_retention_expired");
});

test("UC-22 integration expected failure: delivery failure keeps ticket accessible", async () => {
  const notifier = {
    async sendEmail() {
      throw new Error("smtp down");
    },
  };

  const { server } = createFixture({ notifier });

  const create = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: jsonHeaders(),
    },
    JSON.stringify({
      paymentReference: "PAY-400",
      attendeeId: "T3",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t3@example.com",
    })
  );
  assert.equal(create.status, 201);
  const createdPayload = parseJson(create);

  const list = await injectRequest(server, {
    method: "GET",
    path: "/me/tickets",
    headers: authHeaders("T3"),
  });
  const listPayload = parseJson(list);
  assert.equal(listPayload.tickets.length, 1);
  assert.equal(listPayload.tickets[0].ticketId, createdPayload.ticketId);
});

test("UC-22 integration expected failure: ticket generation failure returns 500", async () => {
  const confirmationTicketServiceOverride = {
    async createTicketFromConfirmation() {
      return { type: "error", status: 500 };
    },
    listDeliveryAttempts() {
      return [];
    },
    listTicketsForAttendee() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "not_found", status: 404 };
    },
  };

  const { server } = createFixture({ confirmationTicketServiceOverride });

  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/payments/confirmations",
      headers: jsonHeaders(),
    },
    JSON.stringify({
      paymentReference: "PAY-500",
      attendeeId: "T4",
      amount: 200,
      currency: "USD",
      confirmedAt: "2026-02-01T10:00:00.000Z",
      recipientEmail: "t4@example.com",
    })
  );

  assert.equal(response.status, 500);
  const payload = parseJson(response);
  assert.equal(payload.code, "ticket_generation_failed");
});
