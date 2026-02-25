const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionService } = require("../../src/services/session-service");
const { createReviewController } = require("../../src/controllers/review_controller");

const PAPER_ID = "P1";

function createStubDataAccess({ paper = { id: PAPER_ID, title: "Paper 1" }, invitations = [] } = {}) {
  return {
    getPaperById(id) {
      if (!paper || String(id) !== String(paper.id)) {
        return null;
      }
      return paper;
    },
    listReviewInvitationsByReviewer() {
      return invitations;
    },
  };
}

function createReviewControllerHarness({
  reviewModel,
  dataAccess,
  authorizationService,
  sessionService,
} = {}) {
  const sessions = sessionService || createSessionService();
  const reviewerSession = sessions.create("R1");

  const controller = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess,
    authorizationService,
  });

  return {
    controller,
    sessionId: reviewerSession.session_id,
  };
}

function jsonHeaders(sessionId) {
  return {
    accept: "application/json",
    cookie: `cms_session=${sessionId}`,
  };
}

function htmlHeaders(sessionId) {
  return {
    accept: "text/html",
    cookie: `cms_session=${sessionId}`,
  };
}

test("UC-13 review controller constructor requires reviewModel and dataAccess", () => {
  assert.throws(() => createReviewController({ dataAccess: {} }), /reviewModel is required/);
  assert.throws(() => createReviewController({ reviewModel: {} }), /dataAccess is required/);
});

test("UC-13 review controller handleGetForm unauthenticated branches", async () => {
  const dataAccess = createStubDataAccess({ invitations: [] });
  const reviewModel = { findByReviewerAndPaper() { return null; } };
  const controller = createReviewController({
    sessionService: createSessionService(),
    reviewModel,
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const jsonResponse = await controller.handleGetForm({ headers: { accept: "application/json" } });
  assert.equal(jsonResponse.status, 401);

  const htmlResponse = await controller.handleGetForm({ headers: { accept: "text/html" } });
  assert.equal(htmlResponse.status, 302);
  assert.equal(htmlResponse.headers.Location, "/login.html");
});

test("UC-13 review controller handleGetForm not found and forbidden branches", async () => {
  const dataAccess = createStubDataAccess({ paper: null });
  const reviewModel = { findByReviewerAndPaper() { return null; } };
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const controller = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });

  const notFound = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);

  const forbiddenController = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });
  const forbidden = await forbiddenController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(forbidden.status, 403);
  const forbiddenPayload = JSON.parse(forbidden.body);
  assert.equal(forbiddenPayload.errorCode, "access_denied");
});

test("UC-13 review controller handleGetForm invitation required and existing review branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const reviewModel = {
    findByReviewerAndPaper() {
      return {
        required_fields: { comment: "Existing review" },
        optional_fields: { notes: "Existing notes" },
        submitted_at: "2026-02-24T12:00:00.000Z",
      };
    },
  };

  const invitationRequired = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const requiredResponse = await invitationRequired.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(requiredResponse.status, 403);
  const requiredPayload = JSON.parse(requiredResponse.body);
  assert.equal(requiredPayload.errorCode, "invitation_required");

  const existingController = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const htmlResponse = await existingController.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(htmlResponse.status, 200);
  assert.equal(htmlResponse.body.includes("Review submitted on"), true);
  assert.equal(htmlResponse.body.includes('data-immutable="true"'), true);
});

test("UC-13 review controller handleGetForm HTML renders escaped values and empty defaults", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      paper: { id: PAPER_ID, title: "Paper <One>" },
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Paper &lt;One&gt;"), true);
  assert.equal(response.body.includes('data-immutable="false"'), true);
});

test("UC-13 review controller handleGetForm JSON existing review", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: {
      findByReviewerAndPaper() {
        return {
          required_fields: null,
          optional_fields: null,
          submitted_at: "2026-02-24T13:00:00.000Z",
        };
      },
    },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.alreadySubmitted, true);
});

