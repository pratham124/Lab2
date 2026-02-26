const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeEmail, isBlank, isValidEmailFormat } = require("../../src/services/email_utils");
const { validatePassword } = require("../../src/services/password_policy");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");
const { createRegistrationAttemptLogger } = require("../../src/services/registration_attempt_logger");
const { createUserRepository, DuplicateEmailError } = require("../../src/services/user_repository");
const { createRegistrationService } = require("../../src/services/registration_service");
const { findItem } = require("../../src/services/schedule_validation");

test("email_utils normalize/blank/format", () => {
  assert.equal(normalizeEmail("  Test@Example.com  "), "test@example.com");
  assert.equal(isBlank("   "), true);
  assert.equal(isBlank("x"), false);
  assert.equal(isValidEmailFormat("new.user@example.com"), true);
  assert.equal(isValidEmailFormat("invalid-email"), false);
});

test("password_policy validates required, rules, and success", () => {
  assert.deepEqual(validatePassword(""), {
    valid: false,
    error: VALIDATION_MESSAGES.PASSWORD_REQUIRED,
  });
  assert.deepEqual(validatePassword("short7"), {
    valid: false,
    error: VALIDATION_MESSAGES.PASSWORD_RULES,
  });
  assert.deepEqual(validatePassword("abcdefgh"), {
    valid: false,
    error: VALIDATION_MESSAGES.PASSWORD_RULES,
  });
  assert.deepEqual(validatePassword("ValidPassw0rd"), { valid: true, error: null });
});

test("registration_attempt_logger uses store hooks and fallback storage", () => {
  const calls = [];
  const store = {
    recordRegistrationAttempt(attempt) {
      calls.push({ type: "attempt", attempt });
    },
    recordRegistrationFailure(attempt) {
      calls.push({ type: "failure", attempt });
    },
  };

  const loggerWithStore = createRegistrationAttemptLogger({ store });
  loggerWithStore.logAttempt({ id: "1" });
  loggerWithStore.logFailure({ id: "2" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].type, "attempt");
  assert.equal(calls[1].type, "failure");

  const logger = createRegistrationAttemptLogger();
  logger.logAttempt({ id: "3" });
  logger.logFailure({ id: "4" });
  assert.deepEqual(logger.getAttempts().map((a) => a.id), ["3", "4"]);
});

test("user_repository uses store and in-memory fallback", async () => {
  const store = {
    findUserByEmailCanonical(email) {
      return email === "exists@example.com" ? { email } : null;
    },
    createUserAccount(user) {
      return { ...user, stored: true };
    },
  };
  const repoWithStore = createUserRepository({ store });
  assert.equal(await repoWithStore.existsByEmailCanonical("exists@example.com"), true);
  const created = await repoWithStore.create({ email: "new@example.com" });
  assert.equal(created.stored, true);

  const repo = createUserRepository();
  assert.equal(await repo.existsByEmailCanonical("none@example.com"), false);
  await repo.create({ email: "one@example.com" });
  await assert.rejects(() => repo.create({ email: "one@example.com" }), DuplicateEmailError);
});

test("registration_service handles validation, duplicate, success, and system error", async () => {
  const store = {
    users: new Map(),
    attempts: [],
    findUserByEmailCanonical(email) {
      return this.users.get(email) || null;
    },
    createUserAccount(user) {
      if (this.users.has(user.email)) {
        const error = new Error("Email already exists");
        error.code = "DUPLICATE_EMAIL";
        throw error;
      }
      this.users.set(user.email, user);
      return user;
    },
    recordRegistrationAttempt(attempt) {
      this.attempts.push(attempt);
    },
    recordRegistrationFailure(attempt) {
      this.attempts.push(attempt);
    },
  };

  const service = createRegistrationService({
    userRepository: createUserRepository({ store }),
    attemptLogger: createRegistrationAttemptLogger({ store }),
  });

  const validation = await service.register({ email: "", password: "" });
  assert.equal(validation.type, "validation_error");
  assert.equal(validation.fieldErrors.email, VALIDATION_MESSAGES.EMAIL_REQUIRED);

  const success = await service.register({
    email: "success.user@example.com",
    password: "ValidPassw0rd1",
  });
  assert.equal(success.type, "success");
  assert.equal(success.redirect, "/login");

  const duplicate = await service.register({
    email: "SUCCESS.USER@example.com",
    password: "ValidPassw0rd1",
  });
  assert.equal(duplicate.type, "duplicate");
  assert.equal(duplicate.status, 409);

  const errorStore = {
    findUserByEmailCanonical() {
      return null;
    },
    createUserAccount() {
      throw new Error("DB down");
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };
  const errorService = createRegistrationService({
    userRepository: createUserRepository({ store: errorStore }),
    attemptLogger: createRegistrationAttemptLogger({ store: errorStore }),
  });

  const systemError = await errorService.register({
    email: "system.user@example.com",
    password: "ValidPassw0rd1",
  });
  assert.equal(systemError.type, "system_error");
  assert.equal(systemError.status, 500);
});

test("registration_service handles duplicate from repository exception", async () => {
  const store = {
    findUserByEmailCanonical() {
      return null;
    },
    createUserAccount() {
      throw new DuplicateEmailError("Email already exists");
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const service = createRegistrationService({
    userRepository: createUserRepository({ store }),
    attemptLogger: createRegistrationAttemptLogger({ store }),
  });

  const result = await service.register({
    email: "dup.user@example.com",
    password: "ValidPassw0rd1",
  });
  assert.equal(result.type, "duplicate");
  assert.equal(result.status, 409);
});

test("schedule_validation findItem handles undefined inputs", () => {
  assert.equal(findItem(undefined, undefined), null);
});
