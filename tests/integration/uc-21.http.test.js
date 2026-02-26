const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");
const { createDatastoreService } = require("../../src/services/datastore_service");
const { createPaymentService } = require("../../src/services/payment_service");
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

function authHeaders() {
  return { host: "localhost", "x-user-id": "attendee_1", accept: "application/json" };
}

function seedRegistration(datastore, overrides = {}) {
  const registration = createRegistration({
    registration_id: "R1",
    attendee_id: "T1",
    category: "Regular",
    fee_amount: 200,
    status: REGISTRATION_STATUS.UNPAID,
    status_updated_at: "2026-02-01T10:00:00.000Z",
    ...overrides,
  });
  datastore.saveRegistration(registration);
  return registration;
}

test("UC-21 integration happy path: initiate -> pending -> confirm -> paid", async () => {
  const datastore = createDatastoreService();
  seedRegistration(datastore);

  const { server } = createAppServer({ datastoreService: datastore });

  const page = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment",
    headers: { host: "localhost", accept: "text/html", "x-user-id": "attendee_1" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Pay Your Registration Fee"), true);

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
  assert.equal(pending.status, 200);
  assert.equal(parseJson(pending).status_code, "pending_confirmation");

  const reference = datastore.getLatestPaymentRecord("R1").gateway_reference;
  const confirm = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, JSON.stringify({
    gateway_reference: reference,
    registration_id: "R1",
    status: "succeeded",
  }));
  assert.equal(confirm.status, 200);
  assert.equal(parseJson(confirm).status.status_code, "paid_confirmed");

  const status = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });
  assert.equal(parseJson(status).status_code, "paid_confirmed");

  const records = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-records",
    headers: authHeaders(),
  });
  const recordsPayload = parseJson(records);
  assert.equal(recordsPayload.records.length, 1);
  assert.equal(recordsPayload.records[0].gatewayReference, reference);
});

test("UC-21 integration invalid input: confirmation missing required fields", async () => {
  const { server } = createAppServer({ datastoreService: createDatastoreService() });

  const response = await injectRequest(server, {
    method: "POST",
    path: "/payments/confirm",
    headers: { host: "localhost", "content-type": "application/json" },
  }, JSON.stringify({}));

  assert.equal(response.status, 400);
  assert.equal(parseJson(response).code, "missing_parameters");
});

test("UC-21 integration expected failure: auth required for initiate", async () => {
  const datastore = createDatastoreService();
  seedRegistration(datastore);
  const { server } = createAppServer({ datastoreService: datastore });

  const response = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: { host: "localhost", accept: "application/json" },
  });

  assert.equal(response.status, 401);
  assert.equal(parseJson(response).code, "auth_required");
});

test("UC-21 integration expected failure: already paid blocks initiation", async () => {
  const datastore = createDatastoreService();
  seedRegistration(datastore, {
    status: REGISTRATION_STATUS.PAID_CONFIRMED,
    status_updated_at: "2026-02-01T09:00:00.000Z",
  });
  datastore.createPaymentRecord(
    createPaymentTransaction({
      registration_id: "R1",
      amount: 200,
      status: PAYMENT_TRANSACTION_STATUS.SUCCEEDED,
      created_at: "2026-02-01T09:00:00.000Z",
      confirmed_at: "2026-02-01T09:00:00.000Z",
      gateway_reference: "gw_paid",
      currency: "USD",
    })
  );

  const { server } = createAppServer({ datastoreService: datastore });
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

test("UC-21 integration expected failure: pending confirmation timeout", async () => {
  const datastore = createDatastoreService();
  seedRegistration(datastore, {
    status: REGISTRATION_STATUS.PENDING_CONFIRMATION,
    status_updated_at: "2026-01-30T08:00:00.000Z",
  });
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });

  const { server } = createAppServer({ datastoreService: datastore, paymentService });
  const response = await injectRequest(server, {
    method: "GET",
    path: "/registrations/R1/payment-status",
    headers: authHeaders(),
  });

  const payload = parseJson(response);
  assert.equal(payload.status_code, "unpaid");
  assert.equal(payload.reason_code, "pending_timeout");
});

test("UC-21 integration expected failure: service unavailable during initiation", async () => {
  const datastore = createDatastoreService();
  seedRegistration(datastore);
  datastore.savePaymentAndRegistration = () => {
    throw new Error("gateway_down");
  };
  const paymentService = createPaymentService({
    datastoreService: datastore,
    clock: () => new Date("2026-02-01T10:00:00.000Z"),
  });

  const { server } = createAppServer({ datastoreService: datastore, paymentService });
  const response = await injectRequest(server, {
    method: "POST",
    path: "/registrations/R1/payment/initiate",
    headers: authHeaders(),
  });

  assert.equal(response.status, 503);
  assert.equal(parseJson(response).code, "service_unavailable");
});