test("UC-13 review controller handleGetForm JSON not found, access denied, invitation required", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const notFoundController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ paper: null }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const notFound = await notFoundController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);
  assert.equal(JSON.parse(notFound.body).errorCode, "not_found");

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });
  const denied = await deniedController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(denied.status, 403);
  assert.equal(JSON.parse(denied.body).errorCode, "access_denied");

  const invitationController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invitation = await invitationController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invitation.status, 403);
  assert.equal(JSON.parse(invitation.body).errorCode, "invitation_required");
});

test("UC-13 review controller handleGetForm JSON success and invitation matching", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).alreadySubmitted, false);
});

test("UC-13 review controller handleGetForm supports empty paper fields", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const dataAccess = {
    getPaperById() {
      return { id: "", title: "" };
    },
    listReviewInvitationsByReviewer() {
      return [{ reviewerId: "R1", paperId: "", status: "accepted" }];
    },
  };
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: "" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes('name="paper_id" value=""'), true);
});

test("UC-13 review controller handleGetForm invitation list fallback and denied JSON", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const dataAccess = {
    getPaperById(id) {
      return id === PAPER_ID ? { id: PAPER_ID, title: "Paper" } : null;
    },
    listReviewInvitationsByReviewer() {
      return undefined;
    },
  };

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });
  const denied = await deniedController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(denied.status, 403);
  assert.equal(JSON.parse(denied.body).errorCode, "access_denied");

  const invitationController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invitation = await invitationController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invitation.status, 403);
  assert.equal(JSON.parse(invitation.body).errorCode, "invitation_required");
});

test("UC-13 review controller handleGetForm invitation missing fields", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", status: "" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).errorCode, "invitation_required");
});

test("UC-13 review controller handleGetForm invitation mismatch evaluates invitations", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [
        { reviewerId: "R1", paperId: "P2", status: "accepted" },
        { reviewerId: "R1", paperId: PAPER_ID, status: "pending" },
      ],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).errorCode, "invitation_required");
});

test("UC-13 review controller handleGetForm invitation status accepted branch", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [
        { reviewerId: "R1", paperId: PAPER_ID, status: "declined" },
        { reviewerId: "R1", paperId: PAPER_ID, status: "accepted" },
      ],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).alreadySubmitted, false);
});

test("UC-13 review controller invitation status false branch", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).errorCode, "invitation_required");
});

test("UC-13 review controller uses default authorization fallback", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
});

test("UC-13 review controller handleGetForm unauthenticated JSON branch", async () => {
  const controller = createReviewController({
    sessionService: createSessionService(),
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: { accept: "application/json" },
  });
  assert.equal(response.status, 401);
  assert.equal(JSON.parse(response.body).errorCode, "not_authenticated");
});

test("UC-13 review controller handleGetForm JSON success with trimmed invitation status", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [
        { reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: " accepted " },
      ],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).alreadySubmitted, false);
});

test("UC-13 review controller handleGetForm JSON branches for not found, denied, invitation", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const notFoundController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ paper: null }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const notFound = await notFoundController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
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
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invite = await inviteController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invite.status, 403);
});

test("UC-13 review controller branch coverage targets", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const noSessionController = createReviewController({
    sessionService: undefined,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const unauthJson = await noSessionController.handleGetForm({
    headers: { accept: "application/json" },
  });
  assert.equal(unauthJson.status, 401);

  const notFoundController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const notFound = await notFoundController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });
  const denied = await deniedController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(denied.status, 403);

  const invitationController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invite = await invitationController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invite.status, 403);

  const successController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      findByReviewerAndPaper() {
        return null;
      },
      listByPaperId() {
        return [];
      },
    },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: " accepted " }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const success = await successController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(success.status, 200);

  const listNotFound = await successController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(listNotFound.status, 404);

  const listSuccess = await successController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listSuccess.status, 200);
});

