const test = require("node:test");
const assert = require("node:assert/strict");

const { createFinalSchedule } = require("../../src/models/final_schedule");
const { createPresentationDetails } = require("../../src/models/presentation_details");
const { createNotification } = require("../../src/models/notification");
const { createPaper } = require("../../src/models/paper");
const { buildErrorMessage } = require("../../src/lib/error_messages");
const { createDataAccess } = require("../../src/services/data_access");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createPresentationDetailsService } = require("../../src/services/presentation_details_service");
const { createAuditLogService } = require("../../src/services/audit_log_service");
const { createScheduleService } = require("../../src/services/schedule_service");
const { createNotificationService } = require("../../src/services/notification_service");
const { createAdminScheduleController } = require("../../src/controllers/admin_schedule_controller");
const {
  createAuthorSubmissionsController,
} = require("../../src/controllers/author_submissions_controller");
const {
  createAuthorPresentationDetailsController,
} = require("../../src/controllers/author_presentation_details_controller");

function parseJson(response) {
  return JSON.parse(response.body);
}

test("UC-18 models/lib normalize defaults and fallbacks", () => {
  const finalSchedule = createFinalSchedule({ id: "  ", conferenceTimezone: "  " });
  assert.equal(finalSchedule.id, "final_schedule");
  assert.equal(finalSchedule.status, "draft");
  assert.equal(finalSchedule.conferenceTimezone, "UTC");

  const presentation = createPresentationDetails({ paperId: " P1 " });
  assert.equal(presentation.paperId, "P1");
  assert.equal(presentation.id.startsWith("presentation_"), true);

  const notification = createNotification({
    deliveryStatus: " failed ",
    retryCount: "2",
    authorId: " a1 ",
    paperId: " p1 ",
  });
  assert.equal(notification.status, "failed");
  assert.equal(notification.deliveryStatus, "failed");
  assert.equal(notification.retryCount, 2);
  assert.equal(notification.authorId, "a1");
  assert.equal(notification.paperId, "p1");

  const paper = createPaper({ authorId: " a1 " });
  assert.deepEqual(paper.authorIds, ["a1"]);

  const explicitAuthorsPaper = createPaper({ authorIds: [" a2 ", "", "a3"] });
  assert.deepEqual(explicitAuthorsPaper.authorIds, ["a2", "a3"]);

  const defaultMsg = buildErrorMessage({});
  assert.equal(defaultMsg.category, "service_unavailable");
  assert.equal(defaultMsg.reportIssueAvailable, false);
  const customMsg = buildErrorMessage({ category: "x", nextStep: "y", message: "z", reportIssueAvailable: 1 });
  assert.equal(customMsg.category, "x");
  assert.equal(customMsg.nextStep, "y");
  assert.equal(customMsg.message, "z");
  assert.equal(customMsg.reportIssueAvailable, true);

  const blankCategory = buildErrorMessage({ category: "   " });
  assert.equal(blankCategory.category, "service_unavailable");

  const blankStatusSchedule = createFinalSchedule({ status: "   " });
  assert.equal(blankStatusSchedule.status, "draft");

  const blankTypeNotification = createNotification({ type: "   " });
  assert.equal(blankTypeNotification.type, "");
  assert.equal(createNotification().type, "review_invitation");
});

test("UC-18 data_access author/presentation/notification helpers cover branches", () => {
  const access = createDataAccess({
    seed: {
      papers: [
        { id: "P1", status: "accepted", authorId: "A1" },
        { id: "P2", status: "ACCEPTED", authorIds: ["A2", "A3"] },
        { id: "P3", status: "rejected", authorId: "A2" },
      ],
      presentationDetails: [{ paperId: "P1", timezone: "" }],
      notifications: [{ type: " final_schedule ", channel: "email", status: "pending" }],
      conferenceTimezone: "America/New_York",
    },
  });

  assert.deepEqual(access.listPapersByAuthorId(""), []);
  assert.deepEqual(access.listPapersByAuthorId("A1").map((p) => p.id), ["P1"]);
  assert.deepEqual(access.listPapersByAuthorId("A2").map((p) => p.id).sort(), ["P2", "P3"]);
  assert.deepEqual(access.listAcceptedPapersByAuthorId("A2").map((p) => p.id), ["P2"]);
  assert.equal(access.isPaperOwnedByAuthor({ authorId: "A1", paperId: "P1" }), true);
  assert.equal(access.isPaperOwnedByAuthor({ authorId: "A3", paperId: "P2" }), true);
  assert.equal(access.isPaperOwnedByAuthor({ authorId: "", paperId: "P2" }), false);
  assert.equal(access.isPaperOwnedByAuthor({ authorId: "A9", paperId: "PX" }), false);
  assert.deepEqual(access.listAcceptedAuthors().sort(), ["A1", "A2", "A3"]);

  assert.equal(access.getPresentationDetailsByPaperId("missing"), null);
  assert.equal(access.getPresentationDetailsByPaperId("P1").timezone, "America/New_York");
  assert.equal(access.savePresentationDetails({ paperId: "P2" }).timezone, "America/New_York");
  assert.equal(access.getConferenceTimezone(), "America/New_York");

  assert.equal(access.listNotificationRecordsByType("final_schedule").length, 1);
  assert.equal(access.listNotificationRecordsByType("missing").length, 0);

  const paper = access.getPaperById("P1");
  paper.authorIds = null;
  assert.deepEqual(access.listPapersByAuthorId("A9"), []);
});

