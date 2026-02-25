const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { createDataAccess } = require("../../src/services/data_access");
const { createReviewInvitationsController } = require("../../src/controllers/review_invitations_controller");
const { createInvitationStatusService } = require("../../src/services/invitation_status_service");
const { createReviewInvitationService } = require("../../src/services/review_invitation_service");
const {
  createReviewInvitationActionService,
} = require("../../src/services/review_invitation_action_service");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createNotificationService } = require("../../src/services/notification_service");
const { createInvitationCreationService } = require("../../src/services/invitation_creation_service");
const { createAssignmentService } = require("../../src/services/assignment_service");

function parseBody(response) {
  return JSON.parse(response.body);
}

function makeSessionService(map = {}) {
  return {
    validate(sessionId) {
      return map[sessionId] || null;
    },
  };
}

function makeInvitationController({
  dataAccess,
  now = "2026-02-25T12:00:00.000Z",
  sessionMap,
  securityLogSink,
  reviewInvitationServiceOverride,
} = {}) {
  const logs = securityLogSink || [];
  const authorizationService = createAuthorizationService({
    securityLogService: {
      logUnauthorizedAccess(entry) {
        logs.push(entry);
      },
    },
  });

  const invitationStatusService = createInvitationStatusService({
    now: () => new Date(now),
  });

  const reviewInvitationService =
    reviewInvitationServiceOverride ||
    createReviewInvitationService({
      dataAccess,
      invitationStatusService,
      authorizationService,
    });

  const reviewInvitationActionService = createReviewInvitationActionService({
    dataAccess,
    authorizationService,
  });

  const sessionService = makeSessionService(
    sessionMap || {
      sid_r1: { user_id: "R1", role: "reviewer" },
      sid_r2: { user_id: "R2", role: "reviewer" },
    }
  );

  const controller = createReviewInvitationsController({
    sessionService,
    reviewInvitationService,
    reviewInvitationActionService,
  });

  return {
    controller,
    logs,
  };
}

function buildDataAccessForList({ invitationCount = 3 } = {}) {
  const invitations = [];
  for (let idx = 1; idx <= invitationCount; idx += 1) {
    invitations.push({
      id: `I${idx}`,
      reviewerId: "R1",
      paperId: `P${idx}`,
      status: "pending",
      createdAt: `2026-02-${String(10 + idx).padStart(2, "0")}T10:00:00.000Z`,
      responseDueAt: "2026-03-10T00:00:00.000Z",
    });
  }

  invitations.push({
    id: "I_NON_PENDING",
    reviewerId: "R1",
    paperId: "P99",
    status: "accepted",
    createdAt: "2026-02-26T10:00:00.000Z",
    responseDueAt: "2026-03-10T00:00:00.000Z",
  });

  const papers = [{ id: "P99", title: "Paper 99", status: "submitted" }];
  for (let idx = 1; idx <= invitationCount; idx += 1) {
    papers.push({ id: `P${idx}`, title: `Paper ${idx}`, status: "submitted" });
  }

  return createDataAccess({
    seed: {
      papers,
      reviewers: [
        { id: "R1", name: "Reviewer 1", email: "r1@example.com", eligibilityStatus: true },
        { id: "R2", name: "Reviewer 2", email: "r2@example.com", eligibilityStatus: true },
      ],
      reviewInvitations: invitations,
    },
  });
}

function buildAssignmentHarness({ inviterBehavior } = {}) {
  const notifyAttempts = [];
  const warnLogs = [];

  const dataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Deterministic Paper", status: "submitted" }],
      reviewers: [
        { id: "R1", name: "Reviewer 1", email: "r1@example.com", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R2", name: "Reviewer 2", email: "r2@example.com", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R3", name: "Reviewer 3", email: "r3@example.com", eligibilityStatus: true, currentAssignmentCount: 1 },
      ],
    },
  });

  const notificationService = createNotificationService({
    dataAccess,
    inviter: {
      async sendInvitation(payload) {
        notifyAttempts.push(payload);
        if (typeof inviterBehavior === "function") {
          await inviterBehavior(payload);
        }
      },
    },
    logger: {
      warn(entry) {
        warnLogs.push(entry);
      },
      info() {},
    },
  });

  const invitationCreationService = createInvitationCreationService({
    dataAccess,
    notificationService,
    failureLogger: {
      warn(entry) {
        warnLogs.push(entry);
      },
    },
  });

  const assignmentService = createAssignmentService({
    dataAccess,
    notificationService,
    invitationCreationService,
  });

  return {
    dataAccess,
    assignmentService,
    notifyAttempts,
    warnLogs,
  };
}

