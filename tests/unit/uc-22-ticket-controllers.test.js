const test = require("node:test");
const assert = require("node:assert/strict");

const { createPaymentConfirmationsController } = require("../../src/controllers/payment_confirmations_controller");
const { createAttendeeTicketsController } = require("../../src/controllers/attendee_tickets_controller");
const responseService = require("../../src/services/response_service");

function jsonHeaders() {
  return { accept: "application/json" };
}

function createAuthGuard({ ok = true, actorId = "T1" } = {}) {
  return {
    requireAttendee() {
      if (!ok) {
        return {
          ok: false,
          response: responseService.json(401, { errorCode: "auth_required" }),
        };
      }
      return { ok: true, actor: { id: actorId } };
    },
  };
}

test("paymentConfirmationsController handles validation, errors, duplicate, and success", async () => {
  const confirmationTicketService = {
    async createTicketFromConfirmation() {
      return { type: "validation_error", status: 400 };
    },
    listDeliveryAttempts() {
      return [];
    },
  };

  const controller = createPaymentConfirmationsController({ confirmationTicketService });

  const invalid = await controller.handleCreate({ headers: jsonHeaders(), body: {} });
  assert.equal(invalid.status, 400);
  assert.equal(JSON.parse(invalid.body).code, "invalid_confirmation");

  const errorController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return { type: "error", status: 500 };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
  });
  const failure = await errorController.handleCreate({ headers: jsonHeaders(), body: {} });
  assert.equal(failure.status, 500);
  assert.equal(JSON.parse(failure.body).code, "ticket_generation_failed");

  const duplicateController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return {
          type: "duplicate",
          status: 200,
          ticket: {
            ticket_id: "T-1",
            attendee_id: "T1",
            payment_reference: "PAY-1",
            invoice_number: "INV-1",
            amount: 200,
            registration_status: "Paid",
            issued_at: "2026-02-01T00:00:00.000Z",
            retention_expires_at: "2026-05-01T00:00:00.000Z",
          },
        };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
    auditLog: { logDuplicateConfirmation() {} },
  });

  const duplicate = await duplicateController.handleCreate({ headers: jsonHeaders(), body: {} });
  assert.equal(duplicate.status, 200);
  assert.equal(JSON.parse(duplicate.body).ticketId, "T-1");

  const duplicateNullController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return { type: "duplicate", status: 200, ticket: null };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
  });
  const duplicateNull = await duplicateNullController.handleCreate({ headers: jsonHeaders(), body: {} });
  assert.equal(duplicateNull.status, 200);
  assert.equal(JSON.parse(duplicateNull.body), null);

  const auditHit = { called: false };
  const duplicateAuditController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return {
          type: "duplicate",
          status: 200,
          ticket: { ticket_id: "T-A", attendee_id: "T1", payment_reference: "P1" },
        };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
    auditLog: {
      logDuplicateConfirmation() {
        auditHit.called = true;
      },
    },
  });
  const duplicateAudit = await duplicateAuditController.handleCreate({ headers: {}, body: {} });
  assert.equal(duplicateAudit.status, 200);
  assert.equal(auditHit.called, true);

  const htmlDuplicateNull = await duplicateNullController.handleCreate({ headers: {}, body: {} });
  assert.equal(htmlDuplicateNull.status, 200);
  assert.ok(htmlDuplicateNull.body.includes("<title>Payment Confirmation</title>"));
  assert.ok(htmlDuplicateNull.body.includes("Payment confirmation received."));

  const errorBuilderController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return { type: "validation_error", status: 400 };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
    errorResponseBuilder() {
      return {};
    },
  });
  const errorHtml = await errorBuilderController.handleCreate({ headers: {}, body: {} });
  assert.equal(errorHtml.status, 400);
  assert.ok(errorHtml.body.includes("We could not generate your ticket"));
  assert.ok(errorHtml.body.includes("Please try again later"));

  const createdController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return {
          type: "created",
          status: 201,
          ticket: {
            ticket_id: "T-2",
            attendee_id: "T2",
            payment_reference: "PAY-2",
            invoice_number: "INV-2",
            amount: 150,
            registration_status: "Paid",
            issued_at: "2026-02-01T00:00:00.000Z",
            retention_expires_at: "2026-05-01T00:00:00.000Z",
          },
        };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
  });

  const created = await createdController.handleCreate({ headers: jsonHeaders(), body: {} });
  assert.equal(created.status, 201);
  assert.equal(JSON.parse(created.body).ticketId, "T-2");

  const createdDefaultAttempts = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return {
          type: "created",
          status: 201,
          ticket: {
            ticket_id: "T-3",
            attendee_id: "T3",
            payment_reference: "PAY-3",
            invoice_number: "INV-3",
            amount: 150,
            registration_status: "Paid",
            issued_at: "2026-02-01T00:00:00.000Z",
            retention_expires_at: "2026-05-01T00:00:00.000Z",
          },
        };
      },
      listDeliveryAttempts() {
        return undefined;
      },
    },
  });
  const createdDefault = await createdDefaultAttempts.handleCreate({ headers: jsonHeaders(), body: {} });
  assert.equal(createdDefault.status, 201);
  assert.deepEqual(JSON.parse(createdDefault.body).deliveryAttempts, []);

  assert.throws(() => createPaymentConfirmationsController(), {
    message: "confirmationTicketService is required",
  });
});