test("UC-13 review controller JSON coverage for getForm and list branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const notFoundController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const notFound = await notFoundController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
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
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invite = await inviteController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invite.status, 403);

  const successController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: " accepted " }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const success = await successController.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(success.status, 200);

  const listNotFound = await successController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(listNotFound.status, 404);

  const listSuccess = await successController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listSuccess.status, 200);
});

test("UC-13 review controller explicit wantsJson branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const dataAccess = createStubDataAccess({
    invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
  });
  const reviewModel = {
    findByReviewerAndPaper() {
      return null;
    },
    listByPaperId() {
      return [];
    },
  };
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const htmlForm = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(htmlForm.status, 200);

  const jsonForm = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(jsonForm.status, 200);

  const jsonNotFound = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(jsonNotFound.status, 404);

  const htmlNotFound = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(htmlNotFound.status, 404);

  const listJson = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listJson.status, 200);

  const listHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listHtml.status, 200);

  const listNotFoundJson = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(listNotFoundJson.status, 404);

  const listNotFoundHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(listNotFoundHtml.status, 404);
});

test("UC-13 review controller handleGetForm invitation mismatch evaluates invitations", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [
        { reviewerId: "R1", paperId: "P2", status: "accepted" },
        { reviewerId: "R1", paperId: PAPER_ID, status: "pending" },
      ],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).errorCode, "invitation_required");
});

test("UC-13 review controller handleGetForm unauthenticated JSON branch", async () => {
  const controller = createReviewController({
    sessionService: createSessionService(),
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: { accept: "application/json" },
  });
  assert.equal(response.status, 401);
  assert.equal(JSON.parse(response.body).errorCode, "not_authenticated");
});
test("UC-13 review controller handleGetForm HTML existing review with missing fields", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: {
      findByReviewerAndPaper() {
        return { submitted_at: "2026-02-24T12:00:00.000Z" };
      },
    },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Review submitted on"), true);
});

test("UC-13 review controller handleGetForm missing params branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const jsonNotFound = await controller.handleGetForm({
    headers: jsonHeaders(session.session_id),
  });
  assert.equal(jsonNotFound.status, 404);

  const htmlNotFound = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
  });
  assert.equal(htmlNotFound.status, 404);
  assert.equal(htmlNotFound.body, "Not found");
});

test("UC-13 review controller handleGetForm invitation status not accepted", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [
        { reviewerId: "R1", paperId: PAPER_ID, status: "pending" },
        { reviewerId: "R1", paperId: "", status: "" },
      ],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.includes("Invitation Required"), true);
});
test("UC-13 review controller handleGetForm not found HTML branch", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 404);
  assert.equal(response.body, "Not found");
});

test("UC-13 review controller handleGetForm invitation required HTML branch", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.includes("Invitation Required"), true);
  assert.equal(response.body.includes("Accept the review invitation"), true);
});

test("UC-13 review controller handleGetForm unauthorized HTML renders error view", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });

  const response = await controller.handleGetForm({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.includes("Access denied."), true);
  assert.equal(response.body.includes("Open a paper from your assigned papers list."), true);
});

test("UC-13 review controller handlePost success, duplicate, validation, and failure branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const dataAccess = createStubDataAccess({
    invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
  });
  const authz = { canAccessAssignedPaper() { return true; } };

  const successController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "success", review: { review_id: "rev1", status: "Submitted" } };
      },
    },
    dataAccess,
    authorizationService: authz,
  });

  const success = await successController.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { requiredFields: { comment: "Valid comment" } },
  });
  assert.equal(success.status, 201);
  const successPayload = JSON.parse(success.body);
  assert.equal(successPayload.status, "Submitted");

  const duplicateController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "duplicate", message: "dup" };
      },
    },
    dataAccess,
    authorizationService: authz,
  });
  const duplicate = await duplicateController.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { requiredFields: { comment: "Valid comment" } },
  });
  assert.equal(duplicate.status, 409);

  const validationController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "validation_error", message: "invalid", fieldErrors: { comment: "bad" } };
      },
    },
    dataAccess,
    authorizationService: authz,
  });
  const validation = await validationController.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { requiredFields: { comment: "" } },
  });
  assert.equal(validation.status, 400);
  const validationPayload = JSON.parse(validation.body);
  assert.equal(validationPayload.fieldErrors.comment, "bad");

  const failureController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "failure" };
      },
    },
    dataAccess,
    authorizationService: authz,
  });
  const failure = await failureController.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { requiredFields: { comment: "Valid comment" } },
  });
  assert.equal(failure.status, 500);
});

