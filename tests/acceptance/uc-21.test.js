const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");
const { createDatastoreService } = require("../../src/services/datastore_service");
const { createPaymentService } = require("../../src/services/payment_service");
const { createMessageService } = require("../../src/services/message_service");
const { createAuditService } = require("../../src/services/audit_service");
const { createLoggingService } = require("../../src/services/logging_service");
const { createRegistration } = require("../../src/models/registration");
const { createPaymentTransaction } = require("../../src/models/payment_transaction");
const { REGISTRATION_STATUS, PAYMENT_TRANSACTION_STATUS } = require("../../src/models/status_codes");

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

function createFixture({
  registrationOverrides = {},
  paymentRecords = [],
  now = "2026-02-01T10:00:00.000Z",
  loggerSink,
  auditSink,
} = {}) {
  const datastoreService = createDatastoreService();
  const registration = createRegistration({
    registration_id: "R1",
    attendee_id: "T1",
    category: "Regular",
    fee_amount: 200,
    status: REGISTRATION_STATUS.UNPAID,
    status_updated_at: now,
    ...registrationOverrides,
  });
  datastoreService.saveRegistration(registration);
  for (const record of paymentRecords) {
    datastoreService.createPaymentRecord(createPaymentTransaction(record));
  }

  const loggingService = loggerSink ? createLoggingService({ sink: loggerSink }) : createLoggingService();
  const auditService = createAuditService({ logger: auditSink || loggerSink || { log() {} } });
  const messageService = createMessageService();
  const paymentService = createPaymentService({
    datastoreService,
    messageService,
    auditService,
    loggingService,
    clock: () => new Date(now),
  });

  const { server } = createAppServer({
    datastoreService,
    paymentService,
    messageService,
    auditService,
    loggingService,
  });

  return { server, datastoreService, paymentService, registration, loggingService };
}

function authHeaders(userId = "attendee_1") {
  return { host: "localhost", "x-user-id": userId, accept: "application/json" };
}

function jsonBody(payload) {
  return JSON.stringify(payload);
}

function assertNoCardData(payload) {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("4111"), false);
  assert.equal(serialized.toLowerCase().includes("cvv"), false);
  assert.equal(serialized.toLowerCase().includes("pan"), false);
}

test("AT-UC21-01 — Successful Online Payment Updates Registration Status (Main Success Scenario)", async () => {
  const { server, datastoreService } = createFixture();

  const initiate = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });
  assert.equal(initiate.status, 200);
  const initiatePayload = parseJson(initiate);
  assert.equal(initiatePayload.status_code, "pending_confirmation");

  const pending = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const pendingPayload = parseJson(pending);
  assert.equal(pendingPayload.status_code, "pending_confirmation");

  const confirm = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: datastoreService.getLatestPaymentRecord("R1").gateway_reference,
    registration_id: "R1",
    status: "succeeded",
  }));
  const confirmPayload = parseJson(confirm);
  assert.equal(confirmPayload.outcome, "processed");
  assert.equal(confirmPayload.status.status_code, "paid_confirmed");

  const status = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const statusPayload = parseJson(status);
  assert.equal(statusPayload.status_code, "paid_confirmed");
  assert.equal(statusPayload.message.includes("Payment confirmed"), true);
});

test("AT-UC21-02 — Payment Record Visible in Attendee Account (Post-Condition Verification)", async () => {
  const now = "2026-02-01T12:00:00.000Z";
  const { server } = createFixture({
    registrationOverrides: { status: REGISTRATION_STATUS.PAID_CONFIRMED, status_updated_at: now },
    paymentRecords: [
      {
        registration_id: "R1",
        amount: 200,
        status: PAYMENT_TRANSACTION_STATUS.SUCCEEDED,
        created_at: now,
        confirmed_at: now,
        gateway_reference: "gw_123",
        currency: "USD",
      },
    ],
    now,
  });

  const status = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const statusPayload = parseJson(status);
  assert.equal(statusPayload.status_code, "paid_confirmed");

  const records = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-records",
    headers: authHeaders(),
  });
  const recordsPayload = parseJson(records);
  assert.equal(recordsPayload.records.length, 1);
  const record = recordsPayload.records[0];
  assert.equal(record.amount, 200);
  assert.equal(record.gatewayReference, "gw_123");
});

test("AT-UC21-03 — Invalid/Incomplete Payment Details Rejected (Extension 6a)", async () => {
  const { server } = createFixture();

  const confirm = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: "gw_invalid",
    registration_id: "R1",
    status: "failed",
  }));
  const payload = parseJson(confirm);
  assert.equal(payload.status.status_code, "unpaid");

  const status = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const statusPayload = parseJson(status);
  assert.equal(statusPayload.status_code, "unpaid");
  assert.equal(statusPayload.reason_code, "invalid_details");
});

test("AT-UC21-04 — Payment Declined by Gateway (Extension 7a)", async () => {
  const { server } = createFixture();

  const confirm = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: "gw_declined",
    registration_id: "R1",
    status: "declined",
  }));
  const payload = parseJson(confirm);
  assert.equal(payload.status.status_code, "unpaid");

  const status = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const statusPayload = parseJson(status);
  assert.equal(statusPayload.status_code, "unpaid");
  assert.equal(statusPayload.reason_code, "declined");
});

