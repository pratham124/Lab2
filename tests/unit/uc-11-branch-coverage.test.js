const test = require("node:test");
const assert = require("node:assert/strict");

const { createReviewInvitationsController } = require("../../src/controllers/review_invitations_controller");
const { createRouter } = require("../../src/controllers/router");
const { createInvitationStatusService } = require("../../src/services/invitation_status_service");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createSecurityLogService } = require("../../src/services/security_log_service");
const { paginate } = require("../../src/services/pagination");
const {
  createReviewInvitation,
  normalizeStatus,
} = require("../../src/models/review_invitation");
const { createNotification } = require("../../src/models/notification");
const { createReviewInvitationService } = require("../../src/services/review_invitation_service");
const {
  createReviewInvitationActionService,
} = require("../../src/services/review_invitation_action_service");
const { createNotificationService } = require("../../src/services/notification_service");
const { createNotificationService: createDecisionNotificationService } = require("../../src/services/notification-service");
const { createInvitationCreationService } = require("../../src/services/invitation_creation_service");
const { createApiClient, __test: apiClientTest } = require("../../src/services/api_client");
const { createDataAccess } = require("../../src/services/data_access");
const { createAssignmentService } = require("../../src/services/assignment_service");
const { createAppServer } = require("../../src/server");
const fs = require("fs");
const path = require("path");

function sessionService(map = {}) {
  return {
    validate(sessionId) {
      return map[sessionId] || null;
    },
  };
}

function parseBody(response) {
  return JSON.parse(response.body);
}

test("UC-11 controller constructor validates dependencies", () => {
  assert.throws(() => createReviewInvitationsController(), /reviewInvitationService is required/);
  assert.throws(
    () => createReviewInvitationsController({ reviewInvitationService: {} }),
    /reviewInvitationActionService is required/
  );
});

test("UC-11 controller covers page/list/detail/action branches", async () => {
  const calls = [];
  const controller = createReviewInvitationsController({
    sessionService: sessionService({ sid_ok: { user_id: "R1", role: "reviewer" } }),
    reviewInvitationService: {
      listForReviewer(input) {
        calls.push({ fn: "list", input });
        if (input.status === "explode") {
          throw new Error("boom");
        }
        return { items: [], page: input.page, pageSize: input.pageSize, totalItems: 0, totalPages: 1 };
      },
      getById({ invitationId }) {
        if (invitationId === "missing") {
          return null;
        }
        if (invitationId === "forbidden") {
          return "forbidden";
        }
        return { id: invitationId, status: "pending" };
      },
    },
    reviewInvitationActionService: {
      respond({ invitationId }) {
        if (invitationId === "missing") {
          return { type: "not_found" };
        }
        if (invitationId === "forbidden") {
          return { type: "forbidden" };
        }
        if (invitationId === "conflict") {
          return { type: "conflict", message: "already" };
        }
        if (invitationId === "explode") {
          throw new Error("fail");
        }
        return { type: "ok", invitation: { id: invitationId, status: "accepted", respondedAt: "t" } };
      },
    },
  });

  const unauthPage = await controller.handleGetPage({ headers: {} });
  assert.equal(unauthPage.status, 302);
  const unauthPageNoArgs = await controller.handleGetPage();
  assert.equal(unauthPageNoArgs.status, 302);
  const authPage = await controller.handleGetPage({ headers: { cookie: "cms_session=sid_ok" } });
  assert.equal(authPage.status, 200);
  assert.equal(authPage.body.includes("review-invitations.css"), true);

  const unauthList = await controller.handleList({ headers: {}, query: {} });
  assert.equal(unauthList.status, 401);

  const list = await controller.handleList({
    headers: { cookie: "cms_session=sid_ok" },
    query: { page: "0", page_size: "x" },
  });
  assert.equal(list.status, 200);
  assert.equal(calls[0].input.status, "pending");
  assert.equal(calls[0].input.page, 1);
  assert.equal(calls[0].input.pageSize, 20);

  const listError = await controller.handleList({
    headers: { cookie: "cms_session=sid_ok" },
    query: { status: "explode" },
  });
  assert.equal(listError.status, 500);

  assert.equal((await controller.handleGetDetail({ headers: {}, params: {} })).status, 401);
  assert.equal(
    (await controller.handleGetDetail({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "missing" },
    })).status,
    404
  );
  assert.equal(
    (await controller.handleGetDetail({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "forbidden" },
    })).status,
    403
  );
  assert.equal(
    (await controller.handleGetDetail({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "ok" },
    })).status,
    200
  );

  assert.equal((await controller.handleAction({ headers: {}, params: {} })).status, 401);
  assert.equal((await controller.handleAction({ headers: { cookie: "cms_session=sid_ok" } })).status, 400);
  assert.equal(
    (await controller.handleAction({
      headers: { cookie: "cms_session=sid_ok" },
      params: { action: "noop" },
    })).status,
    400
  );
  assert.equal(
    (await controller.handleAction({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "missing", action: "accept" },
    })).status,
    404
  );
  assert.equal(
    (await controller.handleAction({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "forbidden", action: "accept" },
    })).status,
    403
  );
  assert.equal(
    (await controller.handleAction({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "conflict", action: "accept" },
    })).status,
    409
  );
  assert.equal(
    (await controller.handleAction({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "ok", action: "reject" },
    })).status,
    200
  );
  assert.equal(
    (await controller.handleAction({
      headers: { cookie: "cms_session=sid_ok" },
      params: { invitation_id: "explode", action: "accept" },
    })).status,
    500
  );
});

