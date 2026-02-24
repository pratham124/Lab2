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

module.exports = {
  validatePassword,
};