test("UC-13 review controller handlePost invitation required HTML branch", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const invitationController = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await invitationController.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "Attempt without invitation" },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.includes("Invitation Required"), true);
  assert.equal(response.body.includes("accept the review invitation"), true);
});

test("UC-13 review controller handlePost unauthenticated and not found HTML branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const unauth = await controller.handlePost({
    headers: { accept: "text/html" },
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(unauth.status, 302);
  assert.equal(unauth.headers.Location, "/login.html");

  const notFound = await controller.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body, "Not found");
});

test("UC-13 review controller handlePost unauthenticated and not found JSON branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const unauth = await controller.handlePost({
    headers: { accept: "application/json" },
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(unauth.status, 401);
  assert.equal(JSON.parse(unauth.body).errorCode, "not_authenticated");

  const notFound = await controller.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(notFound.status, 404);
  assert.equal(JSON.parse(notFound.body).errorCode, "not_found");
});

test("UC-13 review controller handlePost not found JSON with missing params", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handlePost({
    headers: jsonHeaders(session.session_id),
  });
  assert.equal(response.status, 404);
  assert.equal(JSON.parse(response.body).errorCode, "not_found");
});

test("UC-13 review controller handlePost unauthenticated with no headers", async () => {
  const controller = createReviewController({
    sessionService: createSessionService(),
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({ paper: null, invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handlePost();
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/login.html");
});

test("UC-13 review controller handlePost uses body fallback when undefined", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  let captured = null;
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create(payload) {
        captured = payload;
        return { type: "validation_error", message: "invalid", fieldErrors: { comment: "bad" } };
      },
    },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 400);
  assert.equal(captured.requiredFields.comment, undefined);
  assert.equal(captured.optionalFields.notes, undefined);
});

test("UC-13 review controller handlePost unauthorized HTML branch", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });

  const response = await controller.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: undefined,
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.includes("Access Denied"), true);
  assert.equal(response.body.includes("You are not authorized"), true);
});

test("UC-13 review controller handlePost invitation required HTML without body", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess: createStubDataAccess({ invitations: [] }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.includes("Invitation Required"), true);
});

test("UC-13 review controller handlePost authorization and invitation branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const dataAccess = createStubDataAccess({ invitations: [] });

  const unauthorizedController = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });

  const unauthorized = await unauthorizedController.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { requiredFields: { comment: "Valid comment" } },
  });
  assert.equal(unauthorized.status, 403);
  const unauthorizedPayload = JSON.parse(unauthorized.body);
  assert.equal(
    unauthorizedPayload.message,
    "You are not authorized to submit a review for this paper."
  );

  const invitationController = createReviewController({
    sessionService: sessions,
    reviewModel: { create() { return { type: "success" }; } },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const invitation = await invitationController.handlePost({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { requiredFields: { comment: "Valid comment" } },
  });
  assert.equal(invitation.status, 403);
  const invitationPayload = JSON.parse(invitation.body);
  assert.equal(invitationPayload.errorCode, "invitation_required");
});