test("UC-11 router route predicates and handler mapping", async () => {
  const calls = [];
  const router = createRouter({
    reviewInvitationsController: {
      handleGetPage(input) {
        calls.push({ fn: "page", input });
        return { status: 200, body: "page" };
      },
      handleList(input) {
        calls.push({ fn: "list", input });
        return { status: 200, body: "list" };
      },
      handleGetDetail(input) {
        calls.push({ fn: "detail", input });
        return { status: 200, body: "detail" };
      },
      handleAction(input) {
        calls.push({ fn: "action", input });
        return { status: 200, body: "action" };
      },
    },
  });

  const reqGet = { method: "GET", headers: { a: "b" } };
  assert.equal(router.isReviewInvitationsPage(reqGet, new URL("http://x/review-invitations")), true);
  assert.equal(router.isReviewInvitationsPage(reqGet, new URL("http://x/review-invitations.html")), true);
  assert.equal(router.isReviewInvitationsPage({ method: "POST" }, new URL("http://x/review-invitations")), false);
  assert.equal(router.isReviewInvitationsList(reqGet, new URL("http://x/api/review-invitations")), true);
  assert.equal(router.isReviewInvitationDetail(reqGet, new URL("http://x/api/review-invitations/id_1")), true);
  assert.equal(router.isReviewInvitationDetail(reqGet, new URL("http://x/api/review-invitations/id/extra")), false);
  assert.equal(
    router.isReviewInvitationAction({ method: "POST" }, new URL("http://x/api/review-invitations/i1/accept")),
    true
  );
  assert.equal(
    router.isReviewInvitationAction({ method: "PATCH" }, new URL("http://x/api/review-invitations/i1/reject")),
    true
  );
  assert.equal(
    router.isReviewInvitationAction({ method: "GET" }, new URL("http://x/api/review-invitations/i1/accept")),
    false
  );

  await router.handleReviewInvitationsPage(reqGet);
  await router.handleReviewInvitationsList(reqGet, new URL("http://x/api/review-invitations?status=accepted&page=2&page_size=10"));
  await router.handleReviewInvitationDetail(reqGet, new URL("http://x/api/review-invitations/inv_7"));
  await router.handleReviewInvitationAction({ method: "POST", headers: {} }, new URL("http://x/api/review-invitations/inv_8/reject"));
  await router.handleReviewInvitationDetail(reqGet, new URL("http://x/api/review-invitations/"));
  await router.handleReviewInvitationAction({ method: "POST", headers: {} }, new URL("http://x/api/review-invitations/"));

  assert.equal(calls[1].input.query.status, "accepted");
  assert.equal(calls[1].input.query.page, "2");
  assert.equal(calls[2].input.params.invitation_id, "inv_7");
  assert.equal(calls[3].input.params.action, "reject");
  assert.equal(calls[4].input.params.invitation_id, "");
  assert.equal(calls[5].input.params.invitation_id, "");
  assert.equal(calls[5].input.params.action, "");

  const defaults = await router.handleReviewInvitationsList(reqGet, new URL("http://x/api/review-invitations"));
  assert.equal(defaults.status, 200);
  assert.equal(calls[6].input.query.status, "pending");
  assert.equal(calls[6].input.query.page_size, "20");
});

