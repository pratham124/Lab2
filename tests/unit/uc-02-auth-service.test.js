const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createAuthService, normalizeEmail, AUTH_MESSAGES } = require("../../src/services/auth-service");

function createTempLogFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uc02-auth-service-"));
  const logPath = path.join(dir, "auth.log");
  fs.writeFileSync(logPath, "", "utf8");
  return {
    logPath,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function makeUser({ password = "ValidPassw0rd!", status = "active" } = {}) {
  const salt = "fixed-salt";
  return {
    id: "user_1",
    email: "user1@example.com",
    salt,
    status,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };
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

test("normalizeEmail trims and lowercases input", () => {
  assert.equal(normalizeEmail("  User1@Example.COM  "), "user1@example.com");
  assert.equal(normalizeEmail(""), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("authenticate handles missing fields branches", async (t) => {
  const tmp = createTempLogFile();
  t.after(() => tmp.cleanup());

  const service = createAuthService({
    userStore: { async findByEmail() { return null; } },
    logFilePath: tmp.logPath,
  });

  const missingEmail = await service.authenticate({ email: "", password: "x" });
  assert.equal(missingEmail.type, "missing_fields");
  assert.equal(missingEmail.status, 400);
  assert.equal(missingEmail.message, AUTH_MESSAGES.EMAIL_REQUIRED);

  const missingPassword = await service.authenticate({ email: "user1@example.com", password: "" });
  assert.equal(missingPassword.type, "missing_fields");
  assert.equal(missingPassword.status, 400);
  assert.equal(missingPassword.message, AUTH_MESSAGES.PASSWORD_REQUIRED);
});

test("authenticate handles unknown and inactive accounts with generic invalid credentials", async (t) => {
  const tmp = createTempLogFile();
  t.after(() => tmp.cleanup());

  const activeUser = makeUser();
  const inactiveUser = { ...activeUser, status: "disabled", email: "disabled@example.com" };
  const users = new Map([
    [activeUser.email, activeUser],
    [inactiveUser.email, inactiveUser],
  ]);

  const service = createAuthService({
    userStore: {
      async findByEmail(email) {
        return users.get(email) || null;
      },
    },
    logFilePath: tmp.logPath,
  });

  const unknown = await service.authenticate({ email: "unknown@example.com", password: "x" });
  assert.equal(unknown.type, "invalid_credentials");
  assert.equal(unknown.message, AUTH_MESSAGES.INVALID_CREDENTIALS);

  const inactive = await service.authenticate({ email: "disabled@example.com", password: "x" });
  assert.equal(inactive.type, "invalid_credentials");
  assert.equal(inactive.message, AUTH_MESSAGES.INVALID_CREDENTIALS);
});

test("authenticate handles wrong password, secure compare mismatch-length branch, and success", async (t) => {
  const tmp = createTempLogFile();
  t.after(() => tmp.cleanup());

  const validUser = makeUser();
  const badHashUser = { ...validUser, email: "badhash@example.com", password_hash: "00" };
  const users = new Map([
    [validUser.email, validUser],
    [badHashUser.email, badHashUser],
  ]);

  const service = createAuthService({
    userStore: {
      async findByEmail(email) {
        return users.get(email) || null;
      },
    },
    logFilePath: tmp.logPath,
  });

  const wrongPassword = await service.authenticate({
    email: validUser.email,
    password: "WrongPass!",
  });
  assert.equal(wrongPassword.type, "invalid_credentials");

  const mismatchLength = await service.authenticate({
    email: badHashUser.email,
    password: "ValidPassw0rd!",
  });
  assert.equal(mismatchLength.type, "invalid_credentials");

  const success = await service.authenticate({
    email: validUser.email,
    password: "ValidPassw0rd!",
  });
  assert.equal(success.type, "success");
  assert.equal(success.user.id, "user_1");

  const attemptsCopy = service.getAttempts();
  attemptsCopy.push({ fake: true });
  assert.equal(service.getAttempts().some((entry) => entry.fake), false);
});

test("authenticate handles verification unavailable and service-down environment branches", async (t) => {
  const tmp = createTempLogFile();
  t.after(() => tmp.cleanup());

  const serviceByCallback = createAuthService({
    userStore: { async findByEmail() { return makeUser(); } },
    logFilePath: tmp.logPath,
    isVerificationAvailable: () => false,
  });

  const callbackOutage = await serviceByCallback.authenticate({
    email: "user1@example.com",
    password: "ValidPassw0rd!",
  });
  assert.equal(callbackOutage.type, "system_error");
  assert.equal(callbackOutage.message, AUTH_MESSAGES.SYSTEM_FAILURE);

  const original = process.env.AUTH_SERVICE_DOWN;
  process.env.AUTH_SERVICE_DOWN = "1";
  const serviceByEnv = createAuthService({
    userStore: { async findByEmail() { return makeUser(); } },
    logFilePath: tmp.logPath,
  });
  const envOutage = await serviceByEnv.authenticate({
    email: "user1@example.com",
    password: "ValidPassw0rd!",
  });
  if (original === undefined) {
    delete process.env.AUTH_SERVICE_DOWN;
  } else {
    process.env.AUTH_SERVICE_DOWN = original;
  }

  assert.equal(envOutage.type, "system_error");
  const logs = readJsonLines(tmp.logPath);
  assert.equal(logs.some((entry) => entry.error_code === "AUTH_SERVICE_UNAVAILABLE"), true);
});

test("authenticate catches user store errors and logs UNKNOWN_ERROR when message is empty", async (t) => {
  const tmp = createTempLogFile();
  t.after(() => tmp.cleanup());

  const service = createAuthService({
    userStore: {
      async findByEmail() {
        const err = new Error("");
        throw err;
      },
    },
    logFilePath: tmp.logPath,
  });

  const result = await service.authenticate({
    email: "user1@example.com",
    password: "ValidPassw0rd!",
  });
  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);

  const logs = readJsonLines(tmp.logPath);
  assert.equal(logs.some((entry) => entry.error_code === "UNKNOWN_ERROR"), true);
});