test("UC-13 review controller handlePost html branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const dataAccess = createStubDataAccess({
    invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
  });

  const successController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "success", review: { required_fields: { comment: "ok" } } };
      },
    },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const success = await successController.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(success.status, 200);
  assert.equal(success.body.includes("Review submitted successfully"), true);

  const duplicateController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "duplicate", message: "dup", review: { required_fields: { comment: "ok" } } };
      },
    },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const duplicate = await duplicateController.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.includes("cannot be edited"), true);

  const validationController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "validation_error", fieldErrors: { comment: "bad" } };
      },
    },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const validation = await validationController.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "" },
  });
  assert.equal(validation.status, 400);
  assert.equal(validation.body.includes("bad"), true);

  const failureController = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "failure" };
      },
    },
    dataAccess,
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const failure = await failureController.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "ok" },
  });
  assert.equal(failure.status, 500);
  assert.equal(failure.body.includes("could not submit your review"), true);
});

test("UC-13 review controller handlePost duplicate HTML falls back to requiredFields", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const controller = createReviewController({
    sessionService: sessions,
    reviewModel: {
      create() {
        return { type: "duplicate", message: "dup" };
      },
    },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const response = await controller.handlePost({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
    body: { comment: "fallback comment" },
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.includes("fallback comment"), true);
});

test("UC-13 review controller handlePost html branches cover success/duplicate/validation/failure", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  const dataAccess = createStubDataAccess({
    invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
  });

  const controllers = [
    {
      type: "success",
      controller: createReviewController({
        sessionService: sessions,
        reviewModel: { create() { return { type: "success", review: { required_fields: { comment: "ok" } } }; } },
        dataAccess,
        authorizationService: { canAccessAssignedPaper() { return true; } },
      }),
      expectedStatus: 200,
    },
    {
      type: "duplicate",
      controller: createReviewController({
        sessionService: sessions,
        reviewModel: { create() { return { type: "duplicate", message: "dup", review: { required_fields: { comment: "ok" } } }; } },
        dataAccess,
        authorizationService: { canAccessAssignedPaper() { return true; } },
      }),
      expectedStatus: 409,
    },
    {
      type: "validation_error",
      controller: createReviewController({
        sessionService: sessions,
        reviewModel: { create() { return { type: "validation_error", message: "bad", fieldErrors: { comment: "bad" } }; } },
        dataAccess,
        authorizationService: { canAccessAssignedPaper() { return true; } },
      }),
      expectedStatus: 400,
    },
    {
      type: "failure",
      controller: createReviewController({
        sessionService: sessions,
        reviewModel: { create() { return { type: "failure" }; } },
        dataAccess,
        authorizationService: { canAccessAssignedPaper() { return true; } },
      }),
      expectedStatus: 500,
    },
  ];

  for (const entry of controllers) {
    const response = await entry.controller.handlePost({
      headers: htmlHeaders(session.session_id),
      params: { paper_id: PAPER_ID },
      body: { comment: "ok" },
    });
    assert.equal(response.status, entry.expectedStatus);
  }
});

test("UC-13 review controller handleList branches", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");
  let listResult = [{ review_id: "rev1" }];
  const reviewModel = {
    listByPaperId() {
      return listResult;
    },
  };

  const controller = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });

  const unauthJson = await controller.handleList({ headers: { accept: "application/json" } });
  assert.equal(unauthJson.status, 401);

  const unauthHtml = await controller.handleList({ headers: { accept: "text/html" } });
  assert.equal(unauthHtml.status, 302);
  assert.equal(unauthHtml.headers.Location, "/login.html");

  const notFound = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(notFound.status, 404);

  const notFoundHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(notFoundHtml.status, 404);
  assert.equal(notFoundHtml.body, "Not found");

  const success = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(success.status, 200);
  const payload = JSON.parse(success.body);
  assert.equal(payload.items.length, 1);

  listResult = [];
  const emptyHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(emptyHtml.status, 200);
  assert.equal(emptyHtml.body.includes("No reviews submitted yet."), true);

  listResult = [
    {
      review_id: "rev2",
      reviewer_id: "R2",
      submitted_at: "2026-02-24T12:00:00.000Z",
      required_fields: { comment: "Comment with notes." },
      optional_fields: { notes: "Extra notes" },
    },
  ];
  const notesHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notesHtml.status, 200);
  assert.equal(notesHtml.body.includes("Notes:"), true);

  listResult = [
    {
      review_id: "rev3",
      reviewer_id: "R3",
      submitted_at: "2026-02-24T12:05:00.000Z",
    },
  ];
  const noNotesHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(noNotesHtml.status, 200);
  assert.equal(noNotesHtml.body.includes("Notes:"), false);

  const successHtml = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(successHtml.status, 200);
  assert.equal(successHtml.body.includes("Submitted Reviews"), true);

  const emptyPaperController = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess: {
      getPaperById() {
        return { id: "", title: "" };
      },
      listReviewInvitationsByReviewer() {
        return [];
      },
    },
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const emptyPaperHtml = await emptyPaperController.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(emptyPaperHtml.status, 200);
  assert.equal(emptyPaperHtml.body.includes('data-paper-id=""'), true);

  listResult = undefined;
  const undefinedList = await controller.handleList({
    headers: htmlHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(undefinedList.status, 200);
  assert.equal(undefinedList.body.includes("No reviews submitted yet."), true);

  const notFoundJson = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(notFoundJson.status, 404);
  assert.equal(JSON.parse(notFoundJson.body).errorCode, "not_found");

  listResult = [];
  const successJson = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(successJson.status, 200);
  assert.equal(JSON.parse(successJson.body).items.length, 0);

  const notFoundJson2 = await controller.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: "missing" },
  });
  assert.equal(notFoundJson2.status, 404);

  const fallbackAuthzController = createReviewController({
    sessionService: sessions,
    reviewModel,
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
  });
  const fallbackList = await fallbackAuthzController.handleList({
    headers: jsonHeaders(session.session_id),
    params: { paper_id: PAPER_ID },
  });
  assert.equal(fallbackList.status, 200);

  const missingParam = await controller.handleList({
    headers: jsonHeaders(session.session_id),
  });
  assert.equal(missingParam.status, 404);
  assert.equal(JSON.parse(missingParam.body).errorCode, "not_found");

  const noHeaders = await controller.handleList();
  assert.equal(noHeaders.status, 302);
  assert.equal(noHeaders.headers.Location, "/login.html");
});

