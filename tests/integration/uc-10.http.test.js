const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");
const {
  createAssignmentRuleValidationService,
} = require("../../src/services/assignment_rule_validation_service");

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

function makeDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: PAPER_ID, conferenceId: "C1", title: "UC-10 Integration Paper", status: "submitted" },
        { id: "P2", conferenceId: "C1", title: "UC-10 Paper 2", status: "submitted" },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer 1", currentAssignmentCount: 1, eligibilityStatus: true },
        { id: "R2", name: "Reviewer 2", currentAssignmentCount: 2, eligibilityStatus: true },
        { id: "R3", name: "Reviewer 3", currentAssignmentCount: 3, eligibilityStatus: true },
        { id: "R4", name: "Reviewer 4", currentAssignmentCount: 4, eligibilityStatus: true },
        { id: "R5", name: "Reviewer 5", currentAssignmentCount: 5, eligibilityStatus: true },
      ],
      assignments: [
        { id: "R5A1", conferenceId: "C1", paperId: "BASE_R5_1", reviewerId: "R5" },
        { id: "R5A2", conferenceId: "C1", paperId: "BASE_R5_2", reviewerId: "R5" },
        { id: "R5A3", conferenceId: "C1", paperId: "BASE_R5_3", reviewerId: "R5" },
        { id: "R5A4", conferenceId: "C1", paperId: "BASE_R5_4", reviewerId: "R5" },
        { id: "R5A5", conferenceId: "C1", paperId: "BASE_R5_5", reviewerId: "R5" },
      ],
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
      if (sessionId === "sid_admin") {
        return { user_id: "admin_1", role: "admin" };
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

function jsonHeaders(sessionId, payload) {
  return {
    Cookie: `cms_session=${sessionId}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
}

function readHeaders(sessionId) {
  return {
    Cookie: `cms_session=${sessionId}`,
    Accept: "application/json",
  };
}

test("UC-10 integration happy path: valid reviewer assignment saves successfully", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewerIds: ["R1", "R2", "R3"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviewer-assignments`,
          method: "POST",
          headers: jsonHeaders("sid_editor", payload),
        },
        payload
      );

      assert.equal(response.status, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.paper_id, PAPER_ID);
      assert.equal(body.assignment_count, 3);
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId(PAPER_ID).length, 3);
    }
  );
});

test("UC-10 integration invalid input path: invalid reviewer count returns 422 violations and blocks save", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewerIds: ["R1", "R2"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviewer-assignments`,
          method: "POST",
          headers: jsonHeaders("sid_editor", payload),
        },
        payload
      );

      assert.equal(response.status, 422);
      const body = JSON.parse(response.body);
      assert.equal(Array.isArray(body.violations), true);
      assert.equal(body.violations.length, 1);
      assert.equal(body.violations[0].violated_rule_id, "required_reviewer_count");
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
    }
  );
});

test("UC-10 integration expected failure path: multiple violations are returned together and audited", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewerIds: ["R1", "R5"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviewer-assignments`,
          method: "POST",
          headers: jsonHeaders("sid_editor", payload),
        },
        payload
      );

      assert.equal(response.status, 422);
      const body = JSON.parse(response.body);
      assert.equal(body.violations.length, 2);
      const violationIds = body.violations.map((v) => v.violated_rule_id).sort();
      assert.deepEqual(violationIds, ["required_reviewer_count", "reviewer_workload_limit"]);
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);

      const logsResponse = await requestRaw(baseUrl, {
        path: "/assignment-violations/audit-logs",
        headers: readHeaders("sid_admin"),
      });
      assert.equal(logsResponse.status, 200);
      const logsBody = JSON.parse(logsResponse.body);
      assert.equal(logsBody.entries.length, 2);
    }
  );
});

test("UC-10 integration expected failure path: validation unavailable returns safe 503 and no save", async () => {
  const assignmentDataAccess = makeDataAccess();
  assignmentDataAccess.listAssignmentsByConference = () => {
    throw new Error("DB_READ_FAILURE");
  };

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewerIds: ["R1", "R2", "R3"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviewer-assignments`,
          method: "POST",
          headers: jsonHeaders("sid_editor", payload),
        },
        payload
      );

      assert.equal(response.status, 503);
      const body = JSON.parse(response.body);
      assert.equal(body.message, "Validation cannot be completed now and the assignment is not saved.");
      assert.equal(response.body.includes("DB_READ_FAILURE"), false);
      assert.equal(response.body.toLowerCase().includes("stack"), false);
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId(PAPER_ID).length, 0);
    }
  );
});

test("UC-10 integration expected failure path: audit logs are admin-only", async () => {
  const assignmentDataAccess = makeDataAccess();

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewerIds: ["R1", "R2"] });
      await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviewer-assignments`,
          method: "POST",
          headers: jsonHeaders("sid_editor", payload),
        },
        payload
      );

      const editorRead = await requestRaw(baseUrl, {
        path: "/assignment-violations/audit-logs",
        headers: readHeaders("sid_editor"),
      });
      assert.equal(editorRead.status, 403);

      const authorRead = await requestRaw(baseUrl, {
        path: "/assignment-violations/audit-logs",
        headers: readHeaders("sid_author"),
      });
      assert.equal(authorRead.status, 403);

      const adminRead = await requestRaw(baseUrl, {
        path: "/assignment-violations/audit-logs",
        headers: readHeaders("sid_admin"),
      });
      assert.equal(adminRead.status, 200);
      assert.equal(JSON.parse(adminRead.body).entries.length >= 1, true);
    }
  );
});

test("UC-10 integration expected flow: save-time validation uses current rule configuration", async () => {
  const assignmentDataAccess = makeDataAccess();
  let requiredReviewerCount = 3;
  const assignmentRuleValidationService = createAssignmentRuleValidationService({
    dataAccess: assignmentDataAccess,
    rulesProvider: {
      getCurrentRules() {
        return {
          requiredReviewerCount,
          maxReviewerWorkload: 5,
        };
      },
    },
  });

  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
      assignmentRuleValidationService,
    },
    async (baseUrl) => {
      requiredReviewerCount = 4;

      const payload = JSON.stringify({ reviewerIds: ["R1", "R2", "R3"] });
      const response = await requestRaw(
        baseUrl,
        {
          path: "/papers/P2/reviewer-assignments",
          method: "POST",
          headers: jsonHeaders("sid_editor", payload),
        },
        payload
      );

      assert.equal(response.status, 422);
      const body = JSON.parse(response.body);
      assert.equal(body.violations.length, 1);
      assert.equal(body.violations[0].violation_message.includes("Exactly 4 reviewers"), true);
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId("P2").length, 0);
    }
  );
});