test("UC-18 authorization service author access branches", () => {
  const calls = [];
  const service = createAuthorizationService({
    dataAccess: {
      isPaperOwnedByAuthor({ authorId, paperId }) {
        return authorId === "A1" && paperId === "P1";
      },
    },
    securityLogService: {
      logUnauthorizedAccess() {},
      logUnauthorizedPaperAccess(payload) {
        calls.push(payload);
      },
    },
  });

  assert.equal(service.canAccessAuthorPaper({ authorId: "A1", paperId: "P1" }), true);
  assert.equal(service.canAccessAuthorPaper({ authorId: "A2", paperId: "P1" }), false);
  assert.equal(service.canAccessAuthorPaper({ authorId: "", paperId: "P1" }), false);
  assert.equal(calls.length >= 2, true);

  const noDataAccess = createAuthorizationService({
    securityLogService: {
      logUnauthorizedAccess() {},
      logUnauthorizedPaperAccess(payload) {
        calls.push(payload);
      },
    },
  });
  assert.equal(noDataAccess.canAccessAuthorPaper({ authorId: "A1", paperId: "P1" }), false);
});

test("UC-18 presentation details service branches", () => {
  assert.throws(() => createPresentationDetailsService(), /dataAccess is required/);

  const serviceNoMethods = createPresentationDetailsService({ dataAccess: {} });
  assert.equal(serviceNoMethods.getByPaperId({ paperId: "" }).type, "not_found");
  assert.equal(serviceNoMethods.getByPaperId({ paperId: "P1" }).type, "not_found");
  assert.deepEqual(serviceNoMethods.listByAuthorId({ authorId: "A1" }), []);
  assert.equal(serviceNoMethods.validatePaperDetailsMapping({ paperId: "", details: {} }), false);

  const service = createPresentationDetailsService({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [{ id: "P1" }, { id: "P2" }];
      },
      getPresentationDetailsByPaperId(paperId) {
        if (paperId === "P1") {
          return { paperId: "P1", session: "S1" };
        }
        return null;
      },
    },
  });
  assert.equal(service.getByPaperId({ paperId: "P1" }).type, "success");
  assert.equal(service.getByPaperId({ paperId: "P2" }).type, "not_found");
  assert.deepEqual(service.listByAuthorId({ authorId: "A1" }).map((e) => e.paper.id), ["P1"]);
  assert.equal(service.validatePaperDetailsMapping({ paperId: " P1 ", details: { paperId: "P1" } }), true);
  assert.equal(service.validatePaperDetailsMapping({ paperId: "P1", details: { paperId: "P2" } }), false);

  const serviceMissingDetailFetcher = createPresentationDetailsService({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [{ id: "P9" }];
      },
    },
  });
  assert.deepEqual(serviceMissingDetailFetcher.listByAuthorId({ authorId: "A1" }), []);
});

test("UC-18 audit log service logs and fallback logger branches", () => {
  const entries = [];
  const loggerService = createAuditLogService({
    logger: {
      warn(line) {
        entries.push(JSON.parse(line));
      },
    },
  });
  loggerService.append("", {});
  loggerService.logRetrievalError({ actorId: " A1 ", paperId: " P1 ", reason: "" });
  loggerService.logNotificationFailure({ conferenceId: " C1 ", authorId: " A1 ", paperId: " P1 " });
  assert.equal(entries[0].event, "audit_event");
  assert.equal(entries[1].event, "final_schedule_retrieval_error");
  assert.equal(entries[1].reason, "unknown");
  assert.equal(entries[2].event, "final_schedule_notification_failed");
  assert.equal(entries[2].reason, "unknown");

  assert.doesNotThrow(() => createAuditLogService().logRetrievalError({ actorId: "A", paperId: "P" }));
  assert.doesNotThrow(() => createAuditLogService().logNotificationFailure({ conferenceId: "C", authorId: "A", paperId: "P" }));
});

