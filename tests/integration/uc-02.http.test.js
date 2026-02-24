const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const { createAppServer } = require("../../src/server");
const { createUserStore } = require("../../src/services/user-store");
const { createSessionService } = require("../../src/services/session-service");
const { createAuthService } = require("../../src/services/auth-service");
const { createAuthController } = require("../../src/controllers/auth-controller");

function createFixtureUser({ email = "user1@example.com", password = "ValidPassw0rd!" } = {}) {
  const salt = "uc02-http-fixed-salt";
  return {
    id: "user_1",
    email,
    salt,
    status: "active",
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
    created_at: "2026-02-24T00:00:00.000Z",
  };
}

function createHarness({ users = [createFixtureUser()], isVerificationAvailable } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uc02-http-"));
  const usersPath = path.join(dir, "users.json");
  const logPath = path.join(dir, "auth.log");
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf8");
  fs.writeFileSync(logPath, "", "utf8");

  const userStore = createUserStore({ filePath: usersPath });
  const sessionService = createSessionService();
  const authService = createAuthService({
    userStore,
    logFilePath: logPath,
    isVerificationAvailable,
  });
  const authController = createAuthController({ authService, sessionService });
  const { server } = createAppServer({ authController });

  return {
    dir,
    logPath,
    server,
    async start() {
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function request(baseUrl, { method = "GET", pathName, headers = {}, body } = {}) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: pathName,
        method,
        headers,
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

function extractSessionCookie(setCookieHeader) {
  const combined = Array.isArray(setCookieHeader)
    ? setCookieHeader.join("; ")
    : String(setCookieHeader || "");
  const match = /cms_session=([^;]+)/.exec(combined);
  return match ? match[1] : null;
}

test("UC-02 happy path: login success creates session and grants dashboard/session access", async () => {
  const harness = createHarness();
  const baseUrl = await harness.start();
  try {
    const form = new URLSearchParams({
      email: "user1@example.com",
      password: "ValidPassw0rd!",
    }).toString();

    const login = await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
      body: form,
    });
    assert.equal(login.status, 302);
    assert.equal(login.headers.location, "/dashboard.html");
    const sessionId = extractSessionCookie(login.headers["set-cookie"]);
    assert.equal(Boolean(sessionId), true);

    const dashboard = await request(baseUrl, {
      pathName: "/dashboard.html",
      headers: { Cookie: `cms_session=${sessionId}` },
    });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.includes("Dashboard"), true);

    const session = await request(baseUrl, {
      pathName: "/session",
      headers: { Cookie: `cms_session=${sessionId}` },
    });
    assert.equal(session.status, 200);
    assert.equal(JSON.parse(session.body).authenticated, true);
  } finally {
    await harness.stop();
  }
});

test("UC-02 failure path: unknown email returns generic invalid credentials and no session", async () => {
  const harness = createHarness();
  const baseUrl = await harness.start();
  try {
    const form = new URLSearchParams({
      email: "unknown@example.com",
      password: "AnyPassword1!",
    }).toString();

    const login = await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
      body: form,
    });
    assert.equal(login.status, 401);
    assert.equal(login.body.includes("Invalid email or password."), true);
    assert.equal(login.headers["set-cookie"], undefined);
  } finally {
    await harness.stop();
  }
});

test("UC-02 failure path: incorrect password returns same generic invalid credentials message", async () => {
  const harness = createHarness();
  const baseUrl = await harness.start();
  try {
    const form = new URLSearchParams({
      email: "user1@example.com",
      password: "WrongPass!",
    }).toString();

    const login = await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
      body: form,
    });
    assert.equal(login.status, 401);
    assert.equal(login.body.includes("Invalid email or password."), true);
    assert.equal(login.headers["set-cookie"], undefined);
  } finally {
    await harness.stop();
  }
});

test("UC-02 invalid input path: missing required fields returns 400 and required-field message", async () => {
  const harness = createHarness();
  const baseUrl = await harness.start();
  try {
    const form = new URLSearchParams({
      email: "",
      password: "",
    }).toString();

    const login = await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
      body: form,
    });
    assert.equal(login.status, 400);
    assert.equal(login.body.includes("Email is required."), true);
    assert.equal(login.headers["set-cookie"], undefined);
  } finally {
    await harness.stop();
  }
});

test("UC-02 expected failure path: verification outage returns safe 500 and logs system_error", async () => {
  const harness = createHarness({
    isVerificationAvailable: () => false,
  });
  const baseUrl = await harness.start();
  try {
    const form = new URLSearchParams({
      email: "user1@example.com",
      password: "ValidPassw0rd!",
    }).toString();

    const login = await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
      body: form,
    });
    assert.equal(login.status, 500);
    assert.equal(login.body.includes("Login failed. Please try again."), true);
    assert.equal(login.headers["set-cookie"], undefined);

    const logLines = fs
      .readFileSync(harness.logPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(logLines.some((entry) => entry.outcome === "system_error"), true);
  } finally {
    await harness.stop();
  }
});

test("UC-02 access-control path: failed login does not permit dashboard and active session redirects from login page", async () => {
  const harness = createHarness();
  const baseUrl = await harness.start();
  try {
    const failedForm = new URLSearchParams({
      email: "user1@example.com",
      password: "WrongPass!",
    }).toString();
    await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(failedForm),
      },
      body: failedForm,
    });

    const protectedDashboard = await request(baseUrl, {
      pathName: "/dashboard.html",
    });
    assert.equal(protectedDashboard.status, 302);
    assert.equal(protectedDashboard.headers.location, "/login.html");

    const successForm = new URLSearchParams({
      email: "user1@example.com",
      password: "ValidPassw0rd!",
    }).toString();
    const successLogin = await request(baseUrl, {
      method: "POST",
      pathName: "/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(successForm),
      },
      body: successForm,
    });
    const sessionId = extractSessionCookie(successLogin.headers["set-cookie"]);

    const loginPageWhileAuthed = await request(baseUrl, {
      pathName: "/login.html",
      headers: { Cookie: `cms_session=${sessionId}` },
    });
    assert.equal(loginPageWhileAuthed.status, 302);
    assert.equal(loginPageWhileAuthed.headers.location, "/dashboard.html");
  } finally {
    await harness.stop();
  }
});

