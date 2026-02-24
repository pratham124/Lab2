const { normalizeEmail, isBlank, isValidEmailFormat } = require("./email_utils");
const { validatePassword } = require("./password_policy");
const { VALIDATION_MESSAGES } = require("./validation_messages");
const { createRegistrationAttempt } = require("../models/registration_attempt");
const { createUserAccount } = require("../models/user_account");
const { DuplicateEmailError } = require("./user_repository");

function createRegistrationService({ userRepository, attemptLogger }) {
  async function register({ email, password }) {
    const emailInput = email || "";
    const emailCanonical = normalizeEmail(emailInput);
    const fieldErrors = {};

    if (isBlank(emailInput)) {
      fieldErrors.email = VALIDATION_MESSAGES.EMAIL_REQUIRED;
    } else if (!isValidEmailFormat(emailInput.trim())) {
      fieldErrors.email = VALIDATION_MESSAGES.EMAIL_INVALID;
    }

    const passwordCheck = validatePassword(password || "");
    if (!passwordCheck.valid) {
      fieldErrors.password = passwordCheck.error;
    }

    if (Object.keys(fieldErrors).length > 0) {
      attemptLogger.logAttempt(
        createRegistrationAttempt({
          emailInput,
          emailCanonical,
          outcome: "validation_failure",
          reason: "validation_error",
        })
      );

      return {
        type: "validation_error",
        status: 400,
        error: "Validation error",
        fieldErrors,
      };
    }

    try {
      const existing = await userRepository.existsByEmailCanonical(emailCanonical);
      if (existing) {
        attemptLogger.logAttempt(
          createRegistrationAttempt({
            emailInput,
            emailCanonical,
            outcome: "validation_failure",
            reason: "duplicate_email",
          })
        );

        return {
          type: "duplicate",
          status: 409,
          error: VALIDATION_MESSAGES.EMAIL_IN_USE,
        };
      }

      const userAccount = createUserAccount({
        email: emailCanonical,
        credential: password,
      });

      await userRepository.create(userAccount);

      attemptLogger.logAttempt(
        createRegistrationAttempt({
          emailInput,
          emailCanonical,
          outcome: "success",
          reason: null,
        })
      );

      return {
        type: "success",
        status: 302,
        redirect: "/login",
        user: userAccount,
      };
    } catch (error) {
      if (error instanceof DuplicateEmailError || error.code === "DUPLICATE_EMAIL") {
        attemptLogger.logAttempt(
          createRegistrationAttempt({
            emailInput,
            emailCanonical,
            outcome: "validation_failure",
            reason: "duplicate_email",
          })
        );

        return {
          type: "duplicate",
          status: 409,
          error: VALIDATION_MESSAGES.EMAIL_IN_USE,
        };
      }

      attemptLogger.logFailure(
        createRegistrationAttempt({
          emailInput,
          emailCanonical,
          outcome: "system_error",
          reason: "storage_failure",
        })
      );

      return {
        type: "system_error",
        status: 500,
        error: VALIDATION_MESSAGES.SYSTEM_ERROR,
      };
    }
  }

  return { register };
}

module.exports = {
  createRegistrationService,
};
