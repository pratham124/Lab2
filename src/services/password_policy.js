const { VALIDATION_MESSAGES } = require("./validation_messages");

function validatePassword(password) {
  if (!password || password.trim() === "") {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.PASSWORD_REQUIRED,
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.PASSWORD_RULES,
    };
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.PASSWORD_RULES,
    };
  }

  return { valid: true, error: null };
}

function validatePasswordChange({ currentPassword, newPassword } = {}) {
  const current = String(currentPassword || "");
  const next = String(newPassword || "");
  const fieldErrors = {};

  if (!current.trim()) {
    fieldErrors.currentPassword = VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED;
  }

  if (!next.trim()) {
    fieldErrors.newPassword = VALIDATION_MESSAGES.NEW_PASSWORD_REQUIRED;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      valid: false,
      fieldErrors,
    };
  }

  if (current === next) {
    return {
      valid: false,
      fieldErrors: {
        newPassword: VALIDATION_MESSAGES.NEW_PASSWORD_MUST_DIFFER,
      },
    };
  }

  const newPasswordValidation = validatePassword(next);
  if (!newPasswordValidation.valid) {
    return {
      valid: false,
      fieldErrors: {
        newPassword: newPasswordValidation.error,
      },
    };
  }

  return { valid: true, fieldErrors: {} };
}

module.exports = {
  validatePassword,
  validatePasswordChange,
};
