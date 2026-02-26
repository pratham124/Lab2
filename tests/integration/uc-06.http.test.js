const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const http = require("http");

const { createAppServer } = require("../../src/server");

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

function makeStore() {
  const primaryEmail = "uc06.author@example.com";
  const secondaryEmail = "uc06.other@example.com";

  const usersByEmail = new Map([
    [
      primaryEmail,
      {
        id: "uc06_user_1",
        email: primaryEmail,
        status: "active",
        salt: "uc06-salt-1",
        password_hash: hashPassword("ValidPassw0rd!", "uc06-salt-1"),
      },
    ],
    [
      secondaryEmail,
      {
        id: "uc06_user_2",
        email: secondaryEmail,
        status: "active",
        salt: "uc06-salt-2",
        password_hash: hashPassword("ValidPassw0rd!", "uc06-salt-2"),
      },
    ],
  ]);

  return {
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

async function withServer(run, overrides = {}) {
  const { server } = createAppServer({
    store: makeStore(),
    ...overrides,
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function loginAndGetCookie(baseUrl, email) {
  const payload = JSON.stringify({ email, password: "ValidPassw0rd!" });
  const login = await requestRaw(
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

  assert.equal(login.status, 200);
  const rawSetCookie = login.headers["set-cookie"];
  const cookie = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
  assert.equal(typeof cookie, "string");
  return cookie;
}

function draftPutRequest({ cookie, idempotencyKey, body }) {
  const payload = JSON.stringify(body);
  const headers = {
    Cookie: cookie,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  return { payload, headers };
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

test("UC-06 integration happy path: save, retrieve, and idempotent repeat save", async () => {
  await withServer(async (baseUrl) => {
    const ownerCookie = await loginAndGetCookie(baseUrl, "uc06.author@example.com");
    const submissionId = "uc06_submission_happy";

    const initialBody = {
      data: {
        title: "  Draft Title  ",
        abstract: "Partial abstract",
        contact_email: "uc06.author@example.com",
      },
      idempotency_key: "save-1",
    };

    const firstReq = draftPutRequest({
      cookie: ownerCookie,
      idempotencyKey: "save-1",
      body: initialBody,
    });

    const firstSave = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${submissionId}/draft`,
        method: "PUT",
        headers: firstReq.headers,
      },
      firstReq.payload
    );
    assert.equal(firstSave.status, 200);
    const firstPayload = JSON.parse(firstSave.body);
    assert.equal(firstPayload.data.title, "Draft Title");
    assert.equal(firstPayload.conflictDetected, false);

    const secondSave = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${submissionId}/draft`,
        method: "PUT",
        headers: firstReq.headers,
      },
      firstReq.payload
    );
    assert.equal(secondSave.status, 200);
    assert.equal(secondSave.body, firstSave.body);

    const getDraft = await requestRaw(baseUrl, {
      path: `/submissions/${submissionId}/draft`,
      headers: {
        Cookie: ownerCookie,
        Accept: "application/json",
      },
    });
    assert.equal(getDraft.status, 200);
    const getPayload = JSON.parse(getDraft.body);
    assert.equal(getPayload.data.title, "Draft Title");
  });
});

test("UC-06 integration invalid input: provided invalid field returns validation error", async () => {
  await withMutedConsole(async () => {
    await withServer(async (baseUrl) => {
      const ownerCookie = await loginAndGetCookie(baseUrl, "uc06.author@example.com");
      const submissionId = "uc06_submission_invalid";

      const request = draftPutRequest({
        cookie: ownerCookie,
        body: {
          data: {
            contact_email: "bad-email",
          },
        },
      });

      const save = await requestRaw(
        baseUrl,
        {
          path: `/submissions/${submissionId}/draft`,
          method: "PUT",
          headers: request.headers,
        },
        request.payload
      );

      assert.equal(save.status, 400);
      const payload = JSON.parse(save.body);
      assert.equal(payload.errorCode, "validation_error");
      assert.equal(payload.fieldErrors.contact_email, "Contact email must be valid.");
    });
  });
});

test("UC-06 integration expected failure: unauthorized draft access is denied", async () => {
  await withServer(async (baseUrl) => {
    const ownerCookie = await loginAndGetCookie(baseUrl, "uc06.author@example.com");
    const otherCookie = await loginAndGetCookie(baseUrl, "uc06.other@example.com");
    const submissionId = "uc06_submission_private";

    const ownerRequest = draftPutRequest({
      cookie: ownerCookie,
      body: {
        data: {
          title: "Owner Draft",
        },
      },
    });

    const ownerSave = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${submissionId}/draft`,
        method: "PUT",
        headers: ownerRequest.headers,
      },
      ownerRequest.payload
    );
    assert.equal(ownerSave.status, 200);

    const otherGet = await requestRaw(baseUrl, {
      path: `/submissions/${submissionId}/draft`,
      headers: {
        Cookie: otherCookie,
        Accept: "application/json",
      },
    });
    assert.equal(otherGet.status, 403);

    const otherPutReq = draftPutRequest({
      cookie: otherCookie,
      body: {
        data: {
          title: "Unauthorized overwrite",
        },
      },
    });

    const otherPut = await requestRaw(
      baseUrl,
      {
        path: `/submissions/${submissionId}/draft`,
        method: "PUT",
        headers: otherPutReq.headers,
      },
      otherPutReq.payload
    );
    assert.equal(otherPut.status, 403);
  });
});

test("UC-06 integration expected failure: simulated persistence failure returns safe error", async () => {
  const failingDraftService = {
    async getDraft() {
      return {
        type: "not_found",
        status: 404,
      };
    },
    async saveDraft() {
      return {
        type: "system_error",
        status: 500,
        message: "Draft could not be saved. Please try again.",
      };
    },
  };

  await withServer(
    async (baseUrl) => {
      const ownerCookie = await loginAndGetCookie(baseUrl, "uc06.author@example.com");
      const submissionId = "uc06_submission_failure";

      const request = draftPutRequest({
        cookie: ownerCookie,
        body: {
          data: {
            title: "Will fail",
          },
        },
      });

      const save = await requestRaw(
        baseUrl,
        {
          path: `/submissions/${submissionId}/draft`,
          method: "PUT",
          headers: request.headers,
        },
        request.payload
      );

      assert.equal(save.status, 500);
      const payload = JSON.parse(save.body);
      assert.equal(payload.errorCode, "save_failure");
      assert.equal(payload.message, "Draft could not be saved. Please try again.");
    },
    { draftService: failingDraftService }
  );
});