test("UC-18 schedule service publication branches", () => {
  const state = {
    byConference: new Map([
      ["C1", { id: "S1", conferenceId: "C1", status: "generated", sessions: [], items: [] }],
      ["C2", { id: "S2", conferenceId: "C2", status: "published", sessions: [], items: [] }],
    ]),
  };
  const storageAdapter = {
    getSchedule({ conferenceId }) {
      return state.byConference.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      state.byConference.set(conferenceId, schedule);
      return schedule;
    },
    listAcceptedPapers() {
      return [];
    },
    getSchedulingParameters() {
      return {};
    },
  };
  const service = createScheduleService({
    storageAdapter,
    scheduleGenerator: { generate() { return { type: "success", schedule: {} }; } },
  });

  assert.equal(service.isSchedulePublished({ conferenceId: "C1" }), false);
  assert.equal(service.isSchedulePublished({ conferenceId: "C2" }), true);
  assert.equal(service.ensurePublished({ conferenceId: "C1" }).type, "not_published");
  assert.equal(service.ensurePublished({ conferenceId: "C2" }).type, "published");
  assert.equal(service.canAccessPublishedSchedule({ conferenceId: "C2" }), true);
  assert.equal(service.publishSchedule({ conferenceId: "missing" }).type, "not_found");
  assert.equal(service.publishSchedule({ conferenceId: "C2" }).type, "already_published");

  const published = service.publishSchedule({
    conferenceId: "C1",
    conferenceTimezone: "UTC",
    publishedBy: " admin_1 ",
  });
  assert.equal(published.type, "success");
  assert.equal(published.schedule.status, "published");
  assert.equal(published.schedule.publishedBy, "admin_1");

  const fallbackConferenceService = createScheduleService({
    storageAdapter: {
      getSchedule() {
        return { id: "S9", conferenceId: "CFALLBACK", status: "generated" };
      },
      saveSchedule({ schedule }) {
        return schedule;
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {};
      },
    },
    scheduleGenerator: { generate() { return { type: "success", schedule: {} }; } },
  });
  const fallbackPublish = fallbackConferenceService.publishSchedule({
    conferenceId: "",
    conferenceTimezone: "UTC",
    publishedBy: "",
  });
  assert.equal(fallbackPublish.type, "success");
  assert.equal(fallbackPublish.schedule.conferenceId, "CFALLBACK");
});

test("UC-18 final schedule notification service branches", async () => {
  const fallbackService = createNotificationService({});
  assert.deepEqual(
    fallbackService.enqueueFinalScheduleNotifications({ conferenceId: "C1" }),
    { notificationsEnqueuedCount: 0, notifications: [] }
  );
  assert.deepEqual(await fallbackService.retryFailedFinalScheduleNotifications(), { attempted: 0, failed: 0 });

  const records = [];
  const dataAccess = {
    listAcceptedPapers() {
      return [
        { id: "P1", authorIds: ["A1", ""] },
        { id: "P2", authorId: "A2" },
      ];
    },
    createNotificationRecord(input) {
      const record = { ...input, deliveryStatus: input.status, retryCount: Number(input.retryCount || 0) };
      records.push(record);
      return record;
    },
    listNotificationRecordsByType() {
      return records.filter((entry) => entry.type === "final_schedule");
    },
  };
  let failMode = "none";
  const service = createNotificationService({
    dataAccess,
    inviter: {
      async sendInvitation() {
        if (failMode === "error_message") {
          throw new Error("SMTP_DOWN");
        }
        if (failMode === "error_blank") {
          throw {};
        }
      },
    },
  });

  const enqueued = service.enqueueFinalScheduleNotifications({
    conferenceId: " C1 ",
    publishedAt: "2026-02-26T00:00:00.000Z",
    conferenceTimezone: "UTC",
  });
  assert.equal(enqueued.notificationsEnqueuedCount, 4);
  assert.equal(records.every((entry) => String(entry.payload.conferenceId) === "C1"), true);

  const sentTarget = records.find((entry) => entry.channel === "email" && entry.authorId === "A1");
  const sentResult = await service.dispatchFinalScheduleEmail(sentTarget);
  assert.equal(sentResult.type, "sent");
  assert.equal(sentTarget.status, "sent");

  failMode = "error_message";
  const pendingTarget = { channel: "email", status: "pending", retryCount: 1 };
  const pendingResult = await service.dispatchFinalScheduleEmail(pendingTarget);
  assert.equal(pendingResult.type, "failed");
  assert.equal(pendingTarget.status, "pending");
  assert.equal(pendingTarget.failureReason, "SMTP_DOWN");

  failMode = "error_blank";
  const failedTarget = { channel: "email", status: "pending", retryCount: 2 };
  const failedResult = await service.dispatchFinalScheduleEmail(failedTarget);
  assert.equal(failedResult.type, "failed");
  assert.equal(failedTarget.status, "failed");
  assert.equal(failedTarget.failureReason, "notification_failed");

  failMode = "error_message";
  const retry = await service.retryFailedFinalScheduleNotifications();
  assert.equal(retry.attempted >= 0, true);
  assert.equal(retry.failed >= 0, true);
});

