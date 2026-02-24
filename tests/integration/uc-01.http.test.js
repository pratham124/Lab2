const test = require("node:test");
const assert = require("node:assert/strict");

const http = require("http");
const { createAppServer } = require("../../src/server");

async function withServer(handler) {
  const { server } = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await handler(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postJson(baseUrl, path, body) {
  const payload = JSON.stringify(body);
  const url = new URL(`${baseUrl}${path}`);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
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
    req.write(payload);
    req.end();
  });
}

test("UC-01 endpoint happy path returns redirect", async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, "/register", {
      email: "new.user@example.com",
      password: "ValidPassw0rd1",
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.location, "/login");
  });
});

test("UC-01 endpoint invalid email returns validation error", async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, "/register", {
      email: "invalid-email",
      password: "ValidPassw0rd1",
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.status, 400);
    assert.equal(payload.error, "Validation error");
    assert.equal(payload.fieldErrors.email, "Email must be a valid address");
  });
});

test("UC-01 endpoint required fields returns validation errors", async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, "/register", {
      email: "",
      password: "",
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.status, 400);
    assert.equal(payload.fieldErrors.email, "Email is required");
    assert.equal(payload.fieldErrors.password, "Password is required");
  });
});

test("UC-01 endpoint duplicate email returns conflict", async () => {
  await withServer(async (baseUrl) => {
    const first = await postJson(baseUrl, "/register", {
      email: "existing.user@example.com",
      password: "ValidPassw0rd1",
    });
    assert.equal(first.status, 302);

    const second = await postJson(baseUrl, "/register", {
      email: "EXISTING.USER@example.com",
      password: "ValidPassw0rd1",
    });
    const payload = JSON.parse(second.body);

    assert.equal(second.status, 409);
    assert.equal(payload.error, "Email is already in use");
    assert.equal(payload.fieldErrors.email, "Email is already in use");
  });
});

test("UC-01 endpoint system failure returns safe error", async () => {
  const failingStore = {
    findUserByEmailCanonical() {
      return null;
    },
    createUserAccount() {
      throw new Error("DB down");
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const { server } = createAppServer({ store: failingStore });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await postJson(baseUrl, "/register", {
      email: "new3.user@example.com",
      password: "ValidPassw0rd1",
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.status, 500);
    assert.equal(payload.error, "Registration failed. Please try again.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
