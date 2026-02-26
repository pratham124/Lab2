const test = require("node:test");
const assert = require("node:assert/strict");

const { createPaymentController } = require("../../src/controllers/payment_controller");
const { createMessageService } = require("../../src/services/message_service");

function parseJson(response) {
  return JSON.parse(response.body);
}

function makeGuard(ok = true) {
  return {
    requireAttendee() {
      if (ok) {
        return { ok: true, actor: { id: "A1" } };
      }
      return { ok: false, response: { status: 401, headers: {}, body: JSON.stringify({ code: "auth_required" }) } };
    },
  };
}

test("payment controller handles initiate JSON branches", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      initiatePayment() { return { type: "not_found" }; },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const notFound = await controller.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(notFound.status, 404);
  assert.equal(parseJson(notFound).code, "not_found");

  const unavailableController = createPaymentController({
    paymentService: { initiatePayment() { return { type: "service_unavailable" }; } },
    messageService,
    authGuard: makeGuard(true),
  });
  const unavailable = await unavailableController.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(unavailable.status, 503);

  const alreadyPaidController = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "already_paid",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
          latestRecord: {
            amount: 200,
            currency: "USD",
            created_at: "2026-02-01",
            confirmed_at: "2026-02-01",
            gateway_reference: "gw_1",
          },
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });
  const alreadyPaid = await alreadyPaidController.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(alreadyPaid.status, 409);
  assert.equal(parseJson(alreadyPaid).status.status_code, "paid_confirmed");

  const initiatedController = createPaymentController({
    paymentService: {
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R1", status: "pending_confirmation" } };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });
  const initiated = await initiatedController.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(initiated.status, 200);
  assert.equal(parseJson(initiated).status_code, "pending_confirmation");

  const pendingController = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "pending",
          registration: { registration_id: "R1", status: "pending_confirmation", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });
  const pending = await pendingController.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(pending.status, 200);

  const alreadyPaidNoRecord = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "already_paid",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });
  const alreadyPaidJson = await alreadyPaidNoRecord.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(alreadyPaidJson.status, 409);
});

test("payment controller default response service branches", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      initiatePayment() { return { type: "service_unavailable" }; },
      getPaymentStatus() { return { type: "not_found" }; },
      getPaymentRecords() { return { type: "not_found" }; },
      getRegistrationSummary() { return { type: "not_found" }; },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const initiate = await controller.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(initiate.status, 503);

  const status = await controller.handleStatus({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(status.status, 404);

  const records = await controller.handleRecords({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(records.status, 404);

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(page.status, 404);
});

test("payment controller handleInitiate with no auth guard", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R1", status: "pending_confirmation" } };
      },
    },
    messageService,
  });
  const response = await controller.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(response.status, 200);
});

test("payment controller handles missing params and no guard", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() { return { type: "not_found" }; },
      getPaymentStatus() { return { type: "not_found" }; },
      initiatePayment() { return { type: "not_found" }; },
      getPaymentRecords() { return { type: "not_found" }; },
    },
    messageService,
  });

  const getPage = await controller.handleGetInitiatePage({ headers: { accept: "text/html" } });
  assert.equal(getPage.status, 404);

  const initiate = await controller.handleInitiate({ headers: { accept: "text/html" } });
  assert.equal(initiate.status, 404);

  const status = await controller.handleStatus({ headers: { accept: "application/json" } });
  assert.equal(status.status, 404);

  const records = await controller.handleRecords({ headers: { accept: "application/json" } });
  assert.equal(records.status, 404);
});

test("payment controller initiate already paid HTML with no latestRecord", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "already_paid",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const response = await controller.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("No payment records yet."), true);
});

test("payment controller uses default message service and renders status message", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R1", fee_amount: 200, status: "unpaid", status_updated_at: "2026-02-01" },
        };
      },
      getPaymentStatus() {
        return {
          type: "success",
          registration: {
            registration_id: "R1",
            status: "pending_confirmation",
            status_updated_at: "2026-02-01",
            status_reason: "pending_timeout",
          },
        };
      },
    },
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("payment-status"), true);
  assert.equal(page.body.includes("Payment confirmation timed out"), true);
});

test("payment controller initiate page renders default status label and empty status note", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R20", fee_amount: 100, status: "unpaid" },
        };
      },
      getPaymentStatus() {
        return { type: "success", registration: null };
      },
    },
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R20" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Unpaid"), true);
  assert.equal(page.body.includes("payment-status"), false);
});

