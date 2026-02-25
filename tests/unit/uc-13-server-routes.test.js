const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");

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

function makeSessionService() {
  return {
    validate(sessionId) {
      if (sessionId === "sid_r1") {
        return { user_id: "R1" };
      }
      if (sessionId === "sid_editor") {
        return { user_id: "E1" };
      }
      return null;
    },
  };
}

function buildAssignmentDataAccess() {
  return createDataAccess({
    seed: {
      papers: [
        { id: "P1", conferenceId: "C1", title: "Paper 1", status: "assigned" },
      ],
      reviewers: [{ id: "R1", name: "Reviewer 1", eligibilityStatus: true }],
      assignments: [{ id: "A1", conferenceId: "C1", paperId: "P1", reviewerId: "R1" }],
      reviewInvitations: [
        { id: "INV_P1_R1", reviewerId: "R1", paperId: "P1", status: "accepted" },
      ],
    },
  });
}

test("UC-13 server routes handle review form, submission, and list", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const form = await requestRaw(baseUrl, {
        path: "/papers/P1/reviews/new",
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(form.status, 200);

      const submit = await requestRaw(
        baseUrl,
        {
          path: "/papers/P1/reviews",
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_r1",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        JSON.stringify({
          requiredFields: { comment: "Valid review comment." },
          optionalFields: { notes: "Optional" },
        })
      );
      assert.equal(submit.status, 201);

      const list = await requestRaw(baseUrl, {
        path: "/papers/P1/reviews",
        headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
      });
      assert.equal(list.status, 200);
      const payload = JSON.parse(list.body);
      assert.equal(payload.items.length, 1);
    }
  );
});
