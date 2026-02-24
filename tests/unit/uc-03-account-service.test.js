const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAccountService } = require("../../src/services/account_service");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

test("account_service changes password successfully", async () => {
  const user = {
    id: "user_1",
    email: "user1@example.com",
    salt: "seed-salt",
    password_hash: hash("OldPassw0rd!", "seed-salt"),
  };

  const userStore = {
    async findById(userId) {
      return userId === user.id ? user : null;
    },
    async updatePassword(userId, updates) {
      assert.equal(userId, user.id);
      Object.assign(user, updates);
      return user;
    },
  };

  const service = createAccountService({ userStore });
  const result = await service.changePassword({
    userId: user.id,
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.equal(result.type, "success");
  assert.equal(result.message, VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS);
  assert.notEqual(user.password_hash, hash("OldPassw0rd!", "seed-salt"));
});

test("account_service rejects incorrect current password", async () => {
  const user = {
    id: "user_2",
    email: "user2@example.com",
    salt: "seed-salt-2",
    password_hash: hash("OldPassw0rd!", "seed-salt-2"),
  };

  const service = createAccountService({
    userStore: {
      async findById() {
        return user;
      },
      async updatePassword() {
        throw new Error("must not run update");
      },
    },
  });

  const result = await service.changePassword({
    userId: user.id,
    currentPassword: "WrongPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.equal(result.type, "invalid_current_password");
  assert.equal(result.status, 401);
  assert.equal(result.fieldErrors.currentPassword, VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID);
});

test("account_service rejects new password equal to current", async () => {
  const service = createAccountService({
    userStore: {
      async findById() {
        return null;
      },
      async updatePassword() {
        return null;
      },
    },
  });

  const result = await service.changePassword({
    userId: "user_3",
    currentPassword: "OldPassw0rd!",
    newPassword: "OldPassw0rd!",
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
  assert.equal(result.fieldErrors.newPassword, VALIDATION_MESSAGES.NEW_PASSWORD_MUST_DIFFER);
});

test("account_service returns system_error on write failure", async () => {
  const user = {
    id: "user_4",
    email: "user4@example.com",
    salt: "seed-salt-4",
    password_hash: hash("OldPassw0rd!", "seed-salt-4"),
  };

  const service = createAccountService({
    userStore: {
      async findById() {
        return user;
      },
      async updatePassword() {
        throw new Error("DB down");
      },
    },
  });

  const result = await service.changePassword({
    userId: user.id,
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
  assert.equal(result.message, VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE);
});

test("account_service returns validation_error for missing fields", async () => {
  const service = createAccountService({
    userStore: {
      async findById() {
        return null;
      },
      async updatePassword() {
        return null;
      },
    },
  });

  const result = await service.changePassword({
    userId: "user_5",
    currentPassword: "",
    newPassword: "",
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
  assert.equal(result.fieldErrors.currentPassword, VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED);
  assert.equal(result.fieldErrors.newPassword, VALIDATION_MESSAGES.NEW_PASSWORD_REQUIRED);
});

test("account_service returns system_error when userStore is unavailable", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc03-account-service-"));
  const logPath = path.join(tempDir, "account.log");
  fs.writeFileSync(logPath, "", "utf8");
  try {
    const service = createAccountService({
      userStore: null,
      logFilePath: logPath,
    });

    const result = await service.changePassword({
      userId: "user_6",
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    });

    assert.equal(result.type, "system_error");
    const logEntries = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(logEntries.length, 1);
    assert.equal(logEntries[0].error_code, "USER_STORE_UNAVAILABLE");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("account_service returns system_error when user is missing credential fields", async () => {
  const service = createAccountService({
    userStore: {
      async findById() {
        return { id: "user_7", salt: "", password_hash: "" };
      },
      async updatePassword() {
        return null;
      },
    },
  });

  const result = await service.changePassword({
    userId: "user_7",
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
});

test("account_service returns system_error when updatePassword hook is missing", async () => {
  const user = {
    id: "user_8",
    email: "user8@example.com",
    salt: "seed-salt-8",
    password_hash: hash("OldPassw0rd!", "seed-salt-8"),
  };

  const service = createAccountService({
    userStore: {
      async findById() {
        return user;
      },
    },
  });

  const result = await service.changePassword({
    userId: user.id,
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
});

test("account_service returns system_error when password update returns null", async () => {
  const user = {
    id: "user_9",
    email: "user9@example.com",
    salt: "seed-salt-9",
    password_hash: hash("OldPassw0rd!", "seed-salt-9"),
  };

  const service = createAccountService({
    userStore: {
      async findById() {
        return user;
      },
      async updatePassword() {
        return null;
      },
    },
  });

  const result = await service.changePassword({
    userId: user.id,
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
});

test("account_service test helpers cover secureCompare length mismatch and hash helper", () => {
  const helpers = require("../../src/services/account_service").__test;
  const hashBuffer = helpers.hashPassword("OldPassw0rd!", "seed");
  assert.equal(Buffer.isBuffer(hashBuffer), true);
  assert.equal(helpers.secureCompareHex("abcd", "ab"), false);
});

test("account_service secureCompare helper covers undefined hex inputs", () => {
  const helpers = require("../../src/services/account_service").__test;
  assert.equal(helpers.secureCompareHex(undefined, undefined), true);
});

test("account_service logging failure branch is swallowed safely", async () => {
  const originalAppend = fs.appendFileSync;
  fs.appendFileSync = () => {
    throw new Error("LOG_WRITE_FAILED");
  };

  try {
    const service = createAccountService({
      userStore: null,
    });

    const result = await service.changePassword({
      userId: "user_log_fail",
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    });

    assert.equal(result.type, "system_error");
    assert.equal(result.status, 500);
  } finally {
    fs.appendFileSync = originalAppend;
  }
});

test("account_service logs null user_id and UNKNOWN_ERROR when thrown message is empty", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc03-account-service-unknown-error-"));
  const logPath = path.join(tempDir, "account.log");
  fs.writeFileSync(logPath, "", "utf8");

  try {
    const service = createAccountService({
      logFilePath: logPath,
      userStore: {
        async findById() {
          throw new Error("");
        },
        async updatePassword() {
          return null;
        },
      },
    });

    const result = await service.changePassword({
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    });

    assert.equal(result.type, "system_error");
    const logEntries = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(logEntries.length, 1);
    assert.equal(logEntries[0].user_id, null);
    assert.equal(logEntries[0].outcome, "system_error");
    assert.equal(logEntries[0].reason, "password_update_failure");
    assert.equal(logEntries[0].error_code, "UNKNOWN_ERROR");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
