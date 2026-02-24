const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const http = require("http");

const { createAppServer } = require("../../src/server");
const { composeSafeSaveFailureMessage } = require("../../src/lib/response_helpers");

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

function makeStore({ email = "uc04.author@example.com", password = "ValidPassw0rd!" } = {}) {
  const salt = "uc04-salt";
  const user = {
    id: "uc04_user_1",
    email,
    status: "active",
    salt,
    password_hash: hashPassword(password, salt),
  };

  return {
    usersByEmail: new Map([[email, user]]),
    findUserByEmailCanonical(emailCanonical) {
      return this.usersByEmail.get(emailCanonical) || null;
    },
    findUserById(userId) {
      for (const item of this.usersByEmail.values()) {
        if (item.id === userId) {
          return item;
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

async function loginAndGetCookie(baseUrl, { email = "uc04.author@example.com", password = "ValidPassw0rd!" } = {}) {
  const payload = JSON.stringify({ email, password });
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

function validSubmissionPayload(overrides = {}) {
  return {
    title: "End-to-End Paper",
    abstract: "This is an abstract.",
    keywords: "cms, uc04",
    affiliation: "Engineering School",
    contact_email: "uc04.author@example.com",
    manuscript: {
      filename: "paper.pdf",
      sizeBytes: 1024,
      content: "pdf-content-1",
    },
    ...overrides,
  };
}

test("UC-04 integration happy path: authenticated author submits and retrieves confirmation", async () => {
  const { server } = createAppServer({ store: makeStore() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const cookie = await loginAndGetCookie(baseUrl);

    const getForm = await requestRaw(baseUrl, {
      path: "/submissions/new.html",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(getForm.status, 200);
    assert.equal(getForm.body.includes("Submit paper"), true);

    const createPayload = JSON.stringify(validSubmissionPayload());
    const created = await requestRaw(
      baseUrl,
      {
        path: "/submissions",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(createPayload),
        },
      },
      createPayload
    );

    assert.equal(created.status, 201);
    const createdBody = JSON.parse(created.body);
    assert.equal(createdBody.status, "submitted");
    assert.equal(typeof createdBody.submission_id, "string");
    assert.equal(createdBody.redirect_to, `/submissions/${createdBody.submission_id}`);

    const confirmation = await requestRaw(baseUrl, {
      path: createdBody.redirect_to,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
      },
    });
    assert.equal(confirmation.status, 200);
    const confirmationBody = JSON.parse(confirmation.body);
    assert.equal(confirmationBody.submission_id, createdBody.submission_id);
    assert.equal(confirmationBody.title, "End-to-End Paper");
    assert.equal(confirmationBody.status, "submitted");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-04 integration invalid input path: missing metadata and invalid file are rejected", async () => {
  const { server } = createAppServer({ store: makeStore() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const cookie = await loginAndGetCookie(baseUrl);

    const badPayload = JSON.stringify(
      validSubmissionPayload({
        abstract: "",
        manuscript: {
          filename: "paper.txt",
          sizeBytes: 400,
          content: "bad-format",
        },
      })
    );

    const response = await requestRaw(
      baseUrl,
      {
        path: "/submissions",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(badPayload),
        },
      },
      badPayload
    );

    assert.equal(response.status, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.errorCode, "validation_error");
    assert.equal(body.fieldErrors.abstract, "Abstract is required.");
    assert.equal(body.fieldErrors.manuscript, "Manuscript must be PDF, DOCX, or LaTeX ZIP.");

    const missingConfirmation = await requestRaw(baseUrl, {
      path: "/submissions/not-created",
      headers: {
        Cookie: cookie,
        Accept: "application/json",
      },
    });
    assert.equal(missingConfirmation.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-04 integration expected failure path: duplicate submission is blocked", async () => {
  const { server } = createAppServer({ store: makeStore() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const cookie = await loginAndGetCookie(baseUrl);
    const payload = JSON.stringify(validSubmissionPayload());

    const first = await requestRaw(
      baseUrl,
      {
        path: "/submissions",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );
    assert.equal(first.status, 201);

    const second = await requestRaw(
      baseUrl,
      {
        path: "/submissions",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(second.status, 409);
    const secondBody = JSON.parse(second.body);
    assert.equal(secondBody.errorCode, "duplicate_submission");
    assert.equal(secondBody.message, "A submission already exists for this paper.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-04 integration expected failure path: save failure returns safe error", async () => {
  const failingRepository = {
    async create() {
      throw new Error("DB_WRITE_FAILED");
    },
    async findById() {
      return null;
    },
    async findDuplicate() {
      return null;
    },
  };

  const { server } = createAppServer({
    store: makeStore(),
    submissionRepository: failingRepository,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const cookie = await loginAndGetCookie(baseUrl);
    const payload = JSON.stringify(validSubmissionPayload());

    const failed = await requestRaw(
      baseUrl,
      {
        path: "/submissions",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(failed.status, 500);
    const body = JSON.parse(failed.body);
    assert.equal(body.errorCode, "save_failure");
    assert.equal(body.message, composeSafeSaveFailureMessage());
    assert.equal(body.message.includes("DB_WRITE_FAILED"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-04 integration authorization failure: unauthenticated access and submit are blocked", async () => {
  const { server } = createAppServer({ store: makeStore() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const getForm = await requestRaw(baseUrl, { path: "/submissions/new" });
    assert.equal(getForm.status, 302);
    assert.equal(getForm.headers.location, "/login.html");

    const payload = JSON.stringify(validSubmissionPayload());
    const create = await requestRaw(
      baseUrl,
      {
        path: "/submissions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );
    assert.equal(create.status, 401);
    const body = JSON.parse(create.body);
    assert.equal(body.errorCode, "session_expired");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