test("AT-UC21-05 — Payment Gateway Unavailable Before Payment (Extension 5a)", async () => {
  const datastoreService = createDatastoreService();
  datastoreService.saveRegistration(
    createRegistration({
      registration_id: "R1",
      attendee_id: "T1",
      category: "Regular",
      fee_amount: 200,
      status: REGISTRATION_STATUS.UNPAID,
    })
  );

  datastoreService.savePaymentAndRegistration = () => {
    throw new Error("gateway_down");
  };

  const loggingService = createLoggingService();
  const messageService = createMessageService();
  const auditService = createAuditService({ logger: { log() {} } });
  const paymentService = createPaymentService({
    datastoreService,
    messageService,
    auditService,
    loggingService,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  const { server } = createAppServer({ datastoreService, paymentService, messageService, auditService });

  const response = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });
  assert.equal(response.status, 503);
  const payload = parseJson(response);
  assert.equal(payload.code, "service_unavailable");
});

test("AT-UC21-06 — Idempotency: Duplicate Callback Does Not Double-Charge/Double-Record", async () => {
  const { server, datastoreService } = createFixture();

  const initiate = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });
  assert.equal(initiate.status, 200);

  const reference = datastoreService.getLatestPaymentRecord("R1").gateway_reference;
  const payload = {
    gateway_reference: reference,
    registration_id: "R1",
    status: "succeeded",
  };

  const first = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody(payload));
  const firstPayload = parseJson(first);
  assert.equal(firstPayload.outcome, "processed");

  const second = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody(payload));
  const secondPayload = parseJson(second);
  assert.equal(secondPayload.outcome, "duplicate_ignored");

  const records = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-records",
    headers: authHeaders(),
  });
  const recordsPayload = parseJson(records);
  assert.equal(recordsPayload.records.length, 1);
});

test("AT-UC21-07 — Security: Only Logged-In Attendee Can Initiate Payment", async () => {
  const { server } = createFixture();

  const response = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: { host: "localhost", accept: "application/json" },
  });

  assert.equal(response.status, 401);
  const payload = parseJson(response);
  assert.equal(payload.code, "auth_required");
});

test("AT-UC21-08 — Already Paid: Block Additional Payment Attempts", async () => {
  const now = "2026-02-01T12:00:00.000Z";
  const { server } = createFixture({
    registrationOverrides: { status: REGISTRATION_STATUS.PAID_CONFIRMED, status_updated_at: now },
    paymentRecords: [
      {
        registration_id: "R1",
        amount: 200,
        status: PAYMENT_TRANSACTION_STATUS.SUCCEEDED,
        created_at: now,
        confirmed_at: now,
        gateway_reference: "gw_paid",
        currency: "USD",
      },
    ],
    now,
  });

  const response = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });
  assert.equal(response.status, 409);
  const payload = parseJson(response);
  assert.equal(payload.status.status_code, "paid_confirmed");
  assert.equal(payload.latestRecord.gatewayReference, "gw_paid");
});

test("AT-UC21-09 — Pending Confirmation Exceeds 24 Hours", async () => {
  const past = "2026-01-31T08:00:00.000Z";
  const now = "2026-02-01T10:00:00.000Z";
  const { server } = createFixture({
    registrationOverrides: {
      status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
      status_updated_at: past,
    },
    now,
  });

  const response = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const payload = parseJson(response);
  assert.equal(payload.status_code, "unpaid");
  assert.equal(payload.reason_code, "pending_timeout");
});

test("AT-UC21-10 — Delayed Confirmation Shows Pending Status", async () => {
  const { server, datastoreService } = createFixture();

  const initiate = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });
  const initiatePayload = parseJson(initiate);
  assert.equal(initiatePayload.status_code, "pending_confirmation");

  const pending = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  const pendingPayload = parseJson(pending);
  assert.equal(pendingPayload.status_code, "pending_confirmation");

  const confirm = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: datastoreService.getLatestPaymentRecord("R1").gateway_reference,
    registration_id: "R1",
    status: "succeeded",
  }));
  const confirmPayload = parseJson(confirm);
  assert.equal(confirmPayload.status.status_code, "paid_confirmed");
});

test("AT-UC21-11 — Security: No Raw Card Data Stored or Logged", async () => {
  const logs = [];
  const loggerSink = {
    log(entry) {
      logs.push(entry);
    },
  };
  const { server } = createFixture({ loggerSink });

  await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });

  await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: "gw_secure",
    registration_id: "R1",
    status: "succeeded",
    card_number: "4111111111111111",
    cvv: "123",
  }));

  const records = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-records",
    headers: authHeaders(),
  });
  const recordsPayload = parseJson(records);
  assertNoCardData(recordsPayload);

  logs.forEach((entry) => assertNoCardData(entry));
});

test("AT-UC21-12 — Security: Audit Events for Payment Attempts", async () => {
  const auditEntries = [];
  const auditLogger = {
    log(entry) {
      auditEntries.push(entry);
    },
  };

  const { server } = createFixture({ auditSink: auditLogger });

  await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });

  await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: "gw_success",
    registration_id: "R1",
    status: "succeeded",
  }));

  await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, jsonBody({
    gateway_reference: "gw_fail",
    registration_id: "R1",
    status: "failed",
  }));

  const events = auditEntries.map((entry) => JSON.parse(entry).event);
  assert.equal(events.includes("payment_initiated"), true);
  assert.equal(events.includes("payment_confirmed"), true);
  assert.equal(events.includes("payment_failed"), true);
});