test("payment controller initiate page handles empty status message", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R40", fee_amount: 100, status: "unpaid" },
        };
      },
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R40", status: "unpaid" } };
      },
    },
    messageService: {
      buildStatusResponse() {
        return { status_label: "Unpaid", message: "", reason_code: "" };
      },
      errorForCode: createMessageService().errorForCode,
    },
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R40" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("payment-status"), false);
});

test("payment controller initiate page handles undefined headers", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R42", fee_amount: 100, status: "unpaid" },
        };
      },
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R42", status: "unpaid" } };
      },
    },
    messageService: createMessageService(),
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: undefined,
    params: { registration_id: "R42" },
  });
  assert.equal(page.status, 200);
});

test("payment controller initiate page accepts summary message without rendering", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R23", fee_amount: 75, status: "unpaid" },
          message: "Additional info.",
        };
      },
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R23", status: "unpaid", status_updated_at: "2026-02-01" },
        };
      },
    },
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R23" },
  });
  assert.equal(page.status, 200);
});

test("payment controller default message service handles null status response", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R9", fee_amount: null, status: "unpaid" },
        };
      },
      getPaymentStatus() {
        return { type: "success", registration: null };
      },
    },
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R9" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("TBD"), true);
  assert.equal(page.body.includes("Unpaid"), true);
});

test("payment controller renderStatusPage handles empty statusResponse", async () => {
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R1" }, latestRecord: null };
      },
    },
    messageService: createMessageService(),
    authGuard: makeGuard(true),
  });

  const response = await controller.handleStatus({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Payment Status"), true);
});

test("payment controller renderStatusPage lists records with fallback status labels", async () => {
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R2" },
          latestRecord: {
            amount: 120,
            currency: "USD",
            created_at: "2026-02-01T10:00:00.000Z",
            confirmed_at: "2026-02-01T10:01:00.000Z",
            gateway_reference: "gw_r2",
          },
        };
      },
    },
    messageService: {
      buildStatusResponse() {
        return { status_label: "", message: "", reason_code: "" };
      },
    },
    authGuard: makeGuard(true),
  });

  const response = await controller.handleStatus({
    headers: { accept: "text/html" },
    params: { registration_id: "R2" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("gw_r2"), true);
});

test("payment controller renderStatusPage uses provided status message", async () => {
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R24" },
          latestRecord: null,
        };
      },
    },
    messageService: {
      buildStatusResponse() {
        return { status_label: "Pending", message: "Waiting for gateway", reason_code: "" };
      },
    },
    authGuard: makeGuard(true),
  });

  const response = await controller.handleStatus({
    headers: { accept: "text/html" },
    params: { registration_id: "R24" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Waiting for gateway"), true);
});

test("payment controller renderStatusPage includes record list and formatted amount fallback", async () => {
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R21" },
          latestRecord: {
            amount: 50,
            currency: "INVALID",
            created_at: "2026-02-01T10:00:00.000Z",
            confirmed_at: "2026-02-01T10:01:00.000Z",
            gateway_reference: "gw_r21",
          },
        };
      },
    },
    messageService: {
      buildStatusResponse() {
        return { status_label: "", message: "", reason_code: "" };
      },
    },
    authGuard: makeGuard(true),
  });

  const response = await controller.handleStatus({
    headers: { accept: "text/html" },
    params: { registration_id: "R21" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("gw_r21"), true);
  assert.equal(response.body.includes("INVALID"), true);
});

test("payment controller html initiate uses reason code", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return {
          type: "success",
          registration: { registration_id: "R1", fee_amount: 200, status: "unpaid", status_updated_at: "2026-02-01" },
        };
      },
      getPaymentStatus() {
        return {
          type: "success",
          registration: {
            registration_id: "R1",
            status: "unpaid",
            status_reason: "declined",
            status_updated_at: "2026-02-01",
          },
        };
      },
    },
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("declined"), true);
});

test("payment controller returns auth guard response", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() { return { type: "success", registration: { registration_id: "R1" } }; },
      getPaymentStatus() { return { type: "success", registration: { registration_id: "R1" } }; },
      initiatePayment() { return { type: "initiated", registration: { registration_id: "R1", status: "pending_confirmation" } }; },
      getPaymentRecords() { return { type: "success", records: [] }; },
    },
    authGuard: makeGuard(false),
  });

  const getPage = await controller.handleGetInitiatePage({ headers: { accept: "text/html" }, params: { registration_id: "R1" } });
  assert.equal(getPage.status, 401);

  const initiate = await controller.handleInitiate({ headers: { accept: "application/json" }, params: { registration_id: "R1" } });
  assert.equal(initiate.status, 401);

  const status = await controller.handleStatus({ headers: { accept: "application/json" }, params: { registration_id: "R1" } });
  assert.equal(status.status, 401);

  const records = await controller.handleRecords({ headers: { accept: "application/json" }, params: { registration_id: "R1" } });
  assert.equal(records.status, 401);
});

