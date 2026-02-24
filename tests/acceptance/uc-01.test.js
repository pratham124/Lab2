const test = require("node:test");
const assert = require("node:assert/strict");

const { createRegistrationService } = require("../../src/services/registration_service");
const { createUserRepository } = require("../../src/services/user_repository");
const { createRegistrationAttemptLogger } = require("../../src/services/registration_attempt_logger");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");

function createInMemoryStore() {
  const users = new Map();
  const attempts = [];

  return {
    findUserByEmailCanonical(emailCanonical) {
      return users.get(emailCanonical) || null;
    },
    createUserAccount(userAccount) {
      if (users.has(userAccount.email)) {
        const error = new Error("Email already exists");
        error.code = "DUPLICATE_EMAIL";
        throw error;
      }
      users.set(userAccount.email, userAccount);
      return userAccount;
    },
    recordRegistrationAttempt(attempt) {
      attempts.push(attempt);
    },
    recordRegistrationFailure(attempt) {
      attempts.push(attempt);
    },
    getUsers() {
      return Array.from(users.values());
    },
    getAttempts() {
      return attempts.slice();
    },
  };
}

function buildService(store) {
  const userRepository = createUserRepository({ store });
  const attemptLogger = createRegistrationAttemptLogger({ store });
  return { userRepository, attemptLogger, service: createRegistrationService({ userRepository, attemptLogger }) };
}

test("AT-UC01-01 Successful Registration", async () => {
  const store = createInMemoryStore();
  const { service, userRepository } = buildService(store);

  const result = await service.register({
    email: "new.user@example.com",
    password: "ValidPassw0rd1",
  });

  assert.equal(result.type, "success");
  assert.equal(result.status, 302);
  assert.equal(result.redirect, "/login");
  assert.equal(await userRepository.existsByEmailCanonical("new.user@example.com"), true);
});

test("AT-UC01-02 Reject Duplicate Email", async () => {
  const store = createInMemoryStore();
  const { service, userRepository } = buildService(store);

  const first = await service.register({
    email: "existing.user@example.com",
    password: "ValidPassw0rd1",
  });
  assert.equal(first.type, "success");

  const second = await service.register({
    email: "EXISTING.USER@example.com",
    password: "ValidPassw0rd1",
  });

  assert.equal(second.type, "duplicate");
  assert.equal(second.status, 409);
  assert.equal(second.error, VALIDATION_MESSAGES.EMAIL_IN_USE);
  assert.equal(await userRepository.existsByEmailCanonical("existing.user@example.com"), true);
  assert.equal(store.getUsers().length, 1);
});

test("AT-UC01-03 Reject Invalid Email Format", async () => {
  const store = createInMemoryStore();
  const { service } = buildService(store);

  const result = await service.register({
    email: "invalid-email-format",
    password: "ValidPassw0rd1",
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
  assert.equal(result.fieldErrors.email, VALIDATION_MESSAGES.EMAIL_INVALID);
});

test("AT-UC01-04 Reject Non-Compliant Password", async () => {
  const store = createInMemoryStore();
  const { service } = buildService(store);

  const result = await service.register({
    email: "new2.user@example.com",
    password: "123",
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
  assert.equal(result.fieldErrors.password, VALIDATION_MESSAGES.PASSWORD_RULES);
});

test("AT-UC01-05 Handle Database/System Failure Gracefully", async () => {
  const store = createInMemoryStore();
  store.createUserAccount = () => {
    throw new Error("DB down");
  };
  const { service } = buildService(store);

  const result = await service.register({
    email: "new3.user@example.com",
    password: "ValidPassw0rd1",
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
  assert.equal(result.error, VALIDATION_MESSAGES.SYSTEM_ERROR);
  assert.equal(store.getUsers().length, 0);
  assert.equal(store.getAttempts().slice(-1)[0].outcome, "system_error");
});

test("AT-UC01-06 Prevent Double-Submission Creating Duplicate Accounts", async () => {
  const store = createInMemoryStore();
  const { service } = buildService(store);

  const first = await service.register({
    email: "new4.user@example.com",
    password: "ValidPassw0rd1",
  });
  const second = await service.register({
    email: "new4.user@example.com",
    password: "ValidPassw0rd1",
  });

  assert.equal(first.type, "success");
  assert.equal(second.type, "duplicate");
  assert.equal(store.getUsers().length, 1);
});

test("AT-UC01-07 Required Fields Validation", async () => {
  const store = createInMemoryStore();
  const { service } = buildService(store);

  const result = await service.register({
    email: "",
    password: "",
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.status, 400);
  assert.equal(result.fieldErrors.email, VALIDATION_MESSAGES.EMAIL_REQUIRED);
  assert.equal(result.fieldErrors.password, VALIDATION_MESSAGES.PASSWORD_REQUIRED);
});

test("AT-UC01-08 Whitespace Handling in Email Input", async () => {
  const store = createInMemoryStore();
  const { service, userRepository } = buildService(store);

  const result = await service.register({
    email: "  new5.user@example.com  ",
    password: "ValidPassw0rd1",
  });

  assert.equal(result.type, "success");
  assert.equal(await userRepository.existsByEmailCanonical("new5.user@example.com"), true);
});