test("paymentConfirmationsController falls back when headers/body are omitted", async () => {
  const calls = [];
  const audits = [];
  const results = [
    { type: "validation_error", status: 400 },
    { type: "error", status: 500 },
    { type: "duplicate", status: 200, ticket: null },
    { type: "created", status: 201, ticket: null },
  ];

  const controller = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation(payload) {
        calls.push(payload);
        return results.shift();
      },
      listDeliveryAttempts() {
        return [{ delivery_id: "unused" }];
      },
    },
    auditLog: {
      logDuplicateConfirmation(input) {
        audits.push(input);
      },
    },
    errorResponseBuilder() {
      return null;
    },
  });

  const validation = await controller.handleCreate();
  assert.equal(validation.status, 400);
  assert.ok(validation.body.includes("Invalid Confirmation"));

  const failure = await controller.handleCreate();
  assert.equal(failure.status, 500);
  assert.ok(failure.body.includes("Ticket Error"));

  const duplicate = await controller.handleCreate();
  assert.equal(duplicate.status, 200);
  assert.ok(duplicate.body.includes("Payment confirmation received."));
  assert.deepEqual(audits[0], {
    ticketId: "",
    attendeeId: "",
    paymentReference: "",
  });

  const created = await controller.handleCreate();
  assert.equal(created.status, 201);
  assert.ok(created.body.includes("Payment confirmation received."));

  assert.equal(calls.length, 4);
  for (const payload of calls) {
    assert.deepEqual(payload, {
      paymentReference: undefined,
      attendeeId: undefined,
      amount: undefined,
      currency: undefined,
      paymentStatus: undefined,
      confirmedAt: undefined,
      recipientEmail: undefined,
      ticketLink: undefined,
    });
  }
});