test("UC-11 invitation status updater covers all conditional branches", () => {
  const service = createInvitationStatusService({ now: () => new Date("2026-03-01T00:00:00.000Z") });
  const invitations = [
    null,
    { id: "a", status: "accepted", responseDueAt: "2026-02-01T00:00:00.000Z" },
    { id: "b", status: "pending", responseDueAt: "" },
    { id: "c", status: "pending", responseDueAt: "invalid" },
    { id: "d", status: "pending", responseDueAt: "2026-03-01T00:00:00.000Z" },
    { id: "e", status: "pending", responseDueAt: "2026-02-28T23:59:59.000Z" },
  ];

  const result = service.refreshStatuses(invitations);
  assert.equal(result.changed, 1);
  assert.equal(invitations[5].status, "declined");
  assert.equal(typeof invitations[5].respondedAt, "string");
});

test("UC-11 authorization and security logging branches", () => {
  const entries = [];
  const securityLogService = createSecurityLogService({
    logger: {
      warn(line) {
        entries.push(JSON.parse(line));
      },
    },
  });

  securityLogService.logUnauthorizedAccess({ userId: " u1 ", invitationId: " i1 " });
  assert.equal(entries[0].user_id, "u1");
  assert.equal(entries[0].invitation_id, "i1");

  securityLogService.logUnauthorizedAccess();
  assert.equal(entries[1].user_id, "");
  assert.equal(entries[1].invitation_id, "");

  const authz = createAuthorizationService({ securityLogService });
  assert.equal(authz.canAccessInvitation({}), false);
  assert.equal(authz.canAccessInvitation({ userId: "u1", invitation: { reviewerId: "u1" } }), true);
  assert.equal(authz.canAccessInvitation({ userId: "u2", invitation: { id: "I", reviewerId: "u1" } }), false);
  assert.equal(authz.canAccessInvitation({ userId: "u2", invitation: { id: "I2" } }), false);

  const authzNoLogger = createAuthorizationService();
  assert.equal(authzNoLogger.canAccessInvitation({ userId: "x", invitation: { reviewerId: "y" } }), false);

  const fallbackSecurityLogger = createSecurityLogService();
  assert.doesNotThrow(() => fallbackSecurityLogger.logUnauthorizedAccess({ userId: "u9", invitationId: "i9" }));
});

test("UC-11 pagination and models cover validation/default branches", () => {
  const p0 = paginate(null, { page: 1, pageSize: 5 });
  assert.equal(p0.totalItems, 0);
  assert.equal(p0.items.length, 0);

  const p1 = paginate([1, 2, 3], { page: 0, pageSize: 0 });
  assert.equal(p1.page, 1);
  assert.equal(p1.pageSize, 20);
  assert.equal(p1.totalPages, 1);

  const p2 = paginate([1, 2, 3], { page: 99, pageSize: 2 });
  assert.equal(p2.page, 2);
  assert.deepEqual(p2.items, [3]);

  assert.equal(normalizeStatus(" ACCEPTED "), "accepted");
  assert.equal(normalizeStatus("bogus"), "pending");

  const invitation = createReviewInvitation({ status: "bogus", reviewerId: " r ", paperId: " p " });
  assert.equal(invitation.status, "pending");
  assert.equal(invitation.reviewerId, "r");
  assert.equal(invitation.paperId, "p");
  assert.equal(invitation.id.startsWith("inv_"), true);

  const notification = createNotification({ invitationId: "  i " });
  assert.equal(notification.invitationId, "i");
  assert.equal(notification.channel, "email");
  assert.equal(notification.deliveryStatus, "pending");

  const notificationFallback = createNotification({
    invitationId: "  j  ",
    channel: "",
    deliveryStatus: "",
  });
  assert.equal(notificationFallback.invitationId, "j");
  assert.equal(notificationFallback.channel, "email");
  assert.equal(notificationFallback.deliveryStatus, "pending");

  const invitationWithTrim = createReviewInvitation({ reviewerId: "  reviewer  ", paperId: "  paper  " });
  assert.equal(invitationWithTrim.reviewerId, "reviewer");
  assert.equal(invitationWithTrim.paperId, "paper");

  const notificationNoInvitationId = createNotification();
  assert.equal(notificationNoInvitationId.invitationId, "");

  const invitationNoIds = createReviewInvitation();
  assert.equal(invitationNoIds.reviewerId, "");
  assert.equal(invitationNoIds.paperId, "");
});

