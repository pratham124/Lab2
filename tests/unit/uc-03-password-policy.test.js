const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePasswordChange } = require("../../src/services/password_policy");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");

test("validatePasswordChange returns both required field errors when blank", () => {
  const result = validatePasswordChange({
    currentPassword: "",
    newPassword: "",
  });

  assert.equal(result.valid, false);
  assert.equal(result.fieldErrors.currentPassword, VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED);
  assert.equal(result.fieldErrors.newPassword, VALIDATION_MESSAGES.NEW_PASSWORD_REQUIRED);
});

test("validatePasswordChange rejects equal current and new password", () => {
  const result = validatePasswordChange({
    currentPassword: "OldPassw0rd!",
    newPassword: "OldPassw0rd!",
  });

  assert.equal(result.valid, false);
  assert.equal(result.fieldErrors.newPassword, VALIDATION_MESSAGES.NEW_PASSWORD_MUST_DIFFER);
});

test("validatePasswordChange rejects policy-violating new password", () => {
  const result = validatePasswordChange({
    currentPassword: "OldPassw0rd!",
    newPassword: "123",
  });

  assert.equal(result.valid, false);
  assert.equal(result.fieldErrors.newPassword, VALIDATION_MESSAGES.PASSWORD_RULES);
});

test("validatePasswordChange returns valid for compliant passwords", () => {
  const result = validatePasswordChange({
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd1",
  });

  assert.deepEqual(result, { valid: true, fieldErrors: {} });
});