test("attendeeTicketsController handles auth, list, forbidden, not found, expired, and success", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [
        {
          ticket_id: "T-1",
          attendee_id: "T1",
          payment_reference: "PAY-1",
          invoice_number: "INV-1",
          amount: 200,
          registration_status: "Paid",
          issued_at: "2026-02-01T00:00:00.000Z",
          retention_expires_at: "2026-05-01T00:00:00.000Z",
        },
      ];
    },
    listDeliveryAttempts() {
      return undefined;
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") {
        return { type: "forbidden", status: 403 };
      }
      if (ticketId === "missing") {
        return { type: "not_found", status: 404 };
      }
      if (ticketId === "expired") {
        return {
          type: "expired",
          status: 410,
          ticket: { ticket_id: "expired" },
        };
      }
      return {
        type: "success",
        status: 200,
        ticket: {
          ticket_id: ticketId,
          attendee_id: "T1",
          payment_reference: "PAY-1",
          invoice_number: "INV-1",
          amount: 200,
          registration_status: "Paid",
          issued_at: "2026-02-01T00:00:00.000Z",
          retention_expires_at: "2026-05-01T00:00:00.000Z",
        },
      };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: jsonHeaders() });
  assert.equal(list.status, 200);
  assert.equal(JSON.parse(list.body).tickets.length, 1);
  assert.deepEqual(JSON.parse(list.body).tickets[0].deliveryAttempts, []);

  const forbidden = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "forbidden" } });
  assert.equal(forbidden.status, 403);

  const notFound = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "missing" } });
  assert.equal(notFound.status, 404);

  const expired = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "expired" } });
  assert.equal(expired.status, 410);

  const success = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "T-1" } });
  assert.equal(success.status, 200);
  assert.equal(JSON.parse(success.body).ticketId, "T-1");

  const deniedController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: false }),
  });
  const denied = await deniedController.handleList({ headers: jsonHeaders() });
  assert.equal(denied.status, 401);

  const deniedGet = await deniedController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "T-1" } });
  assert.equal(deniedGet.status, 401);

  const notFoundJson = await controller.handleGet({
    headers: jsonHeaders(),
    params: { ticket_id: "missing" },
  });
  assert.equal(notFoundJson.status, 404);
  assert.equal(JSON.parse(notFoundJson.body).code, "ticket_not_found");
});

test("attendeeTicketsController serializes null tickets and handles unauthenticated list", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [null];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "not_found", status: 404 };
    },
  };
  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });
  const list = await controller.handleList({ headers: jsonHeaders() });
  assert.equal(list.status, 200);
  assert.deepEqual(JSON.parse(list.body).tickets, [null]);
  assert.equal(JSON.parse(list.body).expiredCount, 0);

  const deniedController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: false }),
  });
  const denied = await deniedController.handleList({ headers: {} });
  assert.equal(denied.status, 401);
});

test("attendeeTicketsController HTML list renders empty state, retention notice, and TBD amount", async () => {
  const ticket = {
    ticket_id: "T-HTML-1",
    attendee_id: "T1",
    payment_reference: "PAY-HTML-1",
    invoice_number: "INV-HTML-1",
    amount: null,
    registration_status: "Paid",
    issued_at: "2026-02-01T00:00:00.000Z",
    retention_expires_at: "2026-05-01T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket];
      }
      return [];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: {} });
  assert.equal(list.status, 200);
  assert.ok(list.body.includes("No tickets available"));
  assert.ok(list.body.includes("retention period ended"));

  const detail = await controller.handleGet({ headers: {}, params: { ticket_id: "T-HTML-1" } });
  assert.equal(detail.status, 200);
  assert.ok(detail.body.includes("TBD"));
});

test("attendeeTicketsController HTML list renders ticket details and formats amount", async () => {
  const ticket = {
    ticket_id: "T-HTML-2",
    attendee_id: "T1",
    payment_reference: "PAY-HTML-2",
    invoice_number: "INV-HTML-2",
    amount: 150,
    registration_status: "Paid",
    issued_at: "2026-02-01T00:00:00.000Z",
    retention_expires_at: "2026-05-01T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket];
      }
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: {} });
  assert.equal(list.status, 200);
  assert.ok(list.body.includes("INV-HTML-2"));
  assert.ok(list.body.includes("$150.00"));
});

test("attendeeTicketsController HTML list renders ticket fields and link", async () => {
  const ticket = {
    ticket_id: "T-HTML-3",
    attendee_id: "T1",
    payment_reference: "PAY-HTML-3",
    invoice_number: "INV-HTML-3",
    amount: 99,
    registration_status: "Paid",
    issued_at: "2026-02-02T00:00:00.000Z",
    retention_expires_at: "2026-05-02T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket, null];
      }
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: {} });
  assert.equal(list.status, 200);
  assert.ok(list.body.includes("INV-HTML-3"));
  assert.ok(list.body.includes("PAY-HTML-3"));
  assert.ok(list.body.includes("2026-02-02"));
  assert.ok(list.body.includes(`/me/tickets/${ticket.ticket_id}`));
});