test("UC-11 review invitation service and action service branch coverage", () => {
  assert.throws(() => createReviewInvitationService(), /dataAccess is required/);
  assert.throws(() => createReviewInvitationActionService(), /dataAccess is required/);

  const dataAccess = {
    listReviewInvitationsByReviewer() {
      return [
        { id: "i1", paperId: "p1", status: "pending", createdAt: "2026-02-01", responseDueAt: null },
        { id: "i2", paperId: "pX", status: "accepted", createdAt: "2026-02-02", responseDueAt: "2026" },
      ];
    },
    getPaperById(paperId) {
      if (paperId === "p1") {
        return { id: "p1", title: "Paper 1", abstract: "A" };
      }
      return null;
    },
    getReviewInvitationById(id) {
      const map = {
        missing: null,
        forbidden: { id: "forbidden", reviewerId: "R1", paperId: "p1", status: "pending", createdAt: "t" },
        accepted: { id: "accepted", reviewerId: "R1", paperId: "p1", status: "accepted", createdAt: "t" },
        pending: { id: "pending", reviewerId: "R1", paperId: "p1", status: "pending", createdAt: "t" },
      };
      return map[id] || null;
    },
    updateReviewInvitationStatus(id, updates) {
      return { id, ...updates };
    },
  };

  const service = createReviewInvitationService({
    dataAccess,
    invitationStatusService: { refreshStatuses() {} },
    authorizationService: { canAccessInvitation({ invitationId, invitation }) { return invitation.id !== "forbidden"; } },
  });

  const serviceWithoutStatusUpdater = createReviewInvitationService({
    dataAccess,
    invitationStatusService: {},
    authorizationService: { canAccessInvitation() { return true; } },
  });
  const listWithoutUpdater = serviceWithoutStatusUpdater.listForReviewer({
    reviewerId: "R1",
    status: "",
    page: 1,
    pageSize: 10,
  });
  assert.equal(listWithoutUpdater.items.length, 2);

  const listAll = service.listForReviewer({ reviewerId: "R1", status: "", page: 1, pageSize: 10 });
  assert.equal(listAll.items.length, 2);
  assert.equal(listAll.items[0].paperTitle, "Unknown paper");

  assert.equal(service.getById({ reviewerId: "R1", invitationId: "missing" }), null);
  assert.equal(service.getById({ reviewerId: "R1", invitationId: "forbidden" }), "forbidden");
  assert.equal(service.getById({ reviewerId: "R1", invitationId: "accepted" }).paperAbstract, "A");
  assert.equal(service.getById({ reviewerId: "R1", invitationId: "pending" }).paperAbstract, undefined);

  const dataAccessMissingPaper = {
    getReviewInvitationById() {
      return { id: "accepted_missing", reviewerId: "R1", paperId: "missing", status: "accepted", createdAt: "t" };
    },
    getPaperById() {
      return null;
    },
    listReviewInvitationsByReviewer() {
      return [];
    },
  };
  const serviceMissingPaper = createReviewInvitationService({
    dataAccess: dataAccessMissingPaper,
    authorizationService: { canAccessInvitation() { return true; } },
  });
  const detailMissingPaper = serviceMissingPaper.getById({ reviewerId: "R1", invitationId: "anything" });
  assert.equal(detailMissingPaper.paperTitle, "Unknown paper");
  assert.equal(detailMissingPaper.paperAbstract, undefined);

  const dataAccessEmptyAbstract = {
    getReviewInvitationById() {
      return { id: "accepted_empty_abstract", reviewerId: "R1", paperId: "p1", status: "accepted", createdAt: "t" };
    },
    getPaperById() {
      return { id: "p1", title: "Paper 1", abstract: "" };
    },
    listReviewInvitationsByReviewer() {
      return [];
    },
  };
  const serviceEmptyAbstract = createReviewInvitationService({
    dataAccess: dataAccessEmptyAbstract,
    authorizationService: { canAccessInvitation() { return true; } },
  });
  const detailEmptyAbstract = serviceEmptyAbstract.getById({ reviewerId: "R1", invitationId: "x" });
  assert.equal(detailEmptyAbstract.paperAbstract, "");

  const action = createReviewInvitationActionService({
    dataAccess,
    authorizationService: {
      canAccessInvitation({ invitation }) {
        return invitation.id !== "forbidden";
      },
    },
  });

  assert.equal(action.respond({ invitationId: "missing", reviewerId: "R1", action: "accept" }).type, "not_found");
  assert.equal(action.respond({ invitationId: "forbidden", reviewerId: "R1", action: "accept" }).type, "forbidden");

  const conflictDataAccess = {
    getReviewInvitationById() {
      return { id: "i", reviewerId: "R1", status: "accepted" };
    },
  };
  const actionConflict = createReviewInvitationActionService({ dataAccess: conflictDataAccess });
  assert.equal(actionConflict.respond({ invitationId: "i", reviewerId: "R1", action: "accept" }).type, "conflict");

  assert.equal(action.respond({ invitationId: "pending", reviewerId: "R1", action: "accept" }).invitation.status, "accepted");
  assert.equal(action.respond({ invitationId: "pending", reviewerId: "R1", action: "reject" }).invitation.status, "rejected");
});