test("UC-18 admin schedule controller branches", async () => {
  assert.throws(() => createAdminScheduleController({}), /missing dependencies/);

  const auditCalls = [];
  const controller = createAdminScheduleController({
    scheduleService: {
      publishSchedule() {
        return { type: "success", publishedAt: "2026-02-26T00:00:00.000Z" };
      },
    },
    notificationService: {
      enqueueFinalScheduleNotifications() {
        return {
          notificationsEnqueuedCount: 2,
          notifications: [
            { channel: "in_app", authorId: "A1", paperId: "P1" },
            { channel: "email", authorId: "A1", paperId: "P1" },
          ],
        };
      },
      async dispatchFinalScheduleEmail() {
        return { type: "failed" };
      },
    },
    auditLogService: {
      logNotificationFailure(payload) {
        auditCalls.push(payload);
      },
    },
    authService: {
      requireAdmin() {
        return { ok: true, actor: { id: "admin_1" } };
      },
    },
  });
  const success = await controller.handlePublish({ headers: {} });
  assert.equal(success.status, 200);
  assert.equal(parseJson(success).notificationsEnqueuedCount, 2);
  assert.equal(auditCalls.length, 1);

  const unauthorized = createAdminScheduleController({
    scheduleService: { publishSchedule() {} },
    notificationService: { enqueueFinalScheduleNotifications() { return { notificationsEnqueuedCount: 0 }; } },
    authService: { requireAdmin() { return { ok: false, status: 401, errorCode: "x", message: "y" }; } },
  });
  assert.equal((await unauthorized.handlePublish({ headers: {} })).status, 401);

  const alreadyPublished = createAdminScheduleController({
    scheduleService: { publishSchedule() { return { type: "already_published" }; } },
    notificationService: { enqueueFinalScheduleNotifications() { return { notificationsEnqueuedCount: 0 }; } },
    authService: { requireAdmin() { return { ok: true, actor: { id: "admin_1" } }; } },
  });
  assert.equal((await alreadyPublished.handlePublish({ headers: {} })).status, 409);

  const notFound = createAdminScheduleController({
    scheduleService: { publishSchedule() { return { type: "not_found" }; } },
    notificationService: { enqueueFinalScheduleNotifications() { return { notificationsEnqueuedCount: 0 }; } },
    authService: { requireAdmin() { return { ok: true, actor: { id: "admin_1" } }; } },
  });
  assert.equal((await notFound.handlePublish({ headers: {} })).status, 404);

  const defaultAuthController = createAdminScheduleController({
    scheduleService: {
      publishSchedule() {
        return { type: "success", publishedAt: "2026-02-26T00:00:00.000Z" };
      },
    },
    notificationService: {
      enqueueFinalScheduleNotifications() {
        return { notificationsEnqueuedCount: 0 };
      },
      async dispatchFinalScheduleEmail() {
        return { type: "sent" };
      },
    },
  });
  assert.equal(
    (
      await defaultAuthController.handlePublish({
        headers: { "x-user-id": "admin_1", "x-user-role": "admin" },
      })
    ).status,
    200
  );
  assert.equal((await defaultAuthController.handlePublish()).status, 401);
});

test("UC-18 admin schedule controller executes fallback notification-failure logger function", async () => {
  const controller = createAdminScheduleController({
    scheduleService: {
      publishSchedule() {
        return { type: "success", publishedAt: "2026-02-26T00:00:00.000Z" };
      },
    },
    notificationService: {
      enqueueFinalScheduleNotifications() {
        return {
          notificationsEnqueuedCount: 1,
          notifications: [{ channel: "email", authorId: "A1", paperId: "P1", failureReason: "x" }],
        };
      },
      async dispatchFinalScheduleEmail() {
        return { type: "failed" };
      },
    },
    // intentionally omit auditLogService to trigger fallback `{ logNotificationFailure() {} }`
    authService: {
      requireAdmin() {
        return { ok: true, actor: { id: "admin_1" } };
      },
    },
  });

  const response = await controller.handlePublish({ headers: {} });
  assert.equal(response.status, 200);
});

