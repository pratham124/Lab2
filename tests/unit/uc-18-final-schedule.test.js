const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createScheduleService } = require("../../src/services/schedule_service");
const { createPresentationDetailsService } = require("../../src/services/presentation_details_service");
const { createNotificationService } = require("../../src/services/notification_service");
const {
  createAuthorPresentationDetailsController,
} = require("../../src/controllers/author_presentation_details_controller");

function buildDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        {
          id: "P18A",
          conferenceId: "C1",
          title: "Accepted A",
          status: "accepted",
          authorId: "author_1",
          authorIds: ["author_1"],
        },
      ],
      presentationDetails: [
        {
          paperId: "P18A",
          date: "2026-04-10",
          time: "10:00",
          session: "S1",
          location: "Room R1",
          timezone: "UTC",
        },
      ],
    },
  });
}

test("UC-18 authorization service checks author ownership", () => {
  const dataAccess = buildDataAccess();
  const authz = createAuthorizationService({ dataAccess });
  assert.equal(authz.canAccessAuthorPaper({ authorId: "author_1", paperId: "P18A" }), true);
  assert.equal(authz.canAccessAuthorPaper({ authorId: "author_2", paperId: "P18A" }), false);
});

test("UC-18 schedule service supports draft->published checks", () => {
  const store = {
    scheduleByConference: new Map([
      [
        "C1",
        {
          id: "S1",
          conferenceId: "C1",
          status: "generated",
          sessions: [],
          items: [],
        },
      ],
    ]),
  };
  const storageAdapter = {
    getSchedule({ conferenceId }) {
      return store.scheduleByConference.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      store.scheduleByConference.set(conferenceId, schedule);
      return schedule;
    },
    listAcceptedPapers() {
      return [];
    },
    getSchedulingParameters() {
      return {};
    },
  };

  const scheduleService = createScheduleService({
    storageAdapter,
    scheduleGenerator: { generate() { return { type: "success", schedule: {} }; } },
  });

  assert.equal(scheduleService.ensurePublished({ conferenceId: "C1" }).type, "not_published");
  const published = scheduleService.publishSchedule({ conferenceId: "C1", conferenceTimezone: "UTC" });
  assert.equal(published.type, "success");
  assert.equal(scheduleService.ensurePublished({ conferenceId: "C1" }).type, "published");
});

test("UC-18 notification service enqueues accepted-paper notifications", async () => {
  const dataAccess = buildDataAccess();
  const service = createNotificationService({
    inviter: { async sendInvitation() {} },
    dataAccess,
  });
  const enqueueResult = service.enqueueFinalScheduleNotifications({
    conferenceId: "C1",
    publishedAt: "2026-02-26T00:00:00.000Z",
    conferenceTimezone: "UTC",
  });
  assert.equal(enqueueResult.notificationsEnqueuedCount, 2);
  const retry = await service.retryFailedFinalScheduleNotifications();
  assert.equal(retry.attempted >= 0, true);
});

test("UC-18 presentation details controller blocks access before publication", async () => {
  const dataAccess = buildDataAccess();
  const authz = createAuthorizationService({ dataAccess });
  const detailsService = createPresentationDetailsService({ dataAccess });
  const controller = createAuthorPresentationDetailsController({
    dataAccess,
    authorizationService: authz,
    scheduleService: {
      ensurePublished() {
        return { type: "not_published" };
      },
    },
    presentationDetailsService: detailsService,
    authService: {
      resolveActor() {
        return { id: "author_1", role: "author" };
      },
    },
  });

  const result = await controller.handleGetPresentationDetails({
    headers: {},
    params: { paperId: "P18A" },
  });
  assert.equal(result.status, 409);
});