test("UC-11 notification service branches and invitation creation service branches", async () => {
  const logs = [];
  const records = [];
  const service = createNotificationService({
    inviter: {
      async sendInvitation({ reviewer }) {
        if (reviewer && reviewer.id === "R2") {
          throw {};
        }
      },
    },
    logger: {
      warn(line) {
        logs.push(line);
      },
    },
    dataAccess: {
      createNotificationRecord(input) {
        records.push(input);
      },
    },
  });

  const batch = await service.sendReviewerInvitations({
    paper: { id: "P1" },
    reviewers: [{ id: "R1" }, { id: "R2" }],
    assignments: [],
  });
  assert.equal(batch.type, "partial_failure");
  assert.equal(batch.failures.length, 1);

  const okBatch = await service.sendReviewerInvitations({ paper: { id: "P1" }, reviewers: [{ id: "R1" }] });
  assert.equal(okBatch.type, "sent");

  const sent = await service.sendInvitationNotification({
    invitation: { id: "I1", responseDueAt: "2026-03-01" },
    reviewer: { id: "R1" },
    paper: { title: "Paper X" },
  });
  assert.equal(sent.type, "sent");

  const failed = await service.sendInvitationNotification({
    invitation: { id: "I2" },
    reviewer: { id: "R2" },
    paper: {},
  });
  assert.equal(failed.type, "failed");
  assert.equal(records.length, 2);
  assert.equal(records[1].failureReason, "notification_failed");
  assert.equal(logs.length > 0, true);

  assert.throws(() => createInvitationCreationService(), /dataAccess is required/);

  const created = [];
  const warnings = [];
  const creationService = createInvitationCreationService({
    dataAccess: {
      createReviewInvitation(input) {
        created.push(input);
        return { ...input, id: `id_${created.length}` };
      },
      getReviewerById(id) {
        return { id };
      },
    },
    notificationService: {
      async sendInvitationNotification({ reviewer }) {
        if (reviewer.id === "R2") {
          throw {};
        }
      },
    },
    failureLogger: {
      warn(line) {
        warnings.push(line);
      },
    },
  });

  const none = await creationService.createForAssignments({ assignments: null });
  assert.deepEqual(none, []);

  const invites = await creationService.createForAssignments({
    paper: { id: "P1" },
    assignments: [
      { reviewerId: "R1", paperId: "P1", assignedAt: "2026-02-01T00:00:00.000Z" },
      { reviewerId: "R2", paperId: "P1", assignedAt: "2026-02-01T00:00:00.000Z" },
    ],
  });
  assert.equal(invites.length, 2);
  assert.equal(created[0].responseDueAt.startsWith("2026-02-15"), true);
  assert.equal(warnings.length, 1);

  const defaultNotifierService = createInvitationCreationService({
    dataAccess: {
      createReviewInvitation(input) {
        return { ...input, id: "id_default" };
      },
      getReviewerById() {
        return null;
      },
    },
  });
  const defaultRes = await defaultNotifierService.createForAssignments({
    assignments: [{ reviewerId: "R1", paperId: "P1" }],
  });
  assert.equal(defaultRes.length, 1);
});