test("UC-18 author submissions controller branches", async () => {
  assert.throws(() => createAuthorSubmissionsController(), /dataAccess is required/);

  const unauthorized = createAuthorSubmissionsController({
    dataAccess: {},
    authService: { resolveActor() { return null; } },
  });
  assert.equal((await unauthorized.handleListSubmissions({ headers: {} })).status, 401);

  const noListMethod = createAuthorSubmissionsController({
    dataAccess: {},
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  const noListPayload = parseJson(await noListMethod.handleListSubmissions({ headers: {} }));
  assert.deepEqual(noListPayload.submissions, []);

  const controller = createAuthorSubmissionsController({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [{ id: "P1", title: "T1", status: "accepted" }];
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        return { type: "success", details: { paperId: "P1", session: "S1" } };
      },
      validatePaperDetailsMapping() {
        return true;
      },
    },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  const payload = parseJson(await controller.handleListSubmissions({ headers: {} }));
  assert.equal(payload.submissions[0].presentationDetails.session, "S1");

  const failedDetails = createAuthorSubmissionsController({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [{ id: "P2", title: "T2", status: "accepted" }];
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        return { type: "not_found" };
      },
      validatePaperDetailsMapping() {
        return true;
      },
    },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal(parseJson(await failedDetails.handleListSubmissions({ headers: {} })).submissions[0].presentationDetails, null);

  const mismatchedDetails = createAuthorSubmissionsController({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [{ id: "P3", title: "T3", status: "accepted" }];
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        return { type: "success", details: { paperId: "PX" } };
      },
      validatePaperDetailsMapping() {
        return false;
      },
    },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal(parseJson(await mismatchedDetails.handleListSubmissions({ headers: {} })).submissions[0].presentationDetails, null);

  const noPresentationService = createAuthorSubmissionsController({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [{ id: "P4", title: "T4", status: "accepted" }];
      },
    },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal(parseJson(await noPresentationService.handleListSubmissions({ headers: {} })).submissions[0].presentationDetails, null);

  const defaultAuthController = createAuthorSubmissionsController({
    dataAccess: {
      listAcceptedPapersByAuthorId() {
        return [];
      },
    },
  });
  assert.equal(
    (
      await defaultAuthController.handleListSubmissions({
        headers: { "x-user-id": "A1", "x-user-role": "author" },
      })
    ).status,
    200
  );
  assert.equal((await defaultAuthController.handleListSubmissions()).status, 401);
});

test("UC-18 author presentation details controller branches", async () => {
  assert.throws(() => createAuthorPresentationDetailsController({}), /missing dependencies/);

  const baseDeps = {
    dataAccess: {
      getPaperById() {
        return { id: "P1", conferenceId: "C1" };
      },
    },
    authorizationService: {
      canAccessAuthorPaper() {
        return true;
      },
    },
    scheduleService: {
      ensurePublished() {
        return { type: "published" };
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        return { type: "success", details: { paperId: "P1" } };
      },
    },
  };

  const unauthorized = createAuthorPresentationDetailsController({
    ...baseDeps,
    authService: { resolveActor() { return null; } },
  });
  assert.equal((await unauthorized.handleGetPresentationDetails({ headers: {}, params: {} })).status, 401);

  const missingPaper = createAuthorPresentationDetailsController({
    ...baseDeps,
    dataAccess: { getPaperById() { return null; } },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal((await missingPaper.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } })).status, 404);

  const missingDataAccessMethod = createAuthorPresentationDetailsController({
    ...baseDeps,
    dataAccess: {},
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal((await missingDataAccessMethod.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } })).status, 404);

  const forbidden = createAuthorPresentationDetailsController({
    ...baseDeps,
    authorizationService: { canAccessAuthorPaper() { return false; } },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal((await forbidden.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } })).status, 403);

  const notPublished = createAuthorPresentationDetailsController({
    ...baseDeps,
    scheduleService: { ensurePublished() { return { type: "not_published" }; } },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal((await notPublished.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } })).status, 409);

  const notFoundDetails = createAuthorPresentationDetailsController({
    ...baseDeps,
    presentationDetailsService: { getByPaperId() { return { type: "not_found" }; } },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal((await notFoundDetails.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } })).status, 404);

  const success = createAuthorPresentationDetailsController({
    ...baseDeps,
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  assert.equal((await success.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } })).status, 200);

  const logs = [];
  const retrievalError = createAuthorPresentationDetailsController({
    ...baseDeps,
    presentationDetailsService: { getByPaperId() { throw {}; } },
    auditLogService: {
      logRetrievalError(payload) {
        logs.push(payload);
      },
    },
    authService: { resolveActor() { return { id: "A1" }; } },
  });
  const errorResponse = await retrievalError.handleGetPresentationDetails({ headers: {}, params: { paperId: "P1" } });
  assert.equal(errorResponse.status, 503);
  assert.equal(logs[0].reason, "schedule_retrieval_failed");

  const defaultAuthController = createAuthorPresentationDetailsController({
    ...baseDeps,
  });
  assert.equal(
    (
      await defaultAuthController.handleGetPresentationDetails({
        headers: { "x-user-id": "A1", "x-user-role": "author" },
        params: { paperId: "P1" },
      })
    ).status,
    200
  );
  assert.equal((await defaultAuthController.handleGetPresentationDetails({ params: { paperId: "P1" } })).status, 401);
});