test("attendeeTicketsController HTML list handles missing ticket fields", async () => {
  const ticket = {
    ticket_id: "",
    attendee_id: "T1",
    payment_reference: "",
    invoice_number: "",
    amount: undefined,
    registration_status: "Paid",
    issued_at: "",
    retention_expires_at: "2026-05-02T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: {} });
  assert.equal(list.status, 200);
  assert.ok(list.body.includes("Invoice:</strong>"));
  assert.ok(list.body.includes("Payment Ref:</strong>"));
  assert.ok(list.body.includes("Issued:</strong>"));
  assert.ok(list.body.includes("TBD"));
});

test("attendeeTicketsController JSON branches for forbidden and expired", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") {
        return { type: "forbidden", status: 403 };
      }
      if (ticketId === "expired") {
        return { type: "expired", status: 410, ticket: { ticket_id: "expired" } };
      }
      return { type: "not_found", status: 404 };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const forbidden = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "forbidden" } });
  assert.equal(forbidden.status, 403);
  assert.equal(JSON.parse(forbidden.body).code, "access_denied");

  const expired = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "expired" } });
  assert.equal(expired.status, 410);
  assert.equal(JSON.parse(expired.body).code, "ticket_retention_expired");
});

test("attendeeTicketsController HTML branches for forbidden, not found, and expired", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") {
        return { type: "forbidden", status: 403 };
      }
      if (ticketId === "expired") {
        return { type: "expired", status: 410, ticket: { ticket_id: "expired" } };
      }
      return { type: "not_found", status: 404 };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const forbidden = await controller.handleGet({ headers: {}, params: { ticket_id: "forbidden" } });
  assert.equal(forbidden.status, 403);
  assert.ok(forbidden.body.includes("Access Denied"));

  const notFound = await controller.handleGet({ headers: {}, params: { ticket_id: "missing" } });
  assert.equal(notFound.status, 404);
  assert.ok(notFound.body.includes("Ticket Not Found"));

  const expired = await controller.handleGet({ headers: {}, params: { ticket_id: "expired" } });
  assert.equal(expired.status, 410);
  assert.ok(expired.body.includes("Ticket Expired"));
});

test("attendeeTicketsController branch sweep for JSON and HTML", async () => {
  const ticket = {
    ticket_id: "T-SUCCESS",
    attendee_id: "T1",
    payment_reference: "PAY-SUCCESS",
    invoice_number: "INV-SUCCESS",
    amount: 50,
    registration_status: "Paid",
    issued_at: "2026-02-04T00:00:00.000Z",
    retention_expires_at: "2026-05-04T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket];
      }
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") {
        return { type: "forbidden", status: 403 };
      }
      if (ticketId === "missing") {
        return { type: "not_found", status: 404 };
      }
      if (ticketId === "expired") {
        return { type: "expired", status: 410, ticket: { ticket_id: "expired" } };
      }
      if (ticketId === "unknown") {
        return { type: "unexpected", status: 520 };
      }
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const jsonList = await controller.handleList({ headers: jsonHeaders() });
  assert.equal(jsonList.status, 200);

  const htmlList = await controller.handleList({ headers: {} });
  assert.equal(htmlList.status, 200);

  const jsonForbidden = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "forbidden" } });
  assert.equal(jsonForbidden.status, 403);

  const htmlForbidden = await controller.handleGet({ headers: {}, params: { ticket_id: "forbidden" } });
  assert.equal(htmlForbidden.status, 403);

  const jsonMissing = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "missing" } });
  assert.equal(jsonMissing.status, 404);

  const htmlMissing = await controller.handleGet({ headers: {}, params: { ticket_id: "missing" } });
  assert.equal(htmlMissing.status, 404);

  const jsonExpired = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "expired" } });
  assert.equal(jsonExpired.status, 410);

  const htmlExpired = await controller.handleGet({ headers: {}, params: { ticket_id: "expired" } });
  assert.equal(htmlExpired.status, 410);

  const jsonUnknown = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "unknown" } });
  assert.equal(jsonUnknown.status, 500);

  const htmlUnknown = await controller.handleGet({ headers: {}, params: { ticket_id: "unknown" } });
  assert.equal(htmlUnknown.status, 500);

  const jsonSuccess = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "success" } });
  assert.equal(jsonSuccess.status, 200);

  const htmlSuccess = await controller.handleGet({ headers: {}, params: { ticket_id: "success" } });
  assert.equal(htmlSuccess.status, 200);
});

