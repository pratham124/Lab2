const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");

function requestRaw(baseUrl, options) {
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
    req.end();
  });
}

function parseBody(response) {
  return JSON.parse(response.body);
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
      return null;
    },
  };
}

function buildAssignmentDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: "C1", title: "Paper 1", status: "submitted" },
        { id: "P2", conferenceId: "C1", title: "Paper 2", status: "submitted" },
        { id: "P9", conferenceId: "C1", title: "Paper 9", status: "submitted" },
        { id: "P10", conferenceId: "C1", title: "Paper 10", status: "submitted" },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer 1", eligibilityStatus: true },
        { id: "R2", name: "Reviewer 2", eligibilityStatus: true },
      ],
      assignments: [
        { id: "A1", conferenceId: "C1", paperId: "P1", reviewerId: "R1" },
        { id: "A2", conferenceId: "C1", paperId: "P10", reviewerId: "R1" },
      ],
      manuscripts: [
        { manuscriptId: "M1", paperId: "P1", availability: "available", content: "Assigned paper body" },
        { manuscriptId: "M2", paperId: "P2", availability: "available", content: "Unassigned for R1" },
        { manuscriptId: "M9", paperId: "P9", availability: "available", content: "Unassigned paper body" },
        { manuscriptId: "M10", paperId: "P10", availability: "unavailable", content: "" },
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

test("UC-12 integration happy path: assigned reviewer can list and view assigned paper content", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const list = await requestRaw(baseUrl, {
        path: "/reviewer/assignments",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(list.status, 200);
      const listBody = parseBody(list);
      assert.deepEqual(
        listBody.items.map((item) => item.paperId),
        ["P1", "P10"]
      );

      const view = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P1",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(view.status, 200);
      const viewBody = parseBody(view);
      assert.equal(viewBody.paperId, "P1");
      assert.equal(viewBody.reviewInfo.viewOnly, true);
      assert.equal(viewBody.content, "Assigned paper body");
    }
  );
});

test("UC-12 integration invalid input: malformed route and unsupported method return not found", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const malformedId = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P!1",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(malformedId.status, 404);

      const unsupportedMethod = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P1/download",
        method: "POST",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(unsupportedMethod.status, 404);
    }
  );
});

test("UC-12 integration expected failure: unauthenticated requests are blocked", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const listJson = await requestRaw(baseUrl, {
        path: "/reviewer/assignments",
        headers: { Accept: "application/json" },
      });
      assert.equal(listJson.status, 401);
      assert.equal(parseBody(listJson).errorCode, "not_authenticated");

      const listHtml = await requestRaw(baseUrl, {
        path: "/reviewer/assignments",
        headers: { Accept: "text/html" },
      });
      assert.equal(listHtml.status, 302);
      assert.equal(listHtml.headers.location, "/login.html");

      const viewJson = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P1",
        headers: { Accept: "application/json" },
      });
      assert.equal(viewJson.status, 401);
    }
  );
});

test("UC-12 integration expected failure: reviewer with no assignments gets empty state", async () => {
  await withMutedConsole(async () => {
    await withServer(
      {
        sessionService: makeSessionService(),
        assignmentDataAccess: buildAssignmentDataAccess(),
      },
      async (baseUrl) => {
        const listJson = await requestRaw(baseUrl, {
          path: "/reviewer/assignments",
          headers: { Cookie: "cms_session=sid_r2", Accept: "application/json" },
        });
        assert.equal(listJson.status, 200);
        assert.deepEqual(parseBody(listJson).items, []);

        const listHtml = await requestRaw(baseUrl, {
          path: "/reviewer/assignments",
          headers: { Cookie: "cms_session=sid_r2", Accept: "text/html" },
        });
        assert.equal(listHtml.status, 200);
        assert.equal(listHtml.body.includes("No papers are currently assigned."), true);
      }
    );
  });
});

test("UC-12 integration expected failure: unassigned paper access returns 403", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const response = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P9",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(response.status, 403);
      const payload = parseBody(response);
      assert.equal(payload.errorCode, "access_denied");
      assert.equal(payload.message, "Access denied.");
      assert.equal(payload.backLink, "/reviewer/assignments");
    }
  );
});

test("UC-12 integration expected failure: manuscript unavailable returns 409", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const response = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P10",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(response.status, 409);
      const payload = parseBody(response);
      assert.equal(payload.errorCode, "manuscript_unavailable");
      assert.equal(payload.backLink, "/reviewer/assignments");
    }
  );
});

test("UC-12 integration expected failure: list/view retrieval failures return safe 500 payloads", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
      assignmentService: {
        listAssignedPapers() {
          throw new Error("DB_STACKTRACE_LIST");
        },
        getAssignedPaperContent() {
          throw new Error("DB_STACKTRACE_VIEW");
        },
      },
    },
    async (baseUrl) => {
      const listFail = await requestRaw(baseUrl, {
        path: "/reviewer/assignments",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(listFail.status, 500);
      const listBody = parseBody(listFail);
      assert.equal(listBody.errorCode, "assigned_papers_unavailable");
      assert.equal(listFail.body.includes("DB_STACKTRACE_LIST"), false);

      const viewFail = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P1",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(viewFail.status, 500);
      const viewBody = parseBody(viewFail);
      assert.equal(viewBody.errorCode, "paper_retrieval_failed");
      assert.equal(viewFail.body.includes("DB_STACKTRACE_VIEW"), false);
    }
  );
});

test("UC-12 integration expected failure: download endpoint remains unavailable", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const response = await requestRaw(baseUrl, {
        path: "/reviewer/assignments/P1/download",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(response.status, 404);
      const payload = parseBody(response);
      assert.equal(payload.errorCode, "download_not_available");
      assert.equal(payload.message, "Download is not available for assigned papers.");
    }
  );
});