test("UC-18 author presentation details controller executes fallback retrieval-error logger function", async () => {
  const controller = createAuthorPresentationDetailsController({
    dataAccess: {
      getPaperById() {
        return { id: "P1", conferenceId: "C1" };
      },
    },
    authorizationService: {
      canAccessAuthorPaper() {
        return true;
      },
    },
    scheduleService: {
      ensurePublished() {
        return { type: "published" };
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        throw new Error("boom");
      },
    },
    // intentionally omit auditLogService to trigger fallback `{ logRetrievalError() {} }`
    authService: {
      resolveActor() {
        return { id: "A1", role: "author" };
      },
    },
  });

  const response = await controller.handleGetPresentationDetails({
    headers: {},
    params: { paperId: "P1" },
  });
  assert.equal(response.status, 503);
});

test("UC-18 line-target coverage for remaining fallbacks", async () => {
  const callLog = {
    paperIds: [],
    conferenceIds: [],
  };

  const controller = createAuthorPresentationDetailsController({
    dataAccess: {
      getPaperById(paperId) {
        callLog.paperIds.push(paperId);
        if (!paperId) {
          return null;
        }
        return { id: paperId, conferenceId: "" };
      },
    },
    authorizationService: {
      canAccessAuthorPaper() {
        return true;
      },
    },
    scheduleService: {
      ensurePublished({ conferenceId }) {
        callLog.conferenceIds.push(conferenceId);
        return { type: "published" };
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        return { type: "success", details: { paperId: "P1" } };
      },
    },
    authService: {
      resolveActor() {
        return { id: "A1", role: "author" };
      },
    },
  });

  const missingParam = await controller.handleGetPresentationDetails({ headers: {} });
  assert.equal(missingParam.status, 404);
  assert.equal(callLog.paperIds[0], "");

  const success = await controller.handleGetPresentationDetails({
    headers: {},
    params: { paperId: "P1" },
  });
  assert.equal(success.status, 200);
  assert.equal(callLog.conferenceIds[0], "C1");

  const model = createNotification({ type: "" });
  assert.equal(model.type, "review_invitation");

  const accessDefaultTz = createDataAccess({
    seed: {
      papers: [{ id: "P1", status: "accepted", authorId: "A1" }],
      notifications: [{ type: "final_schedule" }, { type: "x" }],
    },
  });
  assert.equal(accessDefaultTz.getConferenceTimezone(), "UTC");
  assert.deepEqual(accessDefaultTz.listAcceptedPapersByAuthorId("A1").map((p) => p.id), ["P1"]);
  assert.deepEqual(accessDefaultTz.listAcceptedPapers().map((p) => p.id), ["P1"]);
  assert.equal(accessDefaultTz.listAcceptedAuthors()[0], "A1");
  assert.equal(accessDefaultTz.listNotificationRecordsByType().length, 0);
  assert.equal(accessDefaultTz.listNotificationRecordsByType("final_schedule").length, 1);
  assert.equal(accessDefaultTz.getPresentationDetailsByPaperId("missing"), null);

  const savedDetails = accessDefaultTz.savePresentationDetails({ paperId: "P1", timezone: "" });
  assert.equal(savedDetails.timezone, "UTC");
  assert.equal(accessDefaultTz.getPresentationDetailsByPaperId("P1").timezone, "UTC");

  const notifications = [];
  const notificationService = createNotificationService({
    dataAccess: {
      listAcceptedPapers() {
        return [{ id: "P1", authorIds: ["A1"] }];
      },
      createNotificationRecord(entry) {
        notifications.push(entry);
        return entry;
      },
      listNotificationRecordsByType() {
        return notifications;
      },
    },
  });
  notificationService.enqueueFinalScheduleNotifications({
    conferenceId: "  C1  ",
    publishedAt: "2026-02-26T00:00:00.000Z",
    conferenceTimezone: "UTC",
  });
  assert.equal(notifications[0].payload.conferenceId, "C1");
  assert.equal(notifications[1].payload.conferenceId, "C1");

  const logs = [];
  const audit = createAuditLogService({
    logger: {
      warn(line) {
        logs.push(JSON.parse(line));
      },
    },
  });
  audit.logRetrievalError({ actorId: null, paperId: undefined, reason: "" });
  audit.logNotificationFailure({ conferenceId: null, authorId: undefined, paperId: "", reason: "" });
  assert.equal(logs[0].actor_id, "");
  assert.equal(logs[0].paper_id, "");
  assert.equal(logs[1].conference_id, "");
  assert.equal(logs[1].author_id, "");
  assert.equal(logs[1].paper_id, "");

  const scheduleService = createScheduleService({
    storageAdapter: {
      getSchedule() {
        return { id: "S1", status: "" };
      },
      saveSchedule({ schedule }) {
        return schedule;
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {};
      },
    },
    scheduleGenerator: {
      generate() {
        return { type: "success", schedule: {} };
      },
    },
  });
  assert.equal(scheduleService.isSchedulePublished({ conferenceId: "C1" }), false);
  assert.equal(scheduleService.publishSchedule({ conferenceId: "C1" }).type, "success");
});