test("attendeeTicketsController JSON list handles expired count and null tickets", async () => {
  const tickets = [
    {
      ticket_id: "T-JSON-1",
      attendee_id: "T1",
      payment_reference: "PAY-JSON-1",
      invoice_number: "INV-JSON-1",
      amount: 200,
      registration_status: "Paid",
      issued_at: "2026-02-01T00:00:00.000Z",
      retention_expires_at: "2026-05-01T00:00:00.000Z",
    },
    null,
  ];
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return tickets;
      }
      return [tickets[0]];
    },
    listDeliveryAttempts(ticketId) {
      if (ticketId === "T-JSON-1") {
        return [{ delivery_id: "D1" }];
      }
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket: tickets[0] };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: jsonHeaders() });
  assert.equal(list.status, 200);
  const payload = JSON.parse(list.body);
  assert.equal(payload.expiredCount, 0);
  assert.equal(payload.tickets.length, 1);
  assert.equal(payload.tickets[0].deliveryAttempts.length, 1);
});

test("attendeeTicketsController JSON success returns ticket payload", async () => {
  const ticket = {
    ticket_id: "T-JSON-SUCCESS",
    attendee_id: "T1",
    payment_reference: "PAY-JSON-SUCCESS",
    invoice_number: "INV-JSON-SUCCESS",
    amount: 75,
    registration_status: "Paid",
    issued_at: "2026-02-03T00:00:00.000Z",
    retention_expires_at: "2026-05-03T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const response = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "T-JSON-SUCCESS" } });
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.ticketId, "T-JSON-SUCCESS");
});

test("attendeeTicketsController handles unknown result types with defaults", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [];
    },
    listDeliveryAttempts() {
      return undefined;
    },
    getTicketForAttendee() {
      return { type: "unexpected", status: 520 };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const jsonError = await controller.handleGet({ headers: jsonHeaders(), params: { ticket_id: "X" } });
  assert.equal(jsonError.status, 500);
  assert.equal(JSON.parse(jsonError.body).code, "ticket_generation_failed");

  const htmlError = await controller.handleGet({ headers: {}, params: { ticket_id: "X" } });
  assert.equal(htmlError.status, 500);
  assert.ok(htmlError.body.includes("Ticket Error"));
});

test("attendeeTicketsController HTML list renders default title branch", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [];
      }
      return [];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket: { ticket_id: "T1", attendee_id: "T1" } };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const list = await controller.handleList({ headers: {} });
  assert.equal(list.status, 200);
  assert.ok(list.body.includes("<title>My Tickets</title>"));
});