test("UC-11 notification service template loader fallback branch", async () => {
  const modulePath = path.join(__dirname, "..", "..", "src", "services", "notification_service.js");
  const originalRead = fs.readFileSync;

  fs.readFileSync = function patchedRead(filePath, ...rest) {
    const normalized = String(filePath || "");
    if (normalized.endsWith(path.join("views", "templates", "review-invitation-notification.txt"))) {
      throw new Error("ENOENT");
    }
    return originalRead.call(this, filePath, ...rest);
  };

  delete require.cache[require.resolve(modulePath)];
  const { createNotificationService: createNotificationServiceReloaded } = require(modulePath);

  const payloads = [];
  const service = createNotificationServiceReloaded({
    inviter: {
      async sendInvitation(payload) {
        payloads.push(payload);
      },
    },
  });

  await service.sendInvitationNotification({
    invitation: { id: "I1", responseDueAt: "2026-03-01" },
    reviewer: { id: "R1" },
    paper: { title: "Paper Template Fallback" },
  });

  assert.equal(payloads.length, 1);
  assert.equal(String(payloads[0].body).includes("Respond by"), true);

  fs.readFileSync = originalRead;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
});

test("UC-11 notification service executes default inviter/logger function paths", async () => {
  const defaultService = createNotificationService();
  const batchResult = await defaultService.sendReviewerInvitations({
    paper: { id: "P1" },
    reviewers: [{ id: "R1" }],
    assignments: [],
  });
  assert.equal(batchResult.type, "sent");

  const singleResult = await defaultService.sendInvitationNotification({
    invitation: { id: "I1", responseDueAt: "2026-03-01T00:00:00.000Z" },
    reviewer: { id: "R1" },
    paper: { title: "Paper Default" },
  });
  assert.equal(singleResult.type, "sent");

  const warnOnlyDefaultLogger = createNotificationService({
    inviter: {
      async sendInvitation() {
        throw new Error("FORCE_WARN_WITH_DEFAULT_LOGGER");
      },
    },
  });
  const failed = await warnOnlyDefaultLogger.sendInvitationNotification({
    invitation: { id: "I2" },
    reviewer: { id: "R2" },
    paper: { title: "Paper Warn" },
  });
  assert.equal(failed.type, "failed");
});