test("UC-18 final branch-targets for authorization/data-access/notification payload normalization", () => {
  const auditCalls = [];
  const authz = createAuthorizationService({
    dataAccess: {
      isPaperOwnedByAuthor() {
        return false;
      },
    },
    securityLogService: {
      logUnauthorizedAccess() {},
      logUnauthorizedPaperAccess(payload) {
        auditCalls.push(payload);
      },
    },
  });
  assert.equal(authz.canAccessAuthorPaper({ authorId: "A1", paperId: "" }), false);
  assert.equal(auditCalls[auditCalls.length - 1].paperId, "");

  const access = createDataAccess({
    seed: {
      conferenceTimezone: "   ",
      papers: [
        { id: "P1", authorId: "A1", status: "accepted" },
        { id: "P2", authorId: "A1" },
        { id: "P3", authorIds: ["", "A2"], status: "accepted" },
      ],
      notifications: [
        { id: "N1" },
        { id: "N2", type: " final_schedule " },
      ],
      presentationDetails: [{ paperId: "P1", timezone: "" }],
    },
  });
  assert.equal(access.getConferenceTimezone(), "UTC");
  assert.deepEqual(access.listAcceptedPapersByAuthorId("A1").map((p) => p.id), ["P1"]);
  assert.deepEqual(access.listAcceptedPapers().map((p) => p.id).sort(), ["P1", "P3"]);
  assert.deepEqual(access.listAcceptedAuthors().sort(), ["A1", "A2"]);
  assert.equal(access.listNotificationRecordsByType("").length, 0);
  assert.equal(access.listNotificationRecordsByType("final_schedule").length, 1);
  assert.equal(access.getPresentationDetailsByPaperId(), null);
  assert.equal(access.getPresentationDetailsByPaperId("P1").timezone, "UTC");

  const recorded = [];
  const notificationService = createNotificationService({
    dataAccess: {
      listAcceptedPapers() {
        return [{ id: "P1", authorId: "A1" }];
      },
      createNotificationRecord(entry) {
        recorded.push(entry);
        return entry;
      },
      listNotificationRecordsByType() {
        return recorded;
      },
    },
  });
  notificationService.enqueueFinalScheduleNotifications({
    publishedAt: "2026-02-26T00:00:00.000Z",
    conferenceTimezone: "UTC",
  });
  assert.equal(recorded[0].payload.conferenceId, "");
  assert.equal(recorded[1].payload.conferenceId, "");
});

test("UC-18 data_access residual branch coverage for status/type/timezone guards", () => {
  const access = createDataAccess({
    seed: {
      conferenceTimezone: "UTC",
      papers: [
        { id: "PA", authorId: "A1", status: "accepted" },
        { id: "PB", authorId: "A1", status: undefined },
        { id: "PC", authorId: "A1", status: "rejected" },
        { id: "PD", authorIds: ["", "A2"], status: "accepted" },
      ],
      notifications: [
        { id: "N1", type: "final_schedule" },
        { id: "N2", type: "   " },
      ],
      presentationDetails: [
        { paperId: "PA", date: "2026-04-10", time: "10:00", session: "S1", location: "R1", timezone: "UTC" },
      ],
    },
  });

  assert.deepEqual(access.listAcceptedPapersByAuthorId("A1").map((p) => p.id), ["PA"]);
  assert.deepEqual(access.listAcceptedPapers().map((p) => p.id).sort(), ["PA", "PD"]);
  assert.deepEqual(access.listAcceptedAuthors().sort(), ["A1", "A2"]);
  assert.equal(access.listNotificationRecordsByType("final_schedule").length, 1);
  assert.equal(access.listNotificationRecordsByType("").length, 1);

  const stored = access.savePresentationDetails({
    paperId: "PX",
    date: "2026-04-11",
    time: "09:00",
    session: "S2",
    location: "R2",
    timezone: "UTC",
  });
  stored.timezone = "   ";
  assert.equal(access.getPresentationDetailsByPaperId("PX").timezone, "UTC");
});