test("payment controller confirm uses default payload and maps records", async () => {
  const controller = createPaymentController({
    paymentService: {
      confirmPayment() {
        return { type: "validation_error" };
      },
      getPaymentRecords() {
        return {
          type: "success",
          records: [
            {
              amount: 90,
              currency: "USD",
              created_at: "2026-02-01T10:00:00.000Z",
              confirmed_at: "2026-02-01T10:01:00.000Z",
              gateway_reference: "gw_r3",
            },
          ],
        };
      },
    },
    messageService: createMessageService(),
    authGuard: makeGuard(true),
  });

  const confirm = await controller.handleConfirm();
  assert.equal(confirm.status, 400);

  const records = await controller.handleRecords({
    headers: { accept: "application/json" },
    params: { registration_id: "R3" },
  });
  const payload = parseJson(records);
  assert.equal(payload.records[0].gatewayReference, "gw_r3");
});

test("payment controller wantsJson uses content-type header", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R30", status: "pending_confirmation" } };
      },
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R30", status: "unpaid" } };
      },
      getPaymentRecords() {
        return { type: "success", records: [] };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const initiated = await controller.handleInitiate({
    headers: { "content-type": "application/json" },
    params: { registration_id: "R30" },
  });
  assert.equal(initiated.status, 200);

  const status = await controller.handleStatus({
    headers: { "content-type": "application/json" },
    params: { registration_id: "R30" },
  });
  assert.equal(status.status, 200);

  const records = await controller.handleRecords({
    headers: { "content-type": "application/json" },
    params: { registration_id: "R30" },
  });
  assert.equal(records.status, 200);
});

test("payment controller works without auth guard for status and records", async () => {
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R31", status: "unpaid" } };
      },
      getPaymentRecords() {
        return { type: "success", records: undefined };
      },
      getRegistrationSummary() {
        return { type: "success", registration: { registration_id: "R31", fee_amount: 120, status: "unpaid" } };
      },
    },
    messageService: createMessageService(),
  });

  const status = await controller.handleStatus({
    headers: { accept: "application/json" },
    params: { registration_id: "R31" },
  });
  assert.equal(status.status, 200);

  const records = await controller.handleRecords({
    headers: { accept: "application/json" },
    params: { registration_id: "R31" },
  });
  assert.equal(records.status, 200);
});

test("payment controller defaults headers when missing", async () => {
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return { type: "success", registration: { registration_id: "R41", fee_amount: 110, status: "unpaid" } };
      },
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R41", status: "unpaid" } };
      },
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R41", status: "pending_confirmation" } };
      },
      getPaymentRecords() {
        return { type: "success", records: [] };
      },
    },
    messageService: createMessageService(),
  });

  const getPage = await controller.handleGetInitiatePage({ params: { registration_id: "R41" } });
  assert.equal(getPage.status, 200);

  const initiate = await controller.handleInitiate({ params: { registration_id: "R41" } });
  assert.equal(initiate.status, 200);

  const status = await controller.handleStatus({ params: { registration_id: "R41" } });
  assert.equal(status.status, 200);

  const records = await controller.handleRecords({ params: { registration_id: "R41" } });
  assert.equal(records.status, 200);
});