test("UC-13 review controller JSON branch targets for coverage", async () => {
  const sessions = createSessionService();
  const session = sessions.create("R1");

  const jsonHeaders = { accept: "application/json", cookie: `cms_session=${session.session_id}` };

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
    headers: jsonHeaders,
    params: { paper_id: PAPER_ID },
  });
  assert.equal(notFound.status, 404);

  const deniedController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: PAPER_ID, status: "accepted" }],
    }),
    authorizationService: { canAccessAssignedPaper() { return false; } },
  });
  const denied = await deniedController.handleGetForm({
    headers: jsonHeaders,
    params: { paper_id: PAPER_ID },
  });
  assert.equal(denied.status, 403);

  const invitationController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: " pending " }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const invitation = await invitationController.handleGetForm({
    headers: jsonHeaders,
    params: { paper_id: PAPER_ID },
  });
  assert.equal(invitation.status, 403);

  const successController = createReviewController({
    sessionService: sessions,
    reviewModel: { findByReviewerAndPaper() { return null; }, listByPaperId() { return []; } },
    dataAccess: createStubDataAccess({
      invitations: [{ reviewerId: "R1", paperId: ` ${PAPER_ID} `, status: " accepted " }],
    }),
    authorizationService: { canAccessAssignedPaper() { return true; } },
  });
  const success = await successController.handleGetForm({
    headers: jsonHeaders,
    params: { paper_id: PAPER_ID },
  });
  assert.equal(success.status, 200);

  const listNotFound = await notFoundController.handleList({
    headers: jsonHeaders,
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listNotFound.status, 404);

  const listSuccess = await successController.handleList({
    headers: jsonHeaders,
    params: { paper_id: PAPER_ID },
  });
  assert.equal(listSuccess.status, 200);
});