test("attendeeTicketsController hits auth and wantsJson branches", async () => {
  const ticket = {
    ticket_id: "T-BRANCH",
    attendee_id: "T1",
    payment_reference: "PAY-BRANCH",
    invoice_number: "INV-BRANCH",
    amount: 10,
    registration_status: "Paid",
    issued_at: "2026-02-05T00:00:00.000Z",
    retention_expires_at: "2026-05-05T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket];
      }
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") {
        return { type: "forbidden", status: 403 };
      }
      if (ticketId === "missing") {
        return { type: "not_found", status: 404 };
      }
      if (ticketId === "expired") {
        return { type: "expired", status: 410, ticket: { ticket_id: "expired" } };
      }
      if (ticketId === "unknown") {
        return { type: "unexpected", status: 520 };
      }
      return { type: "success", status: 200, ticket };
    },
  };

  const okController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const listJson = await okController.handleList({ headers: jsonHeaders() });
  assert.equal(listJson.status, 200);
  const listHtml = await okController.handleList({ headers: {} });
  assert.equal(listHtml.status, 200);

  const forbiddenJson = await okController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "forbidden" } });
  assert.equal(forbiddenJson.status, 403);
  const forbiddenHtml = await okController.handleGet({ headers: {}, params: { ticket_id: "forbidden" } });
  assert.equal(forbiddenHtml.status, 403);

  const missingJson = await okController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "missing" } });
  assert.equal(missingJson.status, 404);
  const missingHtml = await okController.handleGet({ headers: {}, params: { ticket_id: "missing" } });
  assert.equal(missingHtml.status, 404);

  const expiredJson = await okController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "expired" } });
  assert.equal(expiredJson.status, 410);
  const expiredHtml = await okController.handleGet({ headers: {}, params: { ticket_id: "expired" } });
  assert.equal(expiredHtml.status, 410);

  const unknownJson = await okController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "unknown" } });
  assert.equal(unknownJson.status, 500);
  const unknownHtml = await okController.handleGet({ headers: {}, params: { ticket_id: "unknown" } });
  assert.equal(unknownHtml.status, 500);

  const successJson = await okController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "T-BRANCH" } });
  assert.equal(successJson.status, 200);
  const successHtml = await okController.handleGet({ headers: {}, params: { ticket_id: "T-BRANCH" } });
  assert.equal(successHtml.status, 200);

  const deniedController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: false }),
  });
  const deniedList = await deniedController.handleList({ headers: jsonHeaders() });
  assert.equal(deniedList.status, 401);
  const deniedGet = await deniedController.handleGet({ headers: jsonHeaders(), params: { ticket_id: "T-BRANCH" } });
  assert.equal(deniedGet.status, 401);
});

test("attendeeTicketsController explicit branch coverage for list/get", async () => {
  const ticket = {
    ticket_id: "T-EXPLICIT",
    attendee_id: "T1",
    payment_reference: "PAY-EXPLICIT",
    invoice_number: "INV-EXPLICIT",
    amount: 10,
    registration_status: "Paid",
    issued_at: "2026-02-06T00:00:00.000Z",
    retention_expires_at: "2026-05-06T00:00:00.000Z",
  };
  const confirmationTicketService = {
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket];
      }
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") {
        return { type: "forbidden", status: 403 };
      }
      if (ticketId === "missing") {
        return { type: "not_found", status: 404 };
      }
      if (ticketId === "expired") {
        return { type: "expired", status: 410, ticket: { ticket_id: "expired" } };
      }
      if (ticketId === "unknown") {
        return { type: "unexpected", status: 520 };
      }
      return { type: "success", status: 200, ticket };
    },
  };

  const okController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const listJson = await okController.handleList({ headers: { accept: "application/json" } });
  assert.equal(listJson.status, 200);
  const listHtml = await okController.handleList({ headers: { accept: "text/html" } });
  assert.equal(listHtml.status, 200);

  const forbiddenJson = await okController.handleGet({
    headers: { accept: "application/json" },
    params: { ticket_id: "forbidden" },
  });
  assert.equal(forbiddenJson.status, 403);
  const forbiddenHtml = await okController.handleGet({
    headers: { accept: "text/html" },
    params: { ticket_id: "forbidden" },
  });
  assert.equal(forbiddenHtml.status, 403);

  const missingJson = await okController.handleGet({
    headers: { accept: "application/json" },
    params: { ticket_id: "missing" },
  });
  assert.equal(missingJson.status, 404);
  const missingHtml = await okController.handleGet({
    headers: { accept: "text/html" },
    params: { ticket_id: "missing" },
  });
  assert.equal(missingHtml.status, 404);

  const expiredJson = await okController.handleGet({
    headers: { accept: "application/json" },
    params: { ticket_id: "expired" },
  });
  assert.equal(expiredJson.status, 410);
  const expiredHtml = await okController.handleGet({
    headers: { accept: "text/html" },
    params: { ticket_id: "expired" },
  });
  assert.equal(expiredHtml.status, 410);

  const unknownJson = await okController.handleGet({
    headers: { accept: "application/json" },
    params: { ticket_id: "unknown" },
  });
  assert.equal(unknownJson.status, 500);
  const unknownHtml = await okController.handleGet({
    headers: { accept: "text/html" },
    params: { ticket_id: "unknown" },
  });
  assert.equal(unknownHtml.status, 500);

  const successJson = await okController.handleGet({
    headers: { accept: "application/json" },
    params: { ticket_id: "T-EXPLICIT" },
  });
  assert.equal(successJson.status, 200);
  const successHtml = await okController.handleGet({
    headers: { accept: "text/html" },
    params: { ticket_id: "T-EXPLICIT" },
  });
  assert.equal(successHtml.status, 200);

  const deniedController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: false }),
  });
  const deniedList = await deniedController.handleList({ headers: { accept: "application/json" } });
  assert.equal(deniedList.status, 401);
  const deniedGet = await deniedController.handleGet({
    headers: { accept: "application/json" },
    params: { ticket_id: "T-EXPLICIT" },
  });
  assert.equal(deniedGet.status, 401);
});
test("attendeeTicketsController uses default auth guard and handles missing actor", async () => {
  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ attendeeId, ticketId }) {
      return { type: "success", status: 200, ticket: { ticket_id: ticketId, attendee_id: attendeeId } };
    },
  };

  const controller = createAttendeeTicketsController({ confirmationTicketService });

  const unauthList = await controller.handleList({ headers: {} });
  assert.equal(unauthList.status, 401);

  const unauthGet = await controller.handleGet({ headers: {}, params: { ticket_id: "T-1" } });
  assert.equal(unauthGet.status, 401);

  const missingActorController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: {
      requireAttendee() {
        return { ok: true, actor: null };
      },
    },
  });

  const list = await missingActorController.handleList({ headers: jsonHeaders() });
  assert.equal(list.status, 200);
  assert.equal(JSON.parse(list.body).expiredCount, 0);

  const get = await missingActorController.handleGet({
    headers: jsonHeaders(),
    params: {},
  });
  assert.equal(get.status, 200);
  assert.equal(JSON.parse(get.body).ticketId, "");
});