test("UC-11 api client and new data-access/assignment-service branches", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true };
      },
    };
  };

  const client = createApiClient({ baseUrl: "/api" });
  const list = await client.listReviewInvitations({ status: "accepted", page: 2, pageSize: 5 });
  assert.deepEqual(list, { ok: true });
  assert.equal(String(calls[0].url).includes("status=accepted"), true);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers["Content-Type"], undefined);

  await client.respondToInvitation("inv/1", "accept");
  assert.equal(calls[1].options.method, "POST");

  global.fetch = async (url, options) => {
    calls.push({ url, options, kind: "with_body" });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, kind: "with_body" };
      },
    };
  };
  const withBody = await apiClientTest.request("/api/custom", {
    method: "PATCH",
    body: { x: 1 },
  });
  assert.equal(withBody.kind, "with_body");
  assert.equal(calls[calls.length - 1].options.headers["Content-Type"], "application/json");

  global.fetch = async () => ({
    ok: false,
    status: 503,
    async json() {
      return { message: "down" };
    },
  });
  await assert.rejects(() => client.listReviewInvitations(), (error) => {
    assert.equal(error.message, "down");
    assert.equal(error.status, 503);
    return true;
  });

  global.fetch = async () => ({
    ok: false,
    status: 500,
    async json() {
      throw new Error("bad json");
    },
  });
  await assert.rejects(() => client.listReviewInvitations(), (error) => {
    assert.equal(error.message, "Request failed");
    assert.equal(error.payload, null);
    return true;
  });

  global.fetch = originalFetch;

  const dataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "R1", eligibilityStatus: true }],
    },
  });
  const created = dataAccess.createReviewInvitation({ reviewerId: "R1", paperId: "P1", status: "pending" });
  assert.equal(Boolean(dataAccess.getReviewInvitationById(created.id)), true);
  assert.equal(dataAccess.getReviewInvitationById("missing"), null);
  assert.equal(dataAccess.listReviewInvitationsByReviewer(" R1 ").length, 1);
  assert.equal(dataAccess.updateReviewInvitationStatus("missing", { status: "accepted" }), null);
  assert.equal(dataAccess.updateReviewInvitationStatus(created.id, { status: "accepted" }).status, "accepted");

  const record = dataAccess.createNotificationRecord({ invitationId: created.id, deliveryStatus: "sent" });
  const listed = dataAccess.listNotificationRecords();
  assert.equal(listed.length, 1);
  assert.equal(record.id.startsWith("notif_"), true);
  listed.push({});
  assert.equal(dataAccess.listNotificationRecords().length, 1);

  const seededDataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P2", title: "Paper 2", status: "submitted" }],
      reviewers: [{ id: "R2", name: "R2", eligibilityStatus: true }],
      assignments: [],
      reviewInvitations: [{ id: " INV_SEEDED ", reviewerId: " R2 ", paperId: " P2 ", status: "accepted" }],
      notifications: [{ invitationId: " INV_SEEDED ", deliveryStatus: " sent " }],
    },
  });
  assert.equal(seededDataAccess.getReviewInvitationById("INV_SEEDED").id, "INV_SEEDED");
  assert.equal(seededDataAccess.listReviewInvitationsByReviewer("R2").length, 1);
  assert.equal(seededDataAccess.listNotificationRecords().length, 1);
  const updatedSeeded = seededDataAccess.updateReviewInvitationStatus("INV_SEEDED", {});
  assert.equal(updatedSeeded.status, "accepted");

  const seededNotificationsAccess = createDataAccess({
    seed: {
      papers: [],
      reviewers: [],
      assignments: [],
      notifications: [{ invitationId: "seed_inv", deliveryStatus: "sent" }],
    },
  });
  assert.equal(seededNotificationsAccess.listNotificationRecords().length, 1);
  assert.equal(seededNotificationsAccess.listNotificationRecords()[0].invitationId, "seed_inv");

  const normalizedDataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "R1", eligibilityStatus: true }],
      assignments: [],
      reviewInvitations: [{ id: " I_SEEDED ", reviewerId: " R1 ", paperId: " P1 ", status: "pending" }],
      notifications: [{ invitationId: " seeded_invitation ", deliveryStatus: " sent " }],
    },
  });
  assert.equal(normalizedDataAccess.getReviewInvitationById("I_SEEDED").id, "I_SEEDED");
  assert.equal(normalizedDataAccess.listReviewInvitationsByReviewer("R1").length, 1);
  assert.equal(normalizedDataAccess.listNotificationRecords()[0].invitationId, "seeded_invitation");

  const updatedWithoutStatus = normalizedDataAccess.updateReviewInvitationStatus("I_SEEDED", {});
  assert.equal(updatedWithoutStatus.status, "pending");
  assert.equal(updatedWithoutStatus.respondedAt, null);

  const invitationCreationCalls = [];
  const assignmentService = createAssignmentService({
    dataAccess: {
      getPaperById() {
        return { id: "P1", status: "submitted" };
      },
      getAssignmentsByPaperId() {
        return [];
      },
      listEligibleReviewers() {
        return [{ id: "R1" }, { id: "R2" }, { id: "R3" }];
      },
      getReviewerById(id) {
        return { id, eligibilityStatus: true, currentAssignmentCount: 0 };
      },
      createAssignments({ reviewerIds }) {
        return reviewerIds.map((reviewerId, i) => ({ id: `A${i + 1}`, reviewerId, paperId: "P1" }));
      },
    },
    notificationService: {
      async sendReviewerInvitations() {
        return { type: "sent", failures: [] };
      },
    },
    invitationCreationService: {
      async createForAssignments(payload) {
        invitationCreationCalls.push(payload);
      },
    },
  });

  const assignmentResult = await assignmentService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(assignmentResult.type, "success");
  assert.equal(invitationCreationCalls.length, 1);
});

