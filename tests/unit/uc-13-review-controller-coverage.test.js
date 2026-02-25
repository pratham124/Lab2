const test = require("node:test");
const assert = require("node:assert/strict");

const { createReviewController } = require("../../src/controllers/review_controller");
const { createSessionService } = require("../../src/services/session-service");

const PAPER_ID = "P1";

function jsonHeaders(sessionId) {
  return {
    accept: "application/json",
    cookie: `cms_session=${sessionId}`,
  };
}

function buildDataAccess({ invitations, paper }) {
  return {
    getPaperById() {
      return paper || { id: PAPER_ID, title: "Paper" };
    },
    listReviewInvitationsByReviewer() {
      return invitations;
    },
  };
}

test("UC-13 review controller branch coverage for JSON paths", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const noArgsController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: buildDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const noArgs = await noArgsController.handleGetForm();
  assert.equal(noArgs.status, 302);

  const unauthController = createReviewController({
    sessionService: undefined,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: buildDataAccess({ invitations: [] }),
  });
  const unauth = await unauthController.handleGetForm({ headers: { accept: "application/json" } });
  assert.equal(unauth.status, 401);

  const notFoundController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: {
      getPaperById() {
        return null;
      },
      listReviewInvitationsByReviewer() {
        return [];
      },
    },
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const notFound = await notFoundController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: buildDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });
  const denied = await deniedController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(denied.status, 403);

  const inviteController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: buildDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invite = await inviteController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invite.status, 403);

  const matchController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: buildDataAccess({
      invitations: [
        { reviewerId: "R1", paperId: undefined, status: undefined },
        { reviewerId: "R1", paperId: "P2", status: "accepted" },
        { reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: " accepted " },
      ],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const success = await matchController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(success.status, 200);

  const listNotFound = await matchController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(listNotFound.status, 200);

  const notFoundListController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: {
      getPaperById() {
        return null;
      },
      listReviewInvitationsByReviewer() {
        return [];
      },
    },
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const listNotFoundJson = await notFoundListController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listNotFoundJson.status, 404);

  const listSuccess = await matchController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listSuccess.status, 200);

  const listSuccessHeaders = await matchController.handleList({
    headers: { accept: "application/json", cookie: `cms_session=${session.session_id}` },
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listSuccessHeaders.status, 200);
});
