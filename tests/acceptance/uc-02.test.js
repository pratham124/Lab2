const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createUserStore } = require("../../src/services/user-store");
const { createAuthService, AUTH_MESSAGES } = require("../../src/services/auth-service");
const { createSessionService } = require("../../src/services/session-service");
const { createAuthController } = require("../../src/controllers/auth-controller");

function createFixtureUser({ email = "user1@example.com", password = "ValidPassw0rd!" } = {}) {
  const salt = "uc02-fixed-salt";
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return {
    id: "user_1",
    email,
    password_hash: passwordHash,
    salt,
    status: "active",
    created_at: "2026-02-24T00:00:00.000Z",
  };
}

function parseSessionCookie(setCookieHeader) {
  const match = /cms_session=([^;]+)/.exec(setCookieHeader || "");
  return match ? match[1] : null;
}

function readJsonLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return [];
  }
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function createAcceptanceHarness({
  users = [createFixtureUser()],
  isVerificationAvailable = () => true,
} = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc02-acceptance-"));
  const usersPath = path.join(tempDir, "users.json");
  const logPath = path.join(tempDir, "auth.log");
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  fs.writeFileSync(logPath, "", "utf8");

  const userStore = createUserStore({ filePath: usersPath });
  const authService = createAuthService({
    userStore,
    logFilePath: logPath,
    isVerificationAvailable,
  });
  const sessionService = createSessionService();
  const authController = createAuthController({ authService, sessionService });

  return {
    authService,
    authController,
    logPath,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test("AT-UC02-01 Successful Login and Session Persistence", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const loginPage = await harness.authController.handleGetLogin({ headers: {} });
  assert.equal(loginPage.status, 200);
  assert.equal(loginPage.headers["Content-Type"], "text/html");

  const login = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "ValidPassw0rd!" },
  });

  assert.equal(login.status, 302);
  assert.equal(login.headers.Location, "/dashboard.html");
  assert.equal(typeof login.headers["Set-Cookie"], "string");

  const sessionId = parseSessionCookie(login.headers["Set-Cookie"]);
  assert.equal(Boolean(sessionId), true);

  const dashboard = await harness.authController.handleGetDashboard({
    headers: { cookie: `cms_session=${sessionId}` },
  });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers["Content-Type"], "text/html");
  assert.equal(dashboard.body.includes("Dashboard"), true);

  const sessionCheck = await harness.authController.handleGetSession({
    headers: { cookie: `cms_session=${sessionId}` },
  });
  assert.equal(sessionCheck.status, 200);
  const payload = JSON.parse(sessionCheck.body);
  assert.equal(payload.authenticated, true);
  assert.equal(payload.user_id, "user_1");
});

test("AT-UC02-02 Generic Error for Unknown Email", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const response = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "unknown@example.com", password: "AnyPassword1!" },
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.includes(AUTH_MESSAGES.INVALID_CREDENTIALS), true);
  assert.equal(response.headers["Set-Cookie"], undefined);

  const sessionCheck = await harness.authController.handleGetSession({ headers: {} });
  assert.equal(sessionCheck.status, 401);
});

test("AT-UC02-03 Generic Error for Incorrect Password", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const response = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "WrongPass!" },
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.includes(AUTH_MESSAGES.INVALID_CREDENTIALS), true);
  assert.equal(response.headers["Set-Cookie"], undefined);

  const sessionCheck = await harness.authController.handleGetSession({ headers: {} });
  assert.equal(sessionCheck.status, 401);
});

test("AT-UC02-04 Required Field Validation", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const response = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "", password: "" },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.includes(AUTH_MESSAGES.EMAIL_REQUIRED), true);
  assert.equal(response.headers["Set-Cookie"], undefined);
  assert.equal(harness.authService.getAttempts().at(-1).outcome, "missing_fields");
});

test("AT-UC02-05 Verification Failure/System Outage", async (t) => {
  const harness = createAcceptanceHarness({
    isVerificationAvailable: () => false,
  });
  t.after(() => harness.cleanup());

  const response = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "ValidPassw0rd!" },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.includes(AUTH_MESSAGES.SYSTEM_FAILURE), true);
  assert.equal(response.headers["Set-Cookie"], undefined);

  const logEntries = readJsonLines(harness.logPath);
  assert.equal(logEntries.some((entry) => entry.outcome === "system_error"), true);
  assert.equal(
    logEntries.some((entry) => entry.reason === "verification_failure"),
    true
  );
});

test("AT-UC02-06 Prevent Dashboard Access After Failed Login", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const failedLogin = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "WrongPass!" },
  });
  assert.equal(failedLogin.status, 401);
  assert.equal(failedLogin.headers["Set-Cookie"], undefined);

  const dashboard = await harness.authController.handleGetDashboard({ headers: {} });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.Location, "/login.html");
});

test("AT-UC02-07 Redirect Authenticated Users Away from Login", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const login = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "ValidPassw0rd!" },
  });
  const sessionId = parseSessionCookie(login.headers["Set-Cookie"]);
  assert.equal(Boolean(sessionId), true);

  const getLoginWhileAuthed = await harness.authController.handleGetLogin({
    headers: { cookie: `cms_session=${sessionId}` },
  });
  assert.equal(getLoginWhileAuthed.status, 302);
  assert.equal(getLoginWhileAuthed.headers.Location, "/dashboard.html");
  assert.equal(getLoginWhileAuthed.body, "");
});

test("AT-UC02-08 Email Normalization/Whitespace Handling", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const response = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "  user1@example.com  ", password: "ValidPassw0rd!" },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/dashboard.html");
  assert.equal(typeof response.headers["Set-Cookie"], "string");
});

test("AT-UC02-09 Repeated Failed Attempts Recorded (No Lockout)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  for (let index = 0; index < 3; index += 1) {
    const failed = await harness.authController.handlePostLogin({
      headers: { accept: "application/json" },
      body: { email: "user1@example.com", password: "WrongPass!" },
    });
    assert.equal(failed.status, 401);
    assert.equal(failed.headers["Set-Cookie"], undefined);
  }

  const logEntries = readJsonLines(harness.logPath).filter(
    (entry) => entry.outcome === "invalid_credentials"
  );
  assert.equal(logEntries.length, 3);
  assert.deepEqual(
    logEntries.map((entry) => entry.failed_attempt_count),
    [1, 2, 3]
  );

  const success = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "ValidPassw0rd!" },
  });
  assert.equal(success.status, 302);
  assert.equal(success.headers.Location, "/dashboard.html");
});