test("controllers render HTML responses for non-JSON requests", async () => {
  const ticket = {
    ticket_id: "T-HTML",
    attendee_id: "T1",
    payment_reference: "PAY-HTML",
    invoice_number: "INV-HTML",
    amount: 200,
    registration_status: "Paid",
    issued_at: "2026-02-01T00:00:00.000Z",
    retention_expires_at: "2026-05-01T00:00:00.000Z",
  };

  const confirmationTicketService = {
    async createTicketFromConfirmation() {
      return { type: "created", status: 201, ticket };
    },
    listDeliveryAttempts() {
      return [];
    },
    listTicketsForAttendee({ includeExpired } = {}) {
      if (includeExpired) {
        return [ticket];
      }
      return [];
    },
    getTicketForAttendee() {
      return { type: "success", status: 200, ticket };
    },
  };

  const paymentController = createPaymentConfirmationsController({ confirmationTicketService });
  const htmlCreate = await paymentController.handleCreate({ headers: {}, body: {} });
  assert.equal(htmlCreate.status, 201);
  assert.ok(htmlCreate.body.includes("Payment Confirmed"));

  const ticketsController = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });
  const htmlList = await ticketsController.handleList({ headers: {} });
  assert.equal(htmlList.status, 200);
  assert.ok(htmlList.body.includes("My Tickets"));
  assert.ok(htmlList.body.includes("retention period"));

  const htmlDetail = await ticketsController.handleGet({
    headers: {},
    params: { ticket_id: "T-HTML" },
  });
  assert.equal(htmlDetail.status, 200);
  assert.ok(htmlDetail.body.includes("INV-HTML"));

  const forbiddenController = createAttendeeTicketsController({
    confirmationTicketService: {
      listTicketsForAttendee() {
        return [];
      },
      listDeliveryAttempts() {
        return [];
      },
      getTicketForAttendee() {
        return { type: "forbidden", status: 403 };
      },
    },
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });
  const forbidden = await forbiddenController.handleGet({ headers: {}, params: { ticket_id: "X" } });
  assert.equal(forbidden.status, 403);
  assert.ok(forbidden.body.includes("Access Denied"));

  const missingController = createAttendeeTicketsController({
    confirmationTicketService: {
      listTicketsForAttendee() {
        return [];
      },
      listDeliveryAttempts() {
        return [];
      },
      getTicketForAttendee() {
        return { type: "not_found", status: 404 };
      },
    },
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });
  const missing = await missingController.handleGet({ headers: {}, params: { ticket_id: "X" } });
  assert.equal(missing.status, 404);
  assert.ok(missing.body.includes("Ticket Not Found"));

  const expiredController = createAttendeeTicketsController({
    confirmationTicketService: {
      listTicketsForAttendee() {
        return [];
      },
      listDeliveryAttempts() {
        return [];
      },
      getTicketForAttendee() {
        return { type: "expired", status: 410, ticket: { ticket_id: "X" } };
      },
    },
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });
  const expired = await expiredController.handleGet({ headers: {}, params: { ticket_id: "X" } });
  assert.equal(expired.status, 410);
  assert.ok(expired.body.includes("Ticket Expired"));

  const errorPaymentController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return { type: "validation_error", status: 400 };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
  });
  const invalidHtml = await errorPaymentController.handleCreate({ headers: {}, body: {} });
  assert.equal(invalidHtml.status, 400);
  assert.ok(invalidHtml.body.includes("Invalid Confirmation"));

  const failPaymentController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return { type: "error", status: 500 };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
  });
  const errorHtml = await failPaymentController.handleCreate({ headers: {}, body: {} });
  assert.equal(errorHtml.status, 500);
  assert.ok(errorHtml.body.includes("Ticket Error"));

  const duplicatePaymentController = createPaymentConfirmationsController({
    confirmationTicketService: {
      async createTicketFromConfirmation() {
        return { type: "duplicate", status: 200, ticket: null };
      },
      listDeliveryAttempts() {
        return [];
      },
    },
  });
  const duplicateHtml = await duplicatePaymentController.handleCreate({ headers: {}, body: {} });
  assert.equal(duplicateHtml.status, 200);
  assert.ok(duplicateHtml.body.includes("Payment confirmation received."));

  assert.throws(
    () => createAttendeeTicketsController(),
    { message: "confirmationTicketService is required" }
  );
});

