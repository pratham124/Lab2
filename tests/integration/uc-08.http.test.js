const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");
const { createAssignmentService } = require("../../src/services/assignment_service");

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

function makeDataAccess({ reviewerOverrides } = {}) {
  return createDataAccess({
    seed: {
      papers: [{ id: PAPER_ID, title: "UC-08 Integration Paper", status: "submitted" }],
      reviewers:
        reviewerOverrides ||
        [
          { id: "R1", name: "Reviewer 1", currentAssignmentCount: 1, eligibilityStatus: true },
          { id: "R2", name: "Reviewer 2", currentAssignmentCount: 2, eligibilityStatus: true },
          { id: "R3", name: "Reviewer 3", currentAssignmentCount: 3, eligibilityStatus: true },
          { id: "R4", name: "Reviewer 4", currentAssignmentCount: 4, eligibilityStatus: true },
          { id: "R5", name: "Reviewer 5", currentAssignmentCount: 5, eligibilityStatus: true },
        ],
      assignments: [],
    },
  });
}

function makeSessionService() {
  return {
    create(userId) {
      return { session_id: `sid_${userId}`, user_id: userId };
    },
    validate(sessionId) {
      if (sessionId === "sid_editor") {
        return { user_id: "editor_1", role: "editor" };
      }
      if (sessionId === "sid_author") {
        return { user_id: "author_1", role: "author" };
      }
      return null;
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

function editorHeadersJson(payload) {
  return {
    Cookie: "cms_session=sid_editor",
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
}

test("UC-08 integration happy path: editor loads assignment endpoints and saves exactly 3 reviewers", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const form = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assign-reviewers`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "text/html",
        },
      });
      assert.equal(form.status, 200);
      assert.equal(form.body.includes("Assign Reviewers"), true);

      const eligible = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/eligible-reviewers`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(eligible.status, 200);
      const eligibleBody = JSON.parse(eligible.body);
      assert.equal(eligibleBody.eligible_reviewers.length >= 3, true);

      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2", "R3"] });
      const assigned = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorHeadersJson(payload),
        },
        payload
      );
      assert.equal(assigned.status, 200);
      const assignedBody = JSON.parse(assigned.body);
      assert.equal(assignedBody.assignment_count, 3);

      const assignments = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(assignments.status, 200);
      const assignmentBody = JSON.parse(assignments.body);
      assert.equal(assignmentBody.assignments.length, 3);
    }
  );
});

test("UC-08 integration invalid input path: wrong reviewer count is rejected with no persistence", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorHeadersJson(payload),
        },
        payload
      );

      assert.equal(response.status, 400);
      const body = JSON.parse(response.body);
      assert.equal(body.errorCode, "invalid_reviewer_count");
      assert.equal(body.message, "Exactly 3 reviewers are required.");

      const assignments = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(assignments.status, 200);
      assert.equal(JSON.parse(assignments.body).assignments.length, 0);
    }
  );
});

test("UC-08 integration expected failure path: workload violation blocks assignment", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2", "R5"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorHeadersJson(payload),
        },
        payload
      );

      assert.equal(response.status, 400);
      const body = JSON.parse(response.body);
      assert.equal(body.errorCode, "reviewer_workload_exceeded");

      const assignments = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(assignments.status, 200);
      assert.equal(JSON.parse(assignments.body).assignments.length, 0);
    }
  );
});

test("UC-08 integration expected failure path: simulated save failure returns safe 500 and no assignments", async () => {
  const assignmentDataAccess = makeDataAccess();
  assignmentDataAccess.createAssignments = () => {
    throw new Error("DB_WRITE_FAILURE");
  };

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2", "R3"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorHeadersJson(payload),
        },
        payload
      );

      assert.equal(response.status, 500);
      const body = JSON.parse(response.body);
      assert.equal(body.errorCode, "assignment_save_failed");
      assert.equal(body.message, "Could not save reviewer assignments at this time.");

      const assignments = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(assignments.status, 200);
      assert.equal(JSON.parse(assignments.body).assignments.length, 0);
    }
  );
});

