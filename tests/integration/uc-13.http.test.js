const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { createDataAccess } = require("../../src/services/data_access");

const PAPER_ID = "P1";
const UNASSIGNED_PAPER_ID = "P9";

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
      if (sessionId === "sid_r1") {
        return { user_id: "R1", role: "reviewer" };
      }
      if (sessionId === "sid_editor") {
        return { user_id: "E1", role: "editor" };
      }
      return null;
    },
  };
}

function buildAssignmentDataAccess({ includeInvitation = true } = {}) {
  return createDataAccess({
    seed: {
      papers: [
        { id: PAPER_ID, conferenceId: "C1", title: "UC-13 Paper", status: "assigned" },
        { id: UNASSIGNED_PAPER_ID, conferenceId: "C1", title: "Other Paper", status: "assigned" },
      ],
      reviewers: [
        { id: "R1", name: "Reviewer 1", eligibilityStatus: true },
      ],
      assignments: [
        { id: "A1", conferenceId: "C1", paperId: PAPER_ID, reviewerId: "R1" },
      ],
      reviewInvitations: includeInvitation
        ? [
            {
              id: "INV_P1_R1",
              reviewerId: "R1",
              paperId: PAPER_ID,
              status: "accepted",
            },
          ]
        : [],
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

function reviewPayload({ comment, notes, simulateFailure } = {}) {
  return JSON.stringify({
    requiredFields: {
      comment: comment ?? "This is a valid review comment.",
    },
    optionalFields: {
      notes: notes ?? "Optional notes.",
    },
    simulate_failure: simulateFailure ? "1" : undefined,
  });
}

test("UC-13 integration happy path: reviewer submits and editor sees review immediately", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const preflight = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/reviews/new`,
        headers: { Cookie: "cms_session=sid_r1", Accept: "application/json" },
      });
      assert.equal(preflight.status, 200);
      assert.equal(parseBody(preflight).alreadySubmitted, false);

      const submit = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviews`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_r1",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        reviewPayload({ comment: "Review comment for editor." })
      );
      assert.equal(submit.status, 201);
      const submitBody = parseBody(submit);
      assert.equal(submitBody.status, "Submitted");

      const list = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/reviews`,
        headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
      });
      assert.equal(list.status, 200);
      const listBody = parseBody(list);
      assert.equal(listBody.items.length, 1);
      assert.equal(listBody.items[0].required_fields.comment, "Review comment for editor.");
    }
  );
});

test("UC-13 integration invalid input: missing and invalid required fields are rejected", async () => {
  await withMutedConsole(async () => {
    await withServer(
      {
        sessionService: makeSessionService(),
        assignmentDataAccess: buildAssignmentDataAccess(),
      },
      async (baseUrl) => {
        const missing = await requestRaw(
          baseUrl,
          {
            path: `/papers/${PAPER_ID}/reviews`,
            method: "POST",
            headers: {
              Cookie: "cms_session=sid_r1",
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          },
          reviewPayload({ comment: "" })
        );
        assert.equal(missing.status, 400);
        assert.equal(parseBody(missing).errorCode, "validation_error");

        const invalid = await requestRaw(
          baseUrl,
          {
            path: `/papers/${PAPER_ID}/reviews`,
            method: "POST",
            headers: {
              Cookie: "cms_session=sid_r1",
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          },
          reviewPayload({ comment: "short" })
        );
        assert.equal(invalid.status, 400);
        assert.equal(parseBody(invalid).errorCode, "validation_error");

        const list = await requestRaw(baseUrl, {
          path: `/papers/${PAPER_ID}/reviews`,
          headers: { Cookie: "cms_session=sid_editor", Accept: "application/json" },
        });
        assert.equal(list.status, 200);
        assert.equal(parseBody(list).items.length, 0);
      }
    );
  });
});

test("UC-13 integration expected failure: unauthorized, duplicate, and system failure paths", async () => {
  await withServer(
    {
      sessionService: makeSessionService(),
      assignmentDataAccess: buildAssignmentDataAccess(),
    },
    async (baseUrl) => {
      const unauthorized = await requestRaw(
        baseUrl,
        {
          path: `/papers/${UNASSIGNED_PAPER_ID}/reviews`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_r1",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        reviewPayload({ comment: "Unauthorized attempt." })
      );
      assert.equal(unauthorized.status, 403);
      assert.equal(parseBody(unauthorized).errorCode, "not_authorized");

      const first = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviews`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_r1",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        reviewPayload({ comment: "First submission." })
      );
      assert.equal(first.status, 201);

      const duplicate = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviews`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_r1",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        reviewPayload({ comment: "Second submission." })
      );
      assert.equal(duplicate.status, 409);
      assert.equal(parseBody(duplicate).errorCode, "duplicate_review");

      const failure = await requestRaw(
        baseUrl,
        {
          path: `/papers/${PAPER_ID}/reviews`,
          method: "POST",
          headers: {
            Cookie: "cms_session=sid_r1",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        reviewPayload({ comment: "Failure submission.", simulateFailure: true })
      );
      assert.equal(failure.status, 500);
      assert.equal(parseBody(failure).errorCode, "save_failure");
    }
  );
});
