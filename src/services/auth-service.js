const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createLoginAttempt } = require("../models/login-attempt");

const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  SYSTEM_FAILURE: "Login failed. Please try again.",
  EMAIL_REQUIRED: "Email is required.",
  PASSWORD_REQUIRED: "Password is required.",
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64);
}

function secureCompareHex(hexA, hexB) {
  const a = Buffer.from(hexA, "hex");
  const b = Buffer.from(hexB, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function createAuthService({ userStore, logFilePath, isVerificationAvailable } = {}) {
  const authLogPath = logFilePath || path.join(__dirname, "..", "..", "logs", "auth.log");
  const loginAttempts = [];
  const failedAttemptsByEmail = new Map();

  function appendAuthLog(entry) {
    fs.appendFileSync(authLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  function recordAttempt({ email, outcome, message, reason }) {
    const attempt = createLoginAttempt({
      email,
      outcome,
      message,
    });
    loginAttempts.push(attempt);

    if (outcome !== "success") {
      const current = failedAttemptsByEmail.get(email) || 0;
      failedAttemptsByEmail.set(email, current + 1);
      appendAuthLog({
        timestamp: attempt.timestamp,
        email,
        outcome,
        reason,
        failed_attempt_count: current + 1,
      });
    }

    return attempt;
  }

  async function authenticate({ email, password } = {}) {
    const normalizedEmail = normalizeEmail(email);
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawPassword) {
      const missingMessage = !normalizedEmail
        ? AUTH_MESSAGES.EMAIL_REQUIRED
        : AUTH_MESSAGES.PASSWORD_REQUIRED;
      recordAttempt({
        email: normalizedEmail,
        outcome: "missing_fields",
        message: missingMessage,
        reason: "missing_fields",
      });
      return {
        type: "missing_fields",
        status: 400,
        message: missingMessage,
      };
    }

    try {
      const available =
        typeof isVerificationAvailable === "function" ? isVerificationAvailable() : true;
      if (!available || process.env.AUTH_SERVICE_DOWN === "1") {
        throw new Error("AUTH_SERVICE_UNAVAILABLE");
      }

      const user = await userStore.findByEmail(normalizedEmail);
      if (!user || user.status !== "active") {
        recordAttempt({
          email: normalizedEmail,
          outcome: "invalid_credentials",
          message: AUTH_MESSAGES.INVALID_CREDENTIALS,
          reason: "unknown_email",
        });
        return {
          type: "invalid_credentials",
          status: 401,
          message: AUTH_MESSAGES.INVALID_CREDENTIALS,
        };
      }

      const derivedHashHex = hashPassword(rawPassword, user.salt).toString("hex");
      const passwordMatches = secureCompareHex(derivedHashHex, user.password_hash);

      if (!passwordMatches) {
        recordAttempt({
          email: normalizedEmail,
          outcome: "invalid_credentials",
          message: AUTH_MESSAGES.INVALID_CREDENTIALS,
          reason: "wrong_password",
        });
        return {
          type: "invalid_credentials",
          status: 401,
          message: AUTH_MESSAGES.INVALID_CREDENTIALS,
        };
      }

      recordAttempt({
        email: normalizedEmail,
        outcome: "success",
        message: "authenticated",
        reason: "success",
      });
      return {
        type: "success",
        status: 200,
        user,
      };
    } catch (error) {
      recordAttempt({
        email: normalizedEmail,
        outcome: "system_error",
        message: AUTH_MESSAGES.SYSTEM_FAILURE,
        reason: "verification_failure",
      });
      appendAuthLog({
        timestamp: new Date().toISOString(),
        email: normalizedEmail,
        outcome: "system_error",
        reason: "verification_failure",
        error_code: error.message || "UNKNOWN_ERROR",
      });

      return {
        type: "system_error",
        status: 500,
        message: AUTH_MESSAGES.SYSTEM_FAILURE,
      };
    }
  }

  function getAttempts() {
    return loginAttempts.slice();
  }

  return {
    AUTH_MESSAGES,
    normalizeEmail,
    authenticate,
    getAttempts,
  };
}

module.exports = {
  AUTH_MESSAGES,
  normalizeEmail,
  createAuthService,
};
