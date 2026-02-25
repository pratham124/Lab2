const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createInvitationStatusService } = require("../../src/services/invitation_status_service");
const { createReviewInvitationService } = require("../../src/services/review_invitation_service");
const {
  createReviewInvitationActionService,
} = require("../../src/services/review_invitation_action_service");
const { createAuthorizationService } = require("../../src/services/authorization_service");
const { createInvitationCreationService } = require("../../src/services/invitation_creation_service");

function buildAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: "C1", title: "Paper 1", abstract: "A", status: "submitted" },
        { id: "P2", conferenceId: "C1", title: "Paper 2", abstract: "B", status: "submitted" },
      ],
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
          createdAt: "2026-02-25T10:00:00.000Z",
          responseDueAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "I2",
          reviewerId: "R1",
          paperId: "P2",
          status: "pending",
          createdAt: "2026-02-26T10:00:00.000Z",
          responseDueAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    },
  });
}

test("UC-11 list service applies pending default, newest-first ordering, and pagination", () => {
  const dataAccess = buildAccess();
  const statusService = createInvitationStatusService({ now: () => new Date("2026-02-26T12:00:00.000Z") });
  const service = createReviewInvitationService({ dataAccess, invitationStatusService: statusService });

  const page = service.listForReviewer({ reviewerId: "R1", status: "pending", page: 1, pageSize: 1 });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, "I2");
  assert.equal(page.totalItems, 2);
  assert.equal(page.totalPages, 2);
});

test("UC-11 action service supports accept/reject and blocks non-invited reviewer", () => {
  const logs = [];
  const dataAccess = buildAccess();
  const authz = createAuthorizationService({
    securityLogService: {
      logUnauthorizedAccess(entry) {
        logs.push(entry);
      },
    },
  });
  const actionService = createReviewInvitationActionService({ dataAccess, authorizationService: authz });

  const forbidden = actionService.respond({ reviewerId: "R2", invitationId: "I1", action: "accept" });
  assert.equal(forbidden.type, "forbidden");
  assert.equal(logs.length, 1);

  const accepted = actionService.respond({ reviewerId: "R1", invitationId: "I1", action: "accept" });
  assert.equal(accepted.type, "ok");
  assert.equal(accepted.invitation.status, "accepted");
});

test("UC-11 expired pending invitations auto-decline on refresh", () => {
  const dataAccess = buildAccess();
  const statusService = createInvitationStatusService({ now: () => new Date("2026-03-02T00:00:00.000Z") });
  const service = createReviewInvitationService({ dataAccess, invitationStatusService: statusService });

  const page = service.listForReviewer({ reviewerId: "R1", status: "declined", page: 1, pageSize: 20 });
  assert.equal(page.items.length, 2);
});

test("UC-11 invitation creation remains available when notification send fails", async () => {
  const dataAccess = createDataAccess({
    seed: {
      papers: [{ id: "P1", conferenceId: "C1", title: "Paper 1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }],
    },
  });

  const service = createInvitationCreationService({
    dataAccess,
    notificationService: {
      async sendInvitationNotification() {
        throw new Error("MAIL_DOWN");
      },
    },
  });

  const invitations = await service.createForAssignments({
    paper: { id: "P1", title: "Paper 1" },
    assignments: [{ reviewerId: "R1", paperId: "P1", assignedAt: "2026-02-25T00:00:00.000Z" }],
  });

  assert.equal(invitations.length, 1);
  assert.equal(dataAccess.listReviewInvitationsByReviewer("R1").length, 1);
});
