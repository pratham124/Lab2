const test = require("node:test");
const assert = require("node:assert/strict");

const { createUserAccount } = require("../../src/models/user_account");
const { createRegistrationAttempt } = require("../../src/models/registration_attempt");

test("createUserAccount returns expected fields", () => {
  const user = createUserAccount({ email: "user@example.com", credential: "secret" });
  assert.equal(typeof user.id, "string");
  assert.equal(user.email, "user@example.com");
  assert.equal(user.credential, "secret");
  assert.equal(user.status, "active");
  assert.equal(typeof user.created_at, "string");
});

test("createRegistrationAttempt returns expected fields", () => {
  const attempt = createRegistrationAttempt({
    emailInput: "User@Example.com",
    emailCanonical: "user@example.com",
    outcome: "validation_failure",
    reason: "validation_error",
  });
  assert.equal(typeof attempt.id, "string");
  assert.equal(attempt.email_input, "User@Example.com");
  assert.equal(attempt.email_canonical, "user@example.com");
  assert.equal(attempt.outcome, "validation_failure");
  assert.equal(attempt.reason, "validation_error");
  assert.equal(typeof attempt.timestamp, "string");
});
