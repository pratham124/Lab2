const VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: "Email is required",
  EMAIL_INVALID: "Email must be a valid address",
  EMAIL_IN_USE: "Email is already in use",
  PASSWORD_REQUIRED: "Password is required",
  PASSWORD_RULES: "Password must be at least 8 characters and include at least 1 letter and 1 number.",
  SYSTEM_ERROR: "Registration failed. Please try again.",
  CURRENT_PASSWORD_REQUIRED: "Current password is required",
  NEW_PASSWORD_REQUIRED: "New password is required",
  CURRENT_PASSWORD_INVALID: "Current password is incorrect",
  NEW_PASSWORD_MUST_DIFFER: "New password must be different from the current password",
  PASSWORD_CHANGE_SUCCESS: "Password changed successfully.",
  PASSWORD_CHANGE_FAILURE: "Password change failed. Please try again.",
};

module.exports = {
  VALIDATION_MESSAGES,
};
