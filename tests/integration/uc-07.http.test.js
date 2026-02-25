const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const http = require("http");

const { createAppServer } = require("../../src/server");

const PAPER_ID = "P1";

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

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

function makeStore({ decisionForP1 } = {}) {
  const saltA = "uc07-salt-a";
  const saltB = "uc07-salt-b";
  const authorAEmail = "uc07.author.a@example.com";
  const authorBEmail = "uc07.author.b@example.com";

  const usersByEmail = new Map([
    [
      authorAEmail,
      {
        id: "uc07_author_a",
        email: authorAEmail,
        status: "active",
        salt: saltA,
        password_hash: hashPassword("ValidPassw0rd!", saltA),
      },
    ],
    [
      authorBEmail,
      {
        id: "uc07_author_b",
        email: authorBEmail,
        status: "active",
        salt: saltB,
        password_hash: hashPassword("ValidPassw0rd!", saltB),
      },
    ],
  ]);

  return {
    submissions: [
      {
        submission_id: PAPER_ID,
        author_id: "uc07_author_a",
        title: "UC-07 Integration Paper",
        contact_email: authorAEmail,
        final_decision: decisionForP1 || null,
      },
    ],
    notifications: [],
    usersByEmail,
    findUserByEmailCanonical(emailCanonical) {
      return this.usersByEmail.get(emailCanonical) || null;
    },
    findUserById(userId) {
      for (const user of this.usersByEmail.values()) {
        if (user.id === userId) {
          return user;
        }
      }
      return null;
    },
    updateUserPassword() {
      return null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };
}

async function loginAndGetCookie(baseUrl, email) {
  const payload = JSON.stringify({
    email,
    password: "ValidPassw0rd!",
  });
  const response = await requestRaw(
    baseUrl,
    {
      path: "/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    payload
  );

  assert.equal(response.status, 200);
  const setCookie = response.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.equal(typeof cookie, "string");
  return cookie;
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

test("UC-07 integration happy path: submitting author sees published decision in list and detail", async () => {
  await withServer(
    {
      store: makeStore({
        decisionForP1: {
          decision_value: "Accepted",
          published_at: "2026-02-01T10:00:00.000Z",
        },
      }),
    },
    async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, "uc07.author.a@example.com");

      const list = await requestRaw(baseUrl, {
        path: "/papers",
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
      });
      assert.equal(list.status, 200);
      const listBody = JSON.parse(list.body);
      assert.equal(Array.isArray(listBody.items), true);
      assert.equal(listBody.items.length, 1);
      assert.equal(listBody.items[0].paperId, PAPER_ID);
      assert.equal(listBody.items[0].decisionPublished, true);
      assert.equal(listBody.items[0].decisionStatus, "Accepted");

      const detail = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/decision`,
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
      });
      assert.equal(detail.status, 200);
      const detailBody = JSON.parse(detail.body);
      assert.equal(detailBody.paper_id, PAPER_ID);
      assert.equal(detailBody.decision_value, "Accepted");
      assert.equal(detailBody.published_at, "2026-02-01T10:00:00.000Z");
    }
  );
});

test("UC-07 integration invalid input path: non-existent paper id returns not found", async () => {
  await withServer(
    {
      store: makeStore({
        decisionForP1: {
          decision_value: "Accepted",
          published_at: "2026-02-01T10:00:00.000Z",
        },
      }),
    },
    async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, "uc07.author.a@example.com");
      const response = await requestRaw(baseUrl, {
        path: "/papers/DOES_NOT_EXIST/decision",
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
      });

      assert.equal(response.status, 404);
      const body = JSON.parse(response.body);
      assert.equal(body.message, "Paper or decision not found.");
    }
  );
});

test("UC-07 integration expected failure paths: unpublished decision and unauthorized access are blocked", async () => {
  await withServer(
    {
      store: makeStore({
        decisionForP1: {
          decision_value: "Rejected",
          published_at: null,
        },
      }),
    },
    async (baseUrl) => {
      const ownerCookie = await loginAndGetCookie(baseUrl, "uc07.author.a@example.com");
      const otherCookie = await loginAndGetCookie(baseUrl, "uc07.author.b@example.com");

      const unpublished = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/decision`,
        headers: {
          Cookie: ownerCookie,
          Accept: "application/json",
        },
      });
      assert.equal(unpublished.status, 409);
      assert.equal(
        JSON.parse(unpublished.body).message,
        "Decision exists but is not officially published."
      );

      const unauthorized = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/decision`,
        headers: {
          Cookie: otherCookie,
          Accept: "application/json",
        },
      });
      assert.equal(unauthorized.status, 403);
      assert.equal(JSON.parse(unauthorized.body).message, "Access denied.");
    }
  );
});

test("UC-07 integration expected failure path: retrieval failure returns safe 503 message", async () => {
  await withServer(
    {
      store: makeStore({
        decisionForP1: {
          decision_value: "Accepted",
          published_at: "2026-02-01T10:00:00.000Z",
        },
      }),
      decisionService: {
        async listDecisionsForAuthor() {
          return { type: "retrieval_error", status: 503 };
        },
        async getDecisionForPaper() {
          return { type: "retrieval_error", status: 503 };
        },
      },
    },
    async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, "uc07.author.a@example.com");

      const listFailure = await requestRaw(baseUrl, {
        path: "/papers",
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
      });
      assert.equal(listFailure.status, 503);
      const listBody = JSON.parse(listFailure.body);
      assert.equal(listBody.message, "Decision temporarily unavailable. Please try again later.");
      assert.equal(listFailure.body.includes("Accepted"), false);
      assert.equal(listFailure.body.toLowerCase().includes("stack"), false);

      const detailFailure = await requestRaw(baseUrl, {
        path: `/papers/${PAPER_ID}/decision`,
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
      });
      assert.equal(detailFailure.status, 503);
      const detailBody = JSON.parse(detailFailure.body);
      assert.equal(detailBody.message, "Decision temporarily unavailable. Please try again later.");
      assert.equal(detailFailure.body.includes("Accepted"), false);
      assert.equal(detailFailure.body.toLowerCase().includes("stack"), false);
    }
  );
});
