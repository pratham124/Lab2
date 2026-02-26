const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createScheduleService } = require("../../src/services/schedule_service");
const { createNotificationService } = require("../../src/services/notification_service");
const { createAuditLogService } = require("../../src/services/audit_log_service");
const { createPresentationDetailsService } = require("../../src/services/presentation_details_service");
const { createAuthService } = require("../../src/services/auth_service");
const {
  createAuthorSubmissionsController,
} = require("../../src/controllers/author_submissions_controller");
const {
  createAuthorPresentationDetailsController,
} = require("../../src/controllers/author_presentation_details_controller");
const { createAdminScheduleController } = require("../../src/controllers/admin_schedule_controller");

function parseJson(response) {
  return JSON.parse(response.body);
}

function createHarness({
  papers,
  presentationDetails,
  conferenceTimezone = "UTC",
  inviteShouldFail = false,
  retrievalThrows = false,
} = {}) {
  const state = {
    auditLogs: [],
    sendCalls: [],
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

  const dataAccess = createDataAccess({
    seed: {
      papers:
        papers ||
        [
          {
            id: "P1",
            conferenceId: "C1",
            title: "Accepted Paper P1",
            status: "accepted",
            authorId: "A1",
            authorIds: ["A1"],
          },
          {
            id: "P2",
            conferenceId: "C1",
            title: "Rejected Paper P2",
            status: "rejected",
            authorId: "A2",
            authorIds: ["A2"],
          },
          {
            id: "P9",
            conferenceId: "C1",
            title: "Accepted Paper P9",
            status: "accepted",
            authorId: "A9",
            authorIds: ["A9"],
          },
        ],
      presentationDetails:
        presentationDetails ||
        [
          {
            paperId: "P1",
            date: "2026-04-10",
            time: "10:00",
            session: "S1",
            location: "Room R1",
            timezone: conferenceTimezone,
          },
          {
            paperId: "P9",
            date: "2026-04-11",
            time: "14:00",
            session: "S4",
            location: "Room R3",
            timezone: conferenceTimezone,
          },
        ],
      conferenceTimezone,
    },
  });

  const storageAdapter = {
    getSchedule({ conferenceId }) {
      return state.scheduleByConference.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      state.scheduleByConference.set(conferenceId, schedule);
      return schedule;
    },
    listAcceptedPapers() {
      return dataAccess.listAcceptedPapers();
    },
    getSchedulingParameters() {
      return {};
    },
  };

  const sessionService = {
    validate(sessionId) {
      const sessions = {
        sid_admin: { user_id: "admin_1", role: "admin" },
        sid_a1: { user_id: "A1", role: "author" },
        sid_a1_later: { user_id: "A1", role: "author" },
        sid_a2: { user_id: "A2", role: "author" },
      };
      return sessions[sessionId] || null;
    },
  };

  const actorAuth = createAuthService({ sessionService });
  const scheduleService = createScheduleService({
    storageAdapter,
    scheduleGenerator: {
      generate() {
        return { type: "success", schedule: state.scheduleByConference.get("C1") };
      },
    },
  });
  const authorizationService = createAuthorizationService({ dataAccess });
  const notificationService = createNotificationService({
    inviter: {
      async sendInvitation(payload) {
        state.sendCalls.push(payload);
        if (inviteShouldFail) {
          throw new Error("MAILER_DOWN");
        }
      },
    },
    dataAccess,
  });
  const auditLogService = createAuditLogService({
    logger: {
      warn(line) {
        state.auditLogs.push(JSON.parse(line));
      },
    },
  });
  const presentationDetailsService = retrievalThrows
    ? {
        getByPaperId() {
          throw new Error("DB_READ_FAILURE");
        },
      }
    : createPresentationDetailsService({ dataAccess });

  const adminScheduleController = createAdminScheduleController({
    scheduleService,
    notificationService,
    auditLogService,
    authService: actorAuth,
    conferenceId: "C1",
    conferenceTimezone,
  });
  const authorSubmissionsController = createAuthorSubmissionsController({
    dataAccess,
    presentationDetailsService:
      retrievalThrows || typeof presentationDetailsService.validatePaperDetailsMapping !== "function"
        ? null
        : presentationDetailsService,
    authService: actorAuth,
  });
  const authorPresentationDetailsController = createAuthorPresentationDetailsController({
    dataAccess,
    authorizationService,
    scheduleService,
    presentationDetailsService,
    auditLogService,
    authService: actorAuth,
  });

  return {
    state,
    dataAccess,
    adminScheduleController,
    authorSubmissionsController,
    authorPresentationDetailsController,
  };
}

function authorHeaders(sessionId) {
  return {
    cookie: `cms_session=${sessionId}`,
    accept: "application/json",
  };
}

async function publishSchedule(harness) {
  const response = await harness.adminScheduleController.handlePublish({
    headers: {
      cookie: "cms_session=sid_admin",
      accept: "application/json",
    },
  });
  assert.equal(response.status, 200);
  return parseJson(response);
}

test("AT-UC18-01 — Author Can View Presentation Details for Accepted Paper (Main Success Scenario)", async () => {
  const harness = createHarness({ conferenceTimezone: "America/New_York" });
  await publishSchedule(harness);

  const submissions = await harness.authorSubmissionsController.handleListSubmissions({
    headers: authorHeaders("sid_a1"),
  });
  assert.equal(submissions.status, 200);

  const details = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a1"),
    params: { paperId: "P1" },
  });
  assert.equal(details.status, 200);

  const payload = parseJson(details);
  assert.equal(payload.paperId, "P1");
  assert.equal(payload.date, "2026-04-10");
  assert.equal(payload.time, "10:00");
  assert.equal(payload.session, "S1");
  assert.equal(payload.location, "Room R1");
  assert.equal(payload.timezone, "America/New_York");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "P9"), false);
});