test("AT-UC11-01 - Pending Invitations Visible by Default", async () => {
  const dataAccess = buildDataAccessForList({ invitationCount: 2 });
  const { controller } = makeInvitationController({ dataAccess });

  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: {},
  });
  assert.equal(response.status, 200);

  const payload = parseBody(response);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items.every((item) => item.status === "pending"), true);
  assert.equal(payload.items.every((item) => typeof item.paperTitle === "string"), true);
  assert.equal(payload.items.every((item) => typeof item.responseDueAt === "string"), true);

  const script = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "views", "scripts", "review-invitations.js"),
    "utf8"
  );
  assert.equal(script.includes('data-action="accept"'), true);
  assert.equal(script.includes('data-action="reject"'), true);

  const unauthenticated = await controller.handleList({ headers: {}, query: {} });
  assert.equal(unauthenticated.status, 401);
});

test("AT-UC11-02 - Newest-First Ordering", async () => {
  const dataAccess = buildDataAccessForList({ invitationCount: 3 });
  const { controller } = makeInvitationController({ dataAccess });

  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "pending", page: "1", page_size: "20" },
  });
  assert.equal(response.status, 200);

  const payload = parseBody(response);
  assert.deepEqual(
    payload.items.map((item) => item.id),
    ["I3", "I2", "I1"]
  );

  const acceptedOnly = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "accepted" },
  });
  assert.equal(parseBody(acceptedOnly).items.length, 1);
});

test("AT-UC11-03 - Pagination Beyond 20 Invitations", async () => {
  const dataAccess = buildDataAccessForList({ invitationCount: 25 });
  const { controller } = makeInvitationController({ dataAccess });

  const page1 = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "pending", page: "1", page_size: "20" },
  });
  const payload1 = parseBody(page1);
  assert.equal(payload1.items.length, 20);
  assert.equal(payload1.page, 1);
  assert.equal(payload1.totalPages, 2);

  const page2 = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "pending", page: "2", page_size: "20" },
  });
  const payload2 = parseBody(page2);
  assert.equal(payload2.items.length, 5);
  assert.equal(payload2.page, 2);

  const pageHtml = await controller.handleGetPage({ headers: { cookie: "cms_session=sid_r1" } });
  assert.equal(pageHtml.status, 200);
  assert.equal(pageHtml.body.includes("data-page-prev"), true);
  assert.equal(pageHtml.body.includes("data-page-next"), true);
});

test("AT-UC11-04 - Accept and Reject Update Status", async () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [
        { id: "P3", title: "Paper 3", status: "submitted" },
        { id: "P4", title: "Paper 4", status: "submitted" },
      ],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }],
      reviewInvitations: [
        {
          id: "I3",
          reviewerId: "R1",
          paperId: "P3",
          status: "pending",
          createdAt: "2026-02-20T00:00:00.000Z",
          responseDueAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "I4",
          reviewerId: "R1",
          paperId: "P4",
          status: "pending",
          createdAt: "2026-02-21T00:00:00.000Z",
          responseDueAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    },
  });
  const { controller } = makeInvitationController({ dataAccess });

  const accept = await controller.handleAction({
    headers: { cookie: "cms_session=sid_r1" },
    params: { invitation_id: "I3", action: "accept" },
  });
  assert.equal(accept.status, 200);
  assert.equal(parseBody(accept).status, "accepted");

  const reject = await controller.handleAction({
    headers: { cookie: "cms_session=sid_r1" },
    params: { invitation_id: "I4", action: "reject" },
  });
  assert.equal(reject.status, 200);
  assert.equal(parseBody(reject).status, "rejected");

  const acceptedFilter = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "accepted" },
  });
  assert.equal(parseBody(acceptedFilter).items.length, 1);

  const secondAccept = await controller.handleAction({
    headers: { cookie: "cms_session=sid_r1" },
    params: { invitation_id: "I3", action: "accept" },
  });
  assert.equal(secondAccept.status, 409);

  const script = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "views", "scripts", "review-invitations.js"),
    "utf8"
  );
  assert.equal(script.includes('item.status !== "pending" ? "disabled" : ""'), true);
});

test("AT-UC11-05 - Notification Delivery With Required Content", async () => {
  const harness = buildAssignmentHarness();

  const response = await harness.assignmentService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(response.type, "success");

  const notifications = harness.dataAccess.listNotificationRecords();
  assert.equal(notifications.length, 3);
  assert.equal(
    notifications.every((item) => item.deliveryStatus === "sent" || item.deliveryStatus === "failed"),
    true
  );

  assert.equal(harness.notifyAttempts.length >= 3, true);
  const payloadWithTemplateBody = harness.notifyAttempts.find(
    (attempt) => typeof attempt.body === "string" && attempt.body.length > 0
  );
  const body = String((payloadWithTemplateBody && payloadWithTemplateBody.body) || "");
  assert.equal(body.includes("Deterministic Paper"), true);
  assert.equal(body.toLowerCase().includes("respond"), true);
});