test("payment controller handles confirm/status/records branches", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      confirmPayment() { return { type: "validation_error" }; },
      getPaymentStatus() { return { type: "not_found" }; },
      getPaymentRecords() { return { type: "not_found" }; },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const confirmValidation = await controller.handleConfirm({ body: {} });
  assert.equal(confirmValidation.status, 400);
  assert.equal(parseJson(confirmValidation).code, "missing_parameters");

  const confirmNotFoundController = createPaymentController({
    paymentService: { confirmPayment() { return { type: "not_found" }; } },
    messageService,
    authGuard: makeGuard(true),
  });
  const confirmNotFound = await confirmNotFoundController.handleConfirm({ body: { gateway_reference: "gw", registration_id: "R1" } });
  assert.equal(confirmNotFound.status, 404);

  const confirmDuplicateController = createPaymentController({
    paymentService: { confirmPayment() { return { type: "duplicate", registration: { registration_id: "R1", status: "paid_confirmed" } }; } },
    messageService,
    authGuard: makeGuard(true),
  });
  const confirmDuplicate = await confirmDuplicateController.handleConfirm({ body: { gateway_reference: "gw", registration_id: "R1" } });
  assert.equal(parseJson(confirmDuplicate).outcome, "duplicate_ignored");

  const confirmProcessedController = createPaymentController({
    paymentService: { confirmPayment() { return { type: "processed", registration: { registration_id: "R1", status: "paid_confirmed" } }; } },
    messageService,
    authGuard: makeGuard(true),
  });
  const confirmProcessed = await confirmProcessedController.handleConfirm({ body: { gateway_reference: "gw", registration_id: "R1" } });
  assert.equal(parseJson(confirmProcessed).outcome, "processed");

  const status = await controller.handleStatus({ headers: { accept: "application/json" }, params: { registration_id: "R1" } });
  assert.equal(status.status, 404);

  const records = await controller.handleRecords({ headers: { accept: "application/json" }, params: { registration_id: "R1" } });
  assert.equal(records.status, 404);

  const noAuthController = createPaymentController({
    paymentService: { initiatePayment() { return { type: "initiated", registration: { registration_id: "R1" } }; } },
    messageService,
    authGuard: { requireAttendee() { return { ok: true }; } },
  });
  const noActor = await noAuthController.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(noActor.status, 200);
});

test("payment controller handles confirm duplicate with null registration", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: { confirmPayment() { return { type: "duplicate", registration: null }; } },
    messageService,
    authGuard: makeGuard(true),
  });

  const response = await controller.handleConfirm({ body: { gateway_reference: "gw", registration_id: "R1" } });
  const payload = parseJson(response);
  assert.equal(payload.outcome, "duplicate_ignored");
  assert.equal(payload.status, null);
});

test("payment controller enforces auth guard", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: { initiatePayment() { return { type: "initiated", registration: { registration_id: "R1" } }; } },
    messageService,
    authGuard: makeGuard(false),
  });

  const response = await controller.handleInitiate({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(response.status, 401);
});

test("payment controller HTML responses for initiate and status", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() { return { type: "success", registration: { registration_id: "R1", fee_amount: 200, status: "unpaid", status_updated_at: "2026-02-01" } }; },
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R1", status: "unpaid", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R1", status: "pending_confirmation", status_updated_at: "2026-02-01" } };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Pay Your Registration Fee"), true);

  const initiateHtml = await controller.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(initiateHtml.status, 200);
  assert.equal(initiateHtml.body.includes("Payment Status"), true);
});

test("payment controller HTML formatting and wantsJson content-type branch", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return { type: "success", registration: { registration_id: "R1", fee_amount: null, status: "unpaid", status_updated_at: "2026-02-01" } };
      },
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R1", status: "unpaid", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R1", status: "pending_confirmation", status_updated_at: "2026-02-01" } };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const original = Intl.NumberFormat;
  Intl.NumberFormat = function () {
    return { format() { throw new Error("format_fail"); } };
  };

  const fallbackController = createPaymentController({
    paymentService: {
      getRegistrationSummary() {
        return { type: "success", registration: { registration_id: "R1", fee_amount: 200, status: "unpaid", status_updated_at: "2026-02-01" } };
      },
      getPaymentStatus() {
        return { type: "success", registration: { registration_id: "R1", status: "unpaid", status_updated_at: "2026-02-01" }, latestRecord: null };
      },
      initiatePayment() {
        return { type: "initiated", registration: { registration_id: "R1", status: "pending_confirmation", status_updated_at: "2026-02-01" } };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const page = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("TBD"), true);

  const fallbackPage = await fallbackController.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(fallbackPage.body.includes("200 USD"), true);

  const jsonResponse = await controller.handleInitiate({
    headers: { "content-type": "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(jsonResponse.status, 200);
  assert.equal(parseJson(jsonResponse).status_code, "pending_confirmation");

  Intl.NumberFormat = original;
});

test("payment controller HTML error paths", async () => {
  const messageService = createMessageService();
  const notFoundController = createPaymentController({
    paymentService: { initiatePayment() { return { type: "not_found" }; } },
    messageService,
    authGuard: makeGuard(true),
  });
  const notFound = await notFoundController.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body.includes("Registration not found"), true);

  const unavailableController = createPaymentController({
    paymentService: { initiatePayment() { return { type: "service_unavailable" }; } },
    messageService,
    authGuard: makeGuard(true),
  });
  const unavailable = await unavailableController.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.includes("Payment service unavailable"), true);

  const alreadyPaidController = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "already_paid",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
          latestRecord: { amount: 200, currency: "USD", created_at: "2026-02-01", gateway_reference: "gw_paid" },
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });
  const alreadyPaid = await alreadyPaidController.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(alreadyPaid.status, 200);
  assert.equal(alreadyPaid.body.includes("Payment Records"), true);
});