test("AT-UC18-02 — Notification Sent When Final Schedule Is Published", async () => {
  const harness = createHarness();
  const publishPayload = await publishSchedule(harness);

  assert.equal(typeof publishPayload.publishedAt, "string");
  assert.equal(Number.isInteger(publishPayload.notificationsEnqueuedCount), true);
  assert.equal(publishPayload.notificationsEnqueuedCount > 0, true);
  assert.equal(harness.state.sendCalls.length > 0, true);
  assert.equal(
    harness.state.sendCalls.every((entry) => entry.type === "final_schedule"),
    true
  );

  const records = harness.dataAccess.listNotificationRecordsByType("final_schedule");
  const a1Records = records.filter((entry) => entry.authorId === "A1");
  const a2Records = records.filter((entry) => entry.authorId === "A2");
  assert.equal(a1Records.length > 0, true);
  assert.equal(a2Records.length, 0);
});

test("AT-UC18-03 — Delayed Login: Schedule Still Accessible Later (Extension 3a)", async () => {
  const harness = createHarness();
  await publishSchedule(harness);

  const nowView = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a1"),
    params: { paperId: "P1" },
  });
  assert.equal(nowView.status, 200);

  const laterView = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a1_later"),
    params: { paperId: "P1" },
  });
  assert.equal(laterView.status, 200);
  assert.deepEqual(parseJson(laterView), parseJson(nowView));
});

test("AT-UC18-04 — Multiple Accepted Papers: Author Can See Details for Each (Extension 6a)", async () => {
  const harness = createHarness({
    papers: [
      {
        id: "P2",
        conferenceId: "C1",
        title: "Accepted Paper P2",
        status: "accepted",
        authorId: "A2",
        authorIds: ["A2"],
      },
      {
        id: "P3",
        conferenceId: "C1",
        title: "Accepted Paper P3",
        status: "accepted",
        authorId: "A2",
        authorIds: ["A2"],
      },
    ],
    presentationDetails: [
      {
        paperId: "P2",
        date: "2026-04-10",
        time: "11:00",
        session: "S2",
        location: "Room R2",
        timezone: "UTC",
      },
      {
        paperId: "P3",
        date: "2026-04-11",
        time: "09:30",
        session: "S3",
        location: "Room R1",
        timezone: "UTC",
      },
    ],
  });
  await publishSchedule(harness);

  const listResponse = await harness.authorSubmissionsController.handleListSubmissions({
    headers: authorHeaders("sid_a2"),
  });
  assert.equal(listResponse.status, 200);
  const submissions = parseJson(listResponse).submissions;
  assert.deepEqual(
    submissions.map((entry) => entry.id).sort(),
    ["P2", "P3"]
  );

  const p2 = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a2"),
    params: { paperId: "P2" },
  });
  const p3 = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a2"),
    params: { paperId: "P3" },
  });
  assert.equal(p2.status, 200);
  assert.equal(p3.status, 200);
  assert.equal(parseJson(p2).session, "S2");
  assert.equal(parseJson(p3).session, "S3");
  assert.notEqual(parseJson(p2).paperId, parseJson(p3).paperId);
});

test("AT-UC18-05 — Notification Failure Does Not Block Access (Extension 2a)", async () => {
  const harness = createHarness({ inviteShouldFail: true });
  const publishPayload = await publishSchedule(harness);
  assert.equal(publishPayload.notificationsEnqueuedCount > 0, true);

  const logEvents = harness.state.auditLogs.map((entry) => entry.event);
  assert.equal(logEvents.includes("final_schedule_notification_failed"), true);

  const details = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a1"),
    params: { paperId: "P1" },
  });
  assert.equal(details.status, 200);
});

test("AT-UC18-06 — Retrieval Error: Show Friendly Error (Extension 7a)", async () => {
  const harness = createHarness({ retrievalThrows: true });
  await publishSchedule(harness);

  const details = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a1"),
    params: { paperId: "P1" },
  });
  assert.equal(details.status, 503);

  const payload = parseJson(details);
  assert.equal(payload.category, "service_unavailable");
  assert.equal(typeof payload.nextStep, "string");
  assert.equal(payload.nextStep.length > 0, true);
  assert.equal(payload.reportIssueAvailable, true);
  assert.equal(String(payload.message).includes("DB_READ_FAILURE"), false);

  const retrievalEvents = harness.state.auditLogs.filter(
    (entry) => entry.event === "final_schedule_retrieval_error"
  );
  assert.equal(retrievalEvents.length > 0, true);
});

test("AT-UC18-07 — Authorization: Author Cannot View Another Author’s Paper Schedule Details", async () => {
  const harness = createHarness();
  await publishSchedule(harness);

  const unauthorized = await harness.authorPresentationDetailsController.handleGetPresentationDetails({
    headers: authorHeaders("sid_a1"),
    params: { paperId: "P9" },
  });
  assert.equal(unauthorized.status, 403);
  const payload = parseJson(unauthorized);
  assert.equal(payload.category, "forbidden");
});