test("AT-UC11-06 - Notification Failure Does Not Block Invitation Visibility", async () => {
  const harness = buildAssignmentHarness({
    inviterBehavior: async () => {
      throw new Error("MAIL_DOWN");
    },
  });

  const response = await harness.assignmentService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(response.type, "success");

  const invitations = harness.dataAccess.listReviewInvitationsByReviewer("R1");
  assert.equal(invitations.length, 1);

  const notifications = harness.dataAccess.listNotificationRecords();
  assert.equal(notifications.length, 3);
  assert.equal(notifications.every((item) => item.deliveryStatus === "failed"), true);
  assert.equal(harness.warnLogs.length > 0, true);
});

test("AT-UC11-07 - Authorization Restriction", async () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted" }],
      reviewers: [
        { id: "R1", name: "Reviewer 1", eligibilityStatus: true },
        { id: "R2", name: "Reviewer 2", eligibilityStatus: true },
      ],
      reviewInvitations: [
        {
          id: "I1",
          reviewerId: "R1",
          paperId: "P1",
          status: "pending",
          createdAt: "2026-02-20T00:00:00.000Z",
          responseDueAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    },
  });

  const { controller, logs } = makeInvitationController({ dataAccess });

  const detailForbidden = await controller.handleGetDetail({
    headers: { cookie: "cms_session=sid_r2" },
    params: { invitation_id: "I1" },
  });
  assert.equal(detailForbidden.status, 403);

  const actionForbidden = await controller.handleAction({
    headers: { cookie: "cms_session=sid_r2" },
    params: { invitation_id: "I1", action: "reject" },
  });
  assert.equal(actionForbidden.status, 403);
  assert.equal(logs.length >= 2, true);
});

test("AT-UC11-08 - Generic Retry Error Messaging", async () => {
  const dataAccess = buildDataAccessForList({ invitationCount: 1 });
  const { controller } = makeInvitationController({
    dataAccess,
    reviewInvitationServiceOverride: {
      listForReviewer() {
        throw new Error("DB_STACKTRACE_SHOULD_NOT_LEAK");
      },
      getById() {
        return null;
      },
    },
  });

  const page = await controller.handleGetPage({ headers: { cookie: "cms_session=sid_r1" } });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("data-error-retry"), true);

  const failedList = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "pending" },
  });
  assert.equal(failedList.status, 500);

  const payload = parseBody(failedList);
  assert.equal(payload.message, "Invitations are unavailable right now. Please retry.");
  assert.equal(payload.message.toLowerCase().includes("stack"), false);
  assert.equal(failedList.body.includes("DB_STACKTRACE_SHOULD_NOT_LEAK"), false);
});

test("AT-UC11-09 - Expired Pending Invitations Auto-Decline", async () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }],
      reviewInvitations: [
        {
          id: "I1",
          reviewerId: "R1",
          paperId: "P1",
          status: "pending",
          createdAt: "2026-02-10T00:00:00.000Z",
          responseDueAt: "2026-02-20T00:00:00.000Z",
        },
      ],
    },
  });

  const { controller } = makeInvitationController({
    dataAccess,
    now: "2026-02-25T00:00:00.000Z",
  });

  const response = await controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "declined" },
  });
  assert.equal(response.status, 200);
  const payload = parseBody(response);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].status, "declined");

  const freshDataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper 1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }],
      reviewInvitations: [
        {
          id: "I2",
          reviewerId: "R1",
          paperId: "P1",
          status: "pending",
          createdAt: "2026-02-24T00:00:00.000Z",
          responseDueAt: "2026-03-20T00:00:00.000Z",
        },
      ],
    },
  });
  const { controller: freshController } = makeInvitationController({
    dataAccess: freshDataAccess,
    now: "2026-02-25T00:00:00.000Z",
  });

  const pending = await freshController.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "pending" },
  });
  assert.equal(parseBody(pending).items.length, 1);
});

test("AT-UC11-10 - Invitation Visibility Within One Minute of Assignment", async () => {
  const harness = buildAssignmentHarness();
  const assignmentStartedAtMs = Date.now();

  const response = await harness.assignmentService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(response.type, "success");

  const invitationsR1 = harness.dataAccess.listReviewInvitationsByReviewer("R1");
  assert.equal(invitationsR1.length, 1);

  const createdAtMs = new Date(invitationsR1[0].createdAt).getTime();
  assert.equal(createdAtMs >= assignmentStartedAtMs - 1000, true);
  assert.equal(createdAtMs <= assignmentStartedAtMs + 60 * 1000, true);

  const controllerHarness = makeInvitationController({
    dataAccess: harness.dataAccess,
    sessionMap: { sid_r1: { user_id: "R1", role: "reviewer" } },
  });
  const list = await controllerHarness.controller.handleList({
    headers: { cookie: "cms_session=sid_r1" },
    query: { status: "pending" },
  });
  assert.equal(parseBody(list).items.length >= 1, true);
});
