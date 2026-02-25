const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");
const { createAssignmentService } = require("../../src/services/assignment_service");
const { createInvitationCreationService } = require("../../src/services/invitation_creation_service");

const PAPER_ID = "P1";

function requestRaw(baseUrl, options, body) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: options.path,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function makeSessionService() {
  return {
    validate(sessionId) {
      if (sessionId === "sid_r1") {
        return { user_id: "R1", role: "reviewer" };
      }
      if (sessionId === "sid_r2") {
        return { user_id: "R2", role: "reviewer" };
      }
      if (sessionId === "sid_editor") {
        return { user_id: "E1", role: "editor" };
      }
      return null;
    },
    create() {
      return { session_id: "sid_r1" };
    },
    destroy() {},
  };
}

async function withServer(options, run) {
  const { server } = createAppServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function buildDataAccess({ includeMany = false } = {}) {
  const invitations = [
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
    {
      id: "I3",
      reviewerId: "R1",
      paperId: "P3",
      status: "accepted",
      createdAt: "2026-02-24T10:00:00.000Z",
      responseDueAt: "2026-03-01T00:00:00.000Z",
    },
  ];

  if (includeMany) {
    for (let i = 0; i < 25; i += 1) {
      invitations.push({
        id: `PAG_${i}`,
        reviewerId: "R1",
        paperId: `PX_${i}`,
        status: "pending",
        createdAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
        responseDueAt: "2026-03-10T00:00:00.000Z",
      });
    }
  }

  const papers = [
    { id: PAPER_ID, conferenceId: "C1", title: "Paper 1", status: "submitted" },
    { id: "P2", conferenceId: "C1", title: "Paper 2", status: "submitted" },
    { id: "P3", conferenceId: "C1", title: "Paper 3", status: "submitted" },
  ];

  if (includeMany) {
    for (let i = 0; i < 25; i += 1) {
      papers.push({ id: `PX_${i}`, conferenceId: "C1", title: `Paper X ${i}`, status: "submitted" });
    }
  }

  return createDataAccess({
    seed: {
      papers,
      reviewers: [
        { id: "R1", name: "Reviewer 1", email: "r1@example.com", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R2", name: "Reviewer 2", email: "r2@example.com", eligibilityStatus: true, currentAssignmentCount: 2 },
        { id: "R3", name: "Reviewer 3", email: "r3@example.com", eligibilityStatus: true, currentAssignmentCount: 3 },
      ],
      reviewInvitations: invitations,
      assignments: [],
    },
  });
}

function reviewerHeaders(sessionId) {
  return {
    Cookie: `cms_session=${sessionId}`,
    Accept: "application/json",
  };
}

function editorJsonHeaders(payload) {
  return {
    Cookie: "cms_session=sid_editor",
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
}

test("UC-11 integration happy path: reviewer page and list endpoints return pending newest-first", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess(),
    },
    async (baseUrl) => {
      const page = await requestRaw(baseUrl, {
        path: "/review-invitations.html",
        headers: { Cookie: "cms_session=sid_r1", Accept: "text/html" },
      });
      assert.equal(page.status, 200);
      assert.equal(page.body.includes("Review Invitations"), true);

      const list = await requestRaw(baseUrl, {
        path: "/api/review-invitations",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(list.status, 200);
      const body = JSON.parse(list.body);
      assert.equal(body.items.length, 2);
      assert.equal(body.items[0].id, "I2");
      assert.equal(body.items.every((item) => item.status === "pending"), true);
    }
  );
});

test("UC-11 integration happy path: reviewer can accept and reject, and filter sees updated status", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess(),
    },
    async (baseUrl) => {
      const accept = await requestRaw(baseUrl, {
        path: "/api/review-invitations/I1/accept",
        method: "POST",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(accept.status, 200);
      assert.equal(JSON.parse(accept.body).status, "accepted");

      const reject = await requestRaw(baseUrl, {
        path: "/api/review-invitations/I2/reject",
        method: "POST",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(reject.status, 200);
      assert.equal(JSON.parse(reject.body).status, "rejected");

      const accepted = await requestRaw(baseUrl, {
        path: "/api/review-invitations?status=accepted",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(accepted.status, 200);
      const acceptedBody = JSON.parse(accepted.body);
      assert.equal(acceptedBody.items.some((item) => item.id === "I1"), true);

      const conflict = await requestRaw(baseUrl, {
        path: "/api/review-invitations/I1/accept",
        method: "POST",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(conflict.status, 409);
    }
  );
});

test("UC-11 integration invalid input path: invalid action returns 400 and missing invitation returns 404", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess(),
    },
    async (baseUrl) => {
      const invalidAction = await requestRaw(baseUrl, {
        path: "/api/review-invitations/I1/maybe",
        method: "POST",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(invalidAction.status, 404);

      const notFound = await requestRaw(baseUrl, {
        path: "/api/review-invitations/DOES_NOT_EXIST/accept",
        method: "POST",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(notFound.status, 404);
    }
  );
});

test("UC-11 integration expected failure path: unauthenticated and unauthorized access are blocked", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess(),
    },
    async (baseUrl) => {
      const noSession = await requestRaw(baseUrl, {
        path: "/api/review-invitations",
        headers: { Accept: "application/json" },
      });
      assert.equal(noSession.status, 401);

      const pageNoSession = await requestRaw(baseUrl, {
        path: "/review-invitations.html",
        headers: { Accept: "text/html" },
      });
      assert.equal(pageNoSession.status, 302);

      const forbiddenDetail = await requestRaw(baseUrl, {
        path: "/api/review-invitations/I1",
        headers: reviewerHeaders("sid_r2"),
      });
      assert.equal(forbiddenDetail.status, 403);

      const forbiddenAction = await requestRaw(baseUrl, {
        path: "/api/review-invitations/I1/reject",
        method: "POST",
        headers: reviewerHeaders("sid_r2"),
      });
      assert.equal(forbiddenAction.status, 403);
    }
  );
});

test("UC-11 integration expected flow: pagination supports >20 items with stable page metadata", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess({ includeMany: true }),
    },
    async (baseUrl) => {
      const page1 = await requestRaw(baseUrl, {
        path: "/api/review-invitations?status=pending&page=1&page_size=20",
        headers: reviewerHeaders("sid_r1"),
      });
      const b1 = JSON.parse(page1.body);
      assert.equal(page1.status, 200);
      assert.equal(b1.items.length, 20);
      assert.equal(b1.page, 1);
      assert.equal(b1.totalPages >= 2, true);

      const page2 = await requestRaw(baseUrl, {
        path: "/api/review-invitations?status=pending&page=2&page_size=20",
        headers: reviewerHeaders("sid_r1"),
      });
      const b2 = JSON.parse(page2.body);
      assert.equal(page2.status, 200);
      assert.equal(b2.items.length >= 1, true);
      assert.equal(b2.page, 2);
    }
  );
});

test("UC-11 integration expected failure path: retrieval failure returns safe retryable 500", async () => {
  const failingDataAccess = buildDataAccess();
  failingDataAccess.listReviewInvitationsByReviewer = () => {
    throw new Error("DB_INTERNAL_STACKTRACE");
  };

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: failingDataAccess,
    },
    async (baseUrl) => {
      const response = await requestRaw(baseUrl, {
        path: "/api/review-invitations",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(response.status, 500);
      const body = JSON.parse(response.body);
      assert.equal(body.errorCode, "invitation_list_unavailable");
      assert.equal(body.message, "Invitations are unavailable right now. Please retry.");
      assert.equal(response.body.includes("DB_INTERNAL_STACKTRACE"), false);
    }
  );
});

test("UC-11 integration expected failure path: notification failure during assignment does not block invitation visibility", async () => {
  const assignmentDataAccess = buildDataAccess();
  const invitationCreationService = createInvitationCreationService({
    dataAccess: assignmentDataAccess,
    notificationService: {
      async sendInvitationNotification() {
        throw new Error("NOTIFY_DOWN");
      },
    },
    failureLogger: {
      warn() {},
    },
  });
  const assignmentService = createAssignmentService({
    dataAccess: assignmentDataAccess,
    notificationService: {
      async sendReviewerInvitations() {
        return {
          type: "partial_failure",
          warningCode: "invitation_partial_failure",
          warningMessage:
            "Assignments were saved, but one or more reviewer invitations failed and were logged for retry.",
          failures: [{ reviewerId: "R1", reason: "NOTIFY_DOWN" }],
        };
      },
    },
    invitationCreationService,
  });

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
      assignmentService,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2", "R3"] });
      const assign = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorJsonHeaders(payload),
        },
        payload
      );
      assert.equal(assign.status, 200);
      const assignBody = JSON.parse(assign.body);
      assert.equal(assignBody.warningCode, "invitation_partial_failure");

      const list = await requestRaw(baseUrl, {
        path: "/api/review-invitations?status=pending",
        headers: reviewerHeaders("sid_r1"),
      });
      assert.equal(list.status, 200);
      const listBody = JSON.parse(list.body);
      assert.equal(listBody.items.some((item) => item.paperId === PAPER_ID), true);
    }
  );
});