test("UC-18 data_access explicit fallback branches for status/authorIds/timezone", () => {
  const access = createDataAccess({
    seed: {
      papers: [
        { id: "P1", authorId: "A1", status: "accepted" },
        { id: "P2", authorIds: [" ", "A2"], status: "accepted" },
      ],
      presentationDetails: [
        { paperId: "P1", date: "2026-04-10", time: "10:00", session: "S1", location: "R1", timezone: "UTC" },
      ],
      conferenceTimezone: "UTC",
    },
  });

  const p1 = access.getPaperById("P1");
  const p2 = access.getPaperById("P2");
  p1.status = undefined;
  p2.status = "";

  assert.deepEqual(access.listAcceptedPapersByAuthorId("A1"), []);
  assert.deepEqual(access.listAcceptedPapers(), []);
  assert.deepEqual(access.listAcceptedAuthors(), []);

  const details = access.savePresentationDetails({
    paperId: "P2",
    date: "2026-04-11",
    time: "11:00",
    session: "S2",
    location: "R2",
    timezone: "UTC",
  });
  details.timezone = "   ";
  assert.equal(access.getPresentationDetailsByPaperId("P2").timezone, "UTC");
});

test("UC-18 data_access executes authorIds iteration and details timezone normalization return", () => {
  const access = createDataAccess({
    seed: {
      conferenceTimezone: "America/Chicago",
      papers: [
        { id: "P100", status: "accepted", authorId: "", authorIds: ["A100"] },
      ],
      presentationDetails: [
        {
          paperId: "P100",
          date: "2026-05-01",
          time: "09:00",
          session: "S100",
          location: "R100",
          timezone: "",
        },
      ],
    },
  });

  assert.deepEqual(access.listAcceptedAuthors(), ["A100"]);
  const details = access.getPresentationDetailsByPaperId("P100");
  assert.equal(details.timezone, "America/Chicago");
});

test("UC-18 data_access covers remaining branch outcomes for lines 144 and 358", () => {
  const access = createDataAccess({
    seed: {
      conferenceTimezone: "America/Denver",
      papers: [
        {
          id: "PB1",
          status: "accepted",
          authorId: "",
          authorIds: ["", "A_BRANCH"],
        },
      ],
      presentationDetails: [
        {
          paperId: "PD_EXISTING_TZ",
          date: "2026-06-01",
          time: "10:00",
          session: "S1",
          location: "R1",
          timezone: "Europe/Paris",
        },
        {
          paperId: "PD_CONFERENCE_TZ",
          date: "2026-06-01",
          time: "11:00",
          session: "S2",
          location: "R2",
          timezone: "",
        },
      ],
    },
  });

  const authors = access.listAcceptedAuthors();
  assert.deepEqual(authors, ["A_BRANCH"]);

  const existingTz = access.getPresentationDetailsByPaperId("PD_EXISTING_TZ");
  assert.equal(existingTz.timezone, "Europe/Paris");

  const conferenceTz = access.getPresentationDetailsByPaperId("PD_CONFERENCE_TZ");
  assert.equal(conferenceTz.timezone, "America/Denver");

  const accessUtcFallback = createDataAccess({
    seed: {
      conferenceTimezone: "   ",
      papers: [{ id: "PZ", status: "accepted", authorId: "AZ" }],
      presentationDetails: [
        {
          paperId: "PD_UTC_FALLBACK",
          date: "2026-06-02",
          time: "09:00",
          session: "S3",
          location: "R3",
          timezone: "   ",
        },
      ],
    },
  });
  const utcFallback = accessUtcFallback.getPresentationDetailsByPaperId("PD_UTC_FALLBACK");
  assert.equal(utcFallback.timezone, "UTC");
});

test("UC-18 data_access line 144 covers null authorId fallback and non-empty authorId", () => {
  const access = createDataAccess({
    seed: {
      papers: [
        {
          id: "P_LINE_144",
          status: "accepted",
          authorId: "",
          authorIds: [null, "A_OK"],
        },
      ],
    },
  });

  const authors = access.listAcceptedAuthors();
  assert.deepEqual(authors, ["A_OK"]);
});