test("attendeeTicketsController falls back when headers are omitted", async () => {
  const ticket = {
    ticket_id: "T-NO-HEADERS",
    attendee_id: "T1",
    payment_reference: "PAY-NO-HEADERS",
    invoice_number: "INV-NO-HEADERS",
    amount: 42,
    registration_status: "Paid",
    issued_at: "2026-02-07T00:00:00.000Z",
    retention_expires_at: "2026-05-07T00:00:00.000Z",
  };

  const confirmationTicketService = {
    listTicketsForAttendee() {
      return [ticket];
    },
    listDeliveryAttempts() {
      return [];
    },
    getTicketForAttendee({ ticketId }) {
      if (ticketId === "forbidden") return { type: "forbidden", status: 403 };
      if (ticketId === "missing") return { type: "not_found", status: 404 };
      if (ticketId === "expired") return { type: "expired", status: 410, ticket: { ticket_id: "expired" } };
      if (ticketId === "unknown") return { type: "unexpected", status: 520 };
      return { type: "success", status: 200, ticket };
    },
  };

  const controller = createAttendeeTicketsController({
    confirmationTicketService,
    authGuard: createAuthGuard({ ok: true, actorId: "T1" }),
  });

  const listNoArg = await controller.handleList();
  assert.equal(listNoArg.status, 200);

  const forbidden = await controller.handleGet({ params: { ticket_id: "forbidden" } });
  assert.equal(forbidden.status, 403);
  const missing = await controller.handleGet({ params: { ticket_id: "missing" } });
  assert.equal(missing.status, 404);
  const expired = await controller.handleGet({ params: { ticket_id: "expired" } });
  assert.equal(expired.status, 410);
  const unknown = await controller.handleGet({ params: { ticket_id: "unknown" } });
  assert.equal(unknown.status, 500);
  const success = await controller.handleGet({ params: { ticket_id: "T-NO-HEADERS" } });
  assert.equal(success.status, 200);
});