test("UC-08 integration expected failure path: non-editor access is forbidden and cannot assign", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const formDenied = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assign-reviewers`,
        headers: {
          Cookie: "cms_session=sid_author",
          Accept: "text/html",
        },
      });
      assert.equal(formDenied.status, 403);

      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2", "R3"] });
      const postDenied = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_author",
            Accept: "application/json",
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        payload
      );
      assert.equal(postDenied.status, 403);

      const assignments = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(assignments.status, 200);
      assert.equal(JSON.parse(assignments.body).assignments.length, 0);
    }
  );
});

test("UC-08 integration expected failure path: invitation failure keeps assignments and returns warning", async () => {
  const assignmentDataAccess = makeDataAccess();
  const assignmentService = createAssignmentService({
    dataAccess: assignmentDataAccess,
    notificationService: {
      async sendReviewerInvitations() {
        return {
          type: "partial_failure",
          warningCode: "invitation_partial_failure",
          warningMessage:
            "Assignments were saved, but one or more reviewer invitations failed and were logged for retry.",
          failures: [{ reviewerId: "R2", reason: "NOTIFICATION_DOWN" }],
        };
      },
    },
  });

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
      assignmentService,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_ids: ["R1", "R2", "R3"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorHeadersJson(payload),
        },
        payload
      );

      assert.equal(response.status, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.assignment_count, 3);
      assert.equal(body.warningCode, "invitation_partial_failure");
      assert.equal(body.warningMessage.includes("Assignments were saved"), true);

      const assignments = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(assignments.status, 200);
      assert.equal(JSON.parse(assignments.body).assignments.length, 3);
    }
  );
});

test("UC-08 integration covers HTML success render branch and default warning fallback", async () => {
  const assignmentDataAccess = makeDataAccess();
  const assignmentService = {
    async assignReviewers() {
      return {
        type: "success",
        paperId: PAPER_ID,
        assignmentCount: 3,
      };
    },
  };

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
      assignmentService,
    },
    async (baseUrl) => {
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_editor",
            Accept: "text/html",
            "Content-Type": "text/plain",
          },
        },
        "ignored"
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.includes("Reviewers assigned successfully."), true);
      assert.equal(response.body.includes("invitation_partial_failure"), false);
    }
  );
});

test("UC-08 integration covers validation HTML/json fallback status branches", async () => {
  const assignmentDataAccess = makeDataAccess();
  const assignmentService = {
    async assignReviewers() {
      return {
        type: "validation_error",
        errorCode: "invalid_reviewer_count",
        message: "Exactly 3 reviewers are required.",
      };
    },
  };

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
      assignmentService,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_ids: ["R1"] });

      const jsonResponse = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: editorHeadersJson(payload),
        },
        payload
      );
      assert.equal(jsonResponse.status, 400);
      assert.equal(JSON.parse(jsonResponse.body).errorCode, "invalid_reviewer_count");

      const htmlResponse = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/assign-reviewers`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_editor",
            Accept: "text/html",
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        payload
      );
      assert.equal(htmlResponse.status, 400);
      assert.equal(htmlResponse.body.includes("Exactly 3 reviewers are required."), true);
    }
  );
});

test("UC-08 integration covers assignments unauthorized and missing-paper branches", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const unauthorized = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/assignments`,
        headers: {
          Accept: "application/json",
        },
      });
      assert.equal(unauthorized.status, 401);
      assert.equal(JSON.parse(unauthorized.body).errorCode, "session_expired");

      const missingPaper = await requestRaw(baseUrl, {
        path: "/papers/DOES_NOT_EXIST/assignments",
        headers: {
          Cookie: "cms_session=sid_editor",
          Accept: "application/json",
        },
      });
      assert.equal(missingPaper.status, 404);
      assert.equal(JSON.parse(missingPaper.body).errorCode, "invalid_paper");
    }
  );
});
