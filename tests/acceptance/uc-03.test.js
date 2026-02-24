const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createUserStore } = require("../../src/services/user-store");
const { createAuthService } = require("../../src/services/auth-service");
const { createSessionService } = require("../../src/services/session-service");
const { createAuthController } = require("../../src/controllers/auth-controller");
const { createAccountService } = require("../../src/services/account_service");
const { createAccountController } = require("../../src/controllers/account_controller");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createFixtureUser({ email = "user1@example.com", password = "OldPassw0rd!" } = {}) {
  const salt = "uc03-fixed-salt";
  return {
    id: "user_1",
    email,
    password_hash: hashPassword(password, salt),
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

function readUsers(usersPath) {
  return JSON.parse(fs.readFileSync(usersPath, "utf8"));
}

function createAcceptanceHarness() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc03-acceptance-"));
  const usersPath = path.join(tempDir, "users.json");
  const authLogPath = path.join(tempDir, "auth.log");
  const accountLogPath = path.join(tempDir, "account.log");
  fs.writeFileSync(usersPath, JSON.stringify([createFixtureUser()], null, 2), "utf8");
  fs.writeFileSync(authLogPath, "", "utf8");
  fs.writeFileSync(accountLogPath, "", "utf8");

  const userStore = createUserStore({ filePath: usersPath });
  const sessionService = createSessionService();
  const authService = createAuthService({
    userStore,
    logFilePath: authLogPath,
  });
  const authController = createAuthController({ authService, sessionService });
  const accountService = createAccountService({
    userStore,
    logFilePath: accountLogPath,
  });
  const accountController = createAccountController({
    accountService,
    sessionService,
  });

  return {
    usersPath,
    accountLogPath,
    userStore,
    authController,
    accountController,
    sessionService,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function loginAndGetSessionId(harness, { email = "user1@example.com", password = "OldPassw0rd!" } = {}) {
  const login = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email, password },
  });
  assert.equal(login.status, 302);
  const sessionId = parseSessionCookie(login.headers["Set-Cookie"]);
  assert.equal(Boolean(sessionId), true);
  return sessionId;
}

test("AT-UC03-01 Successful Password Change (Main Success Scenario)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const before = readUsers(harness.usersPath)[0];
  const sessionId = await loginAndGetSessionId(harness);

  const settingsPage = await harness.accountController.handleGetSettings({
    headers: { cookie: `cms_session=${sessionId}` },
  });
  assert.equal(settingsPage.status, 200);
  assert.equal(settingsPage.body.includes("Change Password"), true);

  const change = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    },
  });

  assert.equal(change.status, 200);
  assert.equal(change.body.includes(VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS), true);

  const after = readUsers(harness.usersPath)[0];
  assert.notEqual(after.password_hash, before.password_hash);

  const sessionCheck = await harness.authController.handleGetSession({
    headers: { cookie: `cms_session=${sessionId}` },
  });
  assert.equal(sessionCheck.status, 200);
});

test("AT-UC03-02 Reject Incorrect Current Password (Extension 4a)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const before = readUsers(harness.usersPath)[0];
  const sessionId = await loginAndGetSessionId(harness);

  for (let index = 0; index < 3; index += 1) {
    const denied = await harness.accountController.handlePostChangePassword({
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: `cms_session=${sessionId}`,
      },
      body: {
        currentPassword: "WrongOldPass!",
        newPassword: "NewPassw0rd!",
      },
    });

    assert.equal(denied.status, 401);
    assert.equal(denied.body.includes(VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID), true);
  }

  const stillActive = await harness.authController.handleGetSession({
    headers: { cookie: `cms_session=${sessionId}` },
  });
  assert.equal(stillActive.status, 200);

  const after = readUsers(harness.usersPath)[0];
  assert.equal(after.password_hash, before.password_hash);
});

test("AT-UC03-03 Reject Non-Compliant New Password (Extension 5a)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const before = readUsers(harness.usersPath)[0];
  const sessionId = await loginAndGetSessionId(harness);

  const denied = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "123",
    },
  });

  assert.equal(denied.status, 400);
  assert.equal(denied.body.includes(VALIDATION_MESSAGES.PASSWORD_RULES), true);

  const after = readUsers(harness.usersPath)[0];
  assert.equal(after.password_hash, before.password_hash);
});

test("AT-UC03-04 Handle System/Database Failure During Update (Extension 6a)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const before = readUsers(harness.usersPath)[0];
  const originalUpdatePassword = harness.userStore.updatePassword;
  harness.userStore.updatePassword = async () => {
    throw new Error("DB_WRITE_FAILED");
  };

  const sessionId = await loginAndGetSessionId(harness);
  const failed = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    },
  });

  assert.equal(failed.status, 500);
  assert.equal(failed.body.includes(VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE), true);
  assert.equal(failed.body.includes("DB_WRITE_FAILED"), false);

  const after = readUsers(harness.usersPath)[0];
  assert.equal(after.password_hash, before.password_hash);

  const logEntries = readJsonLines(harness.accountLogPath);
  assert.equal(logEntries.some((entry) => entry.outcome === "system_error"), true);
  assert.equal(
    logEntries.some((entry) => entry.reason === "password_update_failure"),
    true
  );

  harness.userStore.updatePassword = originalUpdatePassword;
});

test("AT-UC03-05 New Password Equals Current Password (Policy Check)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const before = readUsers(harness.usersPath)[0];
  const sessionId = await loginAndGetSessionId(harness);

  const denied = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "OldPassw0rd!",
    },
  });

  assert.equal(denied.status, 400);
  assert.equal(denied.body.includes(VALIDATION_MESSAGES.NEW_PASSWORD_MUST_DIFFER), true);

  const after = readUsers(harness.usersPath)[0];
  assert.equal(after.password_hash, before.password_hash);
});

test("AT-UC03-06 Verify Login Works With New Password After Change", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const sessionId = await loginAndGetSessionId(harness);
  const changed = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    },
  });
  assert.equal(changed.status, 200);

  // Simulate ended session by attempting fresh logins without existing session cookie.
  const oldLogin = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "OldPassw0rd!" },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "NewPassw0rd!" },
  });
  assert.equal(newLogin.status, 302);
  assert.equal(newLogin.headers.Location, "/dashboard.html");
});

test("AT-UC03-07 Required Fields Validation (Blank Inputs)", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const before = readUsers(harness.usersPath)[0];
  const sessionId = await loginAndGetSessionId(harness);

  const denied = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "",
      newPassword: "",
    },
  });

  assert.equal(denied.status, 400);
  assert.equal(denied.body.includes(VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED), true);
  assert.equal(denied.body.includes(VALIDATION_MESSAGES.NEW_PASSWORD_REQUIRED), true);

  const after = readUsers(harness.usersPath)[0];
  assert.equal(after.password_hash, before.password_hash);
});

test("AT-UC03-08 Prevent Double-Submission Updating Password Twice", async (t) => {
  const harness = createAcceptanceHarness();
  t.after(() => harness.cleanup());

  const sessionId = await loginAndGetSessionId(harness);
  const first = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.includes(VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS), true);

  const second = await harness.accountController.handlePostChangePassword({
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie: `cms_session=${sessionId}`,
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    },
  });

  assert.equal(second.status, 401);
  assert.equal(second.body.includes(VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID), true);
  assert.equal(second.body.includes("Error:"), false);
  assert.equal(second.body.includes("stack"), false);

  const oldLogin = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "OldPassw0rd!" },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await harness.authController.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "NewPassw0rd!" },
  });
  assert.equal(newLogin.status, 302);
});
