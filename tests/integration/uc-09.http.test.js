const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");
const { countAssignmentsForReviewerConference } = require("../../src/models/workload_count");

const CONFERENCE_ID = "C1";

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
    create(userId) {
      return { session_id: `sid_${userId}`, user_id: userId };
    },
    validate(sessionId) {
      if (sessionId === "sid_editor") {
        return { user_id: "editor_1", role: "editor" };
      }
      if (sessionId === "sid_editor_a") {
        return { user_id: "editor_a", role: "editor" };
      }
      if (sessionId === "sid_editor_b") {
        return { user_id: "editor_b", role: "editor" };
      }
      if (sessionId === "sid_author") {
        return { user_id: "author_1", role: "author" };
      }
      return null;
    },
    destroy() {},
  };
}

function makeDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: CONFERENCE_ID, title: "UC-09 P1", status: "submitted", assignedReviewerCount: 0 },
        { id: "P2", conferenceId: CONFERENCE_ID, title: "UC-09 P2", status: "submitted", assignedReviewerCount: 0 },
        { id: "P4", conferenceId: CONFERENCE_ID, title: "UC-09 P4", status: "submitted", assignedReviewerCount: 0 },
        { id: "P6", conferenceId: CONFERENCE_ID, title: "UC-09 P6", status: "submitted", assignedReviewerCount: 0 },
        { id: "P7", conferenceId: CONFERENCE_ID, title: "UC-09 P7", status: "submitted", assignedReviewerCount: 0 },
        { id: "P8", conferenceId: CONFERENCE_ID, title: "UC-09 P8", status: "submitted", assignedReviewerCount: 0 },
      ],
      reviewers: [
        { id: "R0", name: "Reviewer 0", currentAssignmentCount: 0, eligibilityStatus: true },
        { id: "R2", name: "Reviewer 2", currentAssignmentCount: 2, eligibilityStatus: true },
        { id: "R4", name: "Reviewer 4", currentAssignmentCount: 4, eligibilityStatus: true },
        { id: "R5", name: "Reviewer 5", currentAssignmentCount: 5, eligibilityStatus: true },
      ],
      assignments: [
        { id: "R5A1", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_1", reviewerId: "R5" },
        { id: "R5A2", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_2", reviewerId: "R5" },
        { id: "R5A3", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_3", reviewerId: "R5" },
        { id: "R5A4", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_4", reviewerId: "R5" },
        { id: "R5A5", conferenceId: CONFERENCE_ID, paperId: "BASE_R5_5", reviewerId: "R5" },
        { id: "R4A1", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_1", reviewerId: "R4" },
        { id: "R4A2", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_2", reviewerId: "R4" },
        { id: "R4A3", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_3", reviewerId: "R4" },
        { id: "R4A4", conferenceId: CONFERENCE_ID, paperId: "BASE_R4_4", reviewerId: "R4" },
        { id: "R2A1", conferenceId: CONFERENCE_ID, paperId: "BASE_R2_1", reviewerId: "R2" },
        { id: "R2A2", conferenceId: CONFERENCE_ID, paperId: "BASE_R2_2", reviewerId: "R2" },
      ],
    },
  });
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

function getHeaders(sessionId) {
  return {
    Cookie: `cms_session=${sessionId}`,
    Accept: "application/json",
  };
}

function postHeaders(sessionId, payload) {
  return {
    Cookie: `cms_session=${sessionId}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
}

function workloadCount(dataAccess, reviewerId) {
  return countAssignmentsForReviewerConference(dataAccess.listAssignmentsByConference(CONFERENCE_ID), {
    reviewerId,
    conferenceId: CONFERENCE_ID,
  });
}

async function withMutedConsole(run) {
  const original = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  try {
    return await run();
  } finally {
    console.log = original.log;
    console.error = original.error;
    console.warn = original.warn;
    console.info = original.info;
  }
}

test("UC-09 integration happy path: selectable list excludes reviewers at limit and valid assignment is created", async () => {
  const assignmentDataAccess = makeDataAccess();
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const selectable = await requestRaw(baseUrl, {
        path: `/conferences/${CONFERENCE_ID}/papers/P1/reviewers/selectable`,
        headers: getHeaders("sid_editor"),
      });
      assert.equal(selectable.status, 200);
      const selectableBody = JSON.parse(selectable.body);
      assert.equal(selectableBody.some((item) => item.reviewer_id === "R5"), false);
      assert.equal(selectableBody.some((item) => item.reviewer_id === "R4"), true);

      const payload = JSON.stringify({ reviewer_id: "R2" });
      const assign = await requestRaw(
        baseUrl,
        {
          path: `/conferences/${CONFERENCE_ID}/papers/P1/assignments`,
          method: "POST",
          headers: postHeaders("sid_editor", payload),
        },
        payload
      );
      assert.equal(assign.status, 201);
      const body = JSON.parse(assign.body);
      assert.equal(body.paper_id, "P1");
      assert.equal(body.reviewer_id, "R2");
      assert.equal(body.conference_id, CONFERENCE_ID);

      assert.equal(assignmentDataAccess.getAssignmentsByPaperId("P1").length, 1);
      assert.equal(workloadCount(assignmentDataAccess, "R2"), 3);
    }
  );
});

test("UC-09 integration invalid input path: invalid reviewer id is rejected and not persisted", async () => {
  const assignmentDataAccess = makeDataAccess();
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payload = JSON.stringify({ reviewer_id: "R404" });
      const response = await requestRaw(
        baseUrl,
        {
          path: `/conferences/${CONFERENCE_ID}/papers/P2/assignments`,
          method: "POST",
          headers: postHeaders("sid_editor", payload),
        },
        payload
      );
      assert.equal(response.status, 400);
      const body = JSON.parse(response.body);
      assert.equal(body.code, "INVALID_REVIEWER");
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId("P2").length, 0);
    }
  );
});

test("UC-09 integration expected failure path: workload limit reached blocks assignment safely", async () => {
  await withMutedConsole(async () => {
    const assignmentDataAccess = makeDataAccess();
    await withServer(
      {
        sessionService: makeSessionService(),
        assignmentDataAccess,
      },
      async (baseUrl) => {
        const payload = JSON.stringify({ reviewer_id: "R5" });
        const response = await requestRaw(
          baseUrl,
          {
            path: `/conferences/${CONFERENCE_ID}/papers/P1/assignments`,
            method: "POST",
            headers: postHeaders("sid_editor", payload),
          },
          payload
        );

        assert.equal(response.status, 400);
        const body = JSON.parse(response.body);
        assert.equal(body.code, "WORKLOAD_LIMIT_REACHED");
        assert.equal(body.message.includes("5"), true);
        assert.equal(response.body.toLowerCase().includes("stack"), false);
        assert.equal(assignmentDataAccess.getAssignmentsByPaperId("P1").length, 0);
        assert.equal(workloadCount(assignmentDataAccess, "R5"), 5);
      }
    );
  });
});
test("UC-09 integration expected failure path: workload verification failure returns safe error and no assignment", async () => {
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
      const selectable = await requestRaw(baseUrl, {
        path: `/conferences/${CONFERENCE_ID}/papers/P4/reviewers/selectable`,
        headers: getHeaders("sid_editor"),
      });
      assert.equal(selectable.status, 400);
      const selectableBody = JSON.parse(selectable.body);
      assert.equal(selectableBody.code, "WORKLOAD_VERIFICATION_FAILED");

      const payload = JSON.stringify({ reviewer_id: "R2" });
      const assign = await requestRaw(
        baseUrl,
        {
          path: `/conferences/${CONFERENCE_ID}/papers/P4/assignments`,
          method: "POST",
          headers: postHeaders("sid_editor", payload),
        },
        payload
      );
      assert.equal(assign.status, 400);
      const assignBody = JSON.parse(assign.body);
      assert.equal(assignBody.code, "WORKLOAD_VERIFICATION_FAILED");
      assert.equal(assign.body.includes("DB_READ_FAILURE"), false);
      assert.equal(assign.body.toLowerCase().includes("stack"), false);
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId("P4").length, 0);
    }
  );
});

test("UC-09 integration expected failure path: concurrency allows at most one assignment and preserves workload cap", async () => {
  const assignmentDataAccess = makeDataAccess();
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const payloadA = JSON.stringify({ reviewer_id: "R4" });
      const payloadB = JSON.stringify({ reviewer_id: "R4" });
      const [resA, resB] = await Promise.all([
        requestRaw(
          baseUrl,
          {
            path: `/conferences/${CONFERENCE_ID}/papers/P6/assignments`,
            method: "POST",
            headers: postHeaders("sid_editor_a", payloadA),
          },
          payloadA
        ),
        requestRaw(
          baseUrl,
          {
            path: `/conferences/${CONFERENCE_ID}/papers/P7/assignments`,
            method: "POST",
            headers: postHeaders("sid_editor_b", payloadB),
          },
          payloadB
        ),
      ]);

      const outcomes = [resA, resB];
      const successCount = outcomes.filter((item) => item.status === 201).length;
      const blocked = outcomes.filter((item) => item.status !== 201);
      assert.equal(successCount, 1);
      assert.equal(blocked.length, 1);
      const blockedBody = JSON.parse(blocked[0].body);
      assert.equal(
        blockedBody.code === "WORKLOAD_LIMIT_REACHED" ||
          blockedBody.code === "CONCURRENT_WORKLOAD_CONFLICT",
        true
      );
      assert.equal(workloadCount(assignmentDataAccess, "R4"), 5);
    }
  );
});

test("UC-09 integration expected failure path: non-editor is forbidden for selection and assignment endpoints", async () => {
  const assignmentDataAccess = makeDataAccess();
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess,
    },
    async (baseUrl) => {
      const selectable = await requestRaw(baseUrl, {
        path: `/conferences/${CONFERENCE_ID}/papers/P8/reviewers/selectable`,
        headers: getHeaders("sid_author"),
      });
      assert.equal(selectable.status, 403);

      const payload = JSON.stringify({ reviewer_id: "R2" });
      const assign = await requestRaw(
        baseUrl,
        {
          path: `/conferences/${CONFERENCE_ID}/papers/P8/assignments`,
          method: "POST",
          headers: postHeaders("sid_author", payload),
        },
        payload
      );
      assert.equal(assign.status, 403);
      assert.equal(assignmentDataAccess.getAssignmentsByPaperId("P8").length, 0);
    }
  );
});