test("payment controller confirm success branch", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      confirmPayment() {
        return {
          type: "processed",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const response = await controller.handleConfirm({
    body: { gateway_reference: "gw", registration_id: "R1", status: "succeeded" },
  });
  assert.equal(response.status, 200);
  assert.equal(parseJson(response).outcome, "processed");
});

test("payment controller status HTML rendering with records", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
          latestRecord: { amount: 200, currency: "USD", created_at: "2026-02-01", gateway_reference: "gw_1" },
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const response = await controller.handleStatus({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Payment Records"), true);
  assert.equal(response.body.includes("gw_1"), true);
});

test("payment controller status HTML rendering with no records", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R1", status: "unpaid", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const response = await controller.handleStatus({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("No payment records yet."), true);
});

test("payment controller initiate HTML renders payment record variants", async () => {
  const messageService = createMessageService();
  const controllerWithPayment = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "initiated",
          registration: { registration_id: "R1", status: "pending_confirmation", status_updated_at: "2026-02-01" },
          payment: { amount: 200, currency: "USD", created_at: "2026-02-01", gateway_reference: "gw_pay" },
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const htmlWithPayment = await controllerWithPayment.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(htmlWithPayment.status, 200);
  assert.equal(htmlWithPayment.body.includes("gw_pay"), true);

  const controllerWithLatest = createPaymentController({
    paymentService: {
      initiatePayment() {
        return {
          type: "pending",
          registration: { registration_id: "R1", status: "pending_confirmation", status_updated_at: "2026-02-01" },
          latestRecord: { amount: 200, currency: "USD", created_at: "2026-02-01", gateway_reference: "gw_latest" },
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const htmlWithLatest = await controllerWithLatest.handleInitiate({
    headers: { accept: "text/html" },
    params: { registration_id: "R1" },
  });
  assert.equal(htmlWithLatest.status, 200);
  assert.equal(htmlWithLatest.body.includes("gw_latest"), true);
});

test("payment controller status JSON and records mapping", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getPaymentStatus() {
        return {
          type: "success",
          registration: { registration_id: "R1", status: "paid_confirmed", status_updated_at: "2026-02-01" },
          latestRecord: null,
        };
      },
      getPaymentRecords() {
        return {
          type: "success",
          registration: { registration_id: "R1" },
          records: [
            { amount: 200, currency: "USD", created_at: "2026-02-01", confirmed_at: "2026-02-01", gateway_reference: "gw_r" },
          ],
        };
      },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const statusJson = await controller.handleStatus({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  assert.equal(statusJson.status, 200);
  assert.equal(parseJson(statusJson).status_code, "paid_confirmed");

  const records = await controller.handleRecords({
    headers: { accept: "application/json" },
    params: { registration_id: "R1" },
  });
  const payload = parseJson(records);
  assert.equal(payload.records[0].gatewayReference, "gw_r");
  assert.equal(payload.records[0].confirmedAt, "2026-02-01");
});

test("payment controller auth guard failures for get/initiate/status/records", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() { return { type: "not_found" }; },
      getPaymentStatus() { return { type: "not_found" }; },
      getPaymentRecords() { return { type: "not_found" }; },
    },
    messageService,
    authGuard: makeGuard(false),
  });

  const getPage = await controller.handleGetInitiatePage({ headers: {}, params: { registration_id: "R1" } });
  assert.equal(getPage.status, 401);

  const status = await controller.handleStatus({ headers: {}, params: { registration_id: "R1" } });
  assert.equal(status.status, 401);

  const records = await controller.handleRecords({ headers: {}, params: { registration_id: "R1" } });
  assert.equal(records.status, 401);
});

test("payment controller get initiate page not_found", async () => {
  const messageService = createMessageService();
  const controller = createPaymentController({
    paymentService: {
      getRegistrationSummary() { return { type: "not_found" }; },
      getPaymentStatus() { return { type: "not_found" }; },
    },
    messageService,
    authGuard: makeGuard(true),
  });

  const response = await controller.handleGetInitiatePage({
    headers: { accept: "text/html" },
    params: { registration_id: "R_missing" },
  });
  assert.equal(response.status, 404);
  assert.equal(response.body.includes("Registration not found"), true);
});

test("payment controller requires payment service", () => {
  assert.throws(() => createPaymentController(), /paymentService is required/);
});