test("UC-11 review invitation service executes default authorization fallback", () => {
  const dataAccess = {
    listReviewInvitationsByReviewer() {
      return [
        { id: "I1", reviewerId: "R1", paperId: "P1", status: "pending", createdAt: "2026-02-01T00:00:00.000Z" },
      ];
    },
    getReviewInvitationById() {
      return {
        id: "I1",
        reviewerId: "R1",
        paperId: "P1",
        status: "pending",
        createdAt: "2026-02-01T00:00:00.000Z",
      };
    },
    getPaperById() {
      return { id: "P1", title: "Paper 1", abstract: "Abstract" };
    },
  };

  const service = createReviewInvitationService({
    dataAccess,
    invitationStatusService: { refreshStatuses() {} },
  });

  const list = service.listForReviewer({ reviewerId: "R1", status: "pending", page: 1, pageSize: 20 });
  assert.equal(list.items.length, 1);

  const detail = service.getById({ reviewerId: "R1", invitationId: "I1" });
  assert.equal(detail.id, "I1");
});

test("UC-11 notification-service recipient id/email normalization branches", async () => {
  const sent = [];
  const recorded = [];
  const service = createDecisionNotificationService({
    submissionRepository: {
      async recordNotification(notification) {
        recorded.push(notification);
      },
    },
    notifier: {
      async sendEmail(payload) {
        sent.push(payload);
      },
    },
  });

  const result = await service.notifyDecisionPublished({
    paper_id: "P_NOTIFY",
    submitting_author: {
      id: "  A_NOTIFY  ",
      email: "  notify.trimmed@example.com  ",
    },
  });

  assert.equal(result.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "notify.trimmed@example.com");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].recipient_author_id, "A_NOTIFY");
});

test("UC-11 server static routes for invitation assets and index are reachable", async () => {
  const { server } = createAppServer();
  const handler = server.listeners("request")[0];

  async function invoke(pathname) {
    const req = {
      method: "GET",
      url: pathname,
      headers: { host: "localhost" },
    };

    const response = {};
    await new Promise((resolve) => {
      const res = {
        writeHead(status, headers) {
          response.status = status;
          response.headers = headers;
        },
        end(body) {
          response.body = body;
          resolve();
        },
      };
      Promise.resolve(handler(req, res)).catch((error) => {
        response.error = error;
        resolve();
      });
    });

    return response;
  }

  const domJs = await invoke("/js/dom.js");
  assert.equal(domJs.status, 200);
  assert.equal(domJs.headers["Content-Type"], "application/javascript");

  const reviewInvitationsJs = await invoke("/js/review-invitations.js");
  assert.equal(reviewInvitationsJs.status, 200);
  assert.equal(reviewInvitationsJs.headers["Content-Type"], "application/javascript");

  const index = await invoke("/index.html");
  assert.equal(index.status, 200);
  assert.equal(index.headers["Content-Type"], "text/html");
});

test("UC-11 invitation status updater handles undefined list", () => {
  const service = createInvitationStatusService({ now: () => new Date("2026-03-01T00:00:00.000Z") });
  const result = service.refreshStatuses();
  assert.equal(result.changed, 0);
});
