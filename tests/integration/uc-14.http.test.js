const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");

const PAPER_ID = "P1";
const UNAUTHORIZED_PAPER_ID = "P9";

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

function parseBody(response) {
  return JSON.parse(response.body);
}

function makeSessionService() {
  return {
    validate(sessionId) {
      if (sessionId === "sid_editor") {
        return { user_id: "E1", role: "editor" };
      }
      if (sessionId === "sid_reviewer") {
        return { user_id: "R1", role: "reviewer" };
      }
      return null;
    },
  };
}

function buildDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        {
          id: PAPER_ID,
          conferenceId: "C1",
          title: "UC-14 Paper",
          status: "submitted",
          assignedReviewerCount: 1,
          assignedEditorId: "E1",
        },
        {
          id: UNAUTHORIZED_PAPER_ID,
          conferenceId: "C1",
          title: "Unauthorized Paper",
          status: "submitted",
          assignedReviewerCount: 1,
          assignedEditorId: "E2",
        },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer One", eligibilityStatus: true },
      ],
      assignments: [
        { id: "A1", conferenceId: "C1", paperId: PAPER_ID, reviewerId: "R1" },
      ],
      reviewInvitations: [
        { id: "INV_P1_R1", reviewerId: "R1", paperId: PAPER_ID, status: "accepted" },
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

function reviewPayload({ comment, notes } = {}) {
  return JSON.stringify({
    requiredFields: {
      comment: comment ?? "Completed review comment.",
    },
    optionalFields: {
      notes: notes ?? "Optional notes.",
    },
  });
}

test("UC-14 integration happy path: assigned editor views completed reviews", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess(),
    },
    async (baseUrl) => {
      const submit = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviews`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_reviewer",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        reviewPayload({ comment: "Editor-visible review comment." })
      );
      assert.equal(submit.status, 201);

      const list = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/reviews/completed`,
        headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
      });
      assert.equal(list.status, 200);
      const payload = parseBody(list);
      assert.equal(payload.paperId, PAPER_ID);
      assert.equal(payload.completedReviews.length, 1);
      assert.equal(payload.completedReviews[0].reviewerId, "R1");
      assert.equal(payload.completedReviews[0].reviewerName, "Reviewer One");
    }
  );
});

test("UC-14 integration invalid input: unknown paper id", async () => {
  await withMutedConsole(async () => {
    await withServer(
      {
        sessionService: makeSessionService(),
        assignmentDataAccess: buildDataAccess(),
      },
      async (baseUrl) => {
        const response = await requestRaw(baseUrl, {
          path: `/papers/UNKNOWN/reviews/completed`,
          headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
        });
        assert.equal(response.status, 404);
        const payload = parseBody(response);
        assert.equal(payload.message, "Paper not found.");
      }
    );
  });
});

test("UC-14 integration failure paths: unauthorized and retrieval failure", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildDataAccess(),
      reviewService: {
        listCompletedReviews() {
          return { type: "failure", message: "Review retrieval failed.", error: new Error("DB") };
        },
      },
    },
    async (baseUrl) => {
      const unauthorized = await requestRaw(baseUrl, {
        path: `/papers/${UNAUTHORIZED_PAPER_ID}/reviews/completed`,
        headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
      });
      assert.equal(unauthorized.status, 403);
      assert.equal(parseBody(unauthorized).message, "Access denied.");

      const failure = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/reviews/completed`,
        headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
      });
      assert.equal(failure.status, 500);
      const payload = parseBody(failure);
      assert.equal(payload.message, "Completed reviews cannot be retrieved at this time.");
      assert.ok(payload.errorId);
    }
  );
});
