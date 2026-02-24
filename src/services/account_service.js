const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { validatePasswordChange } = require("./password_policy");
const { VALIDATION_MESSAGES } = require("./validation_messages");

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64);
}

function secureCompareHex(hexA, hexB) {
  const a = Buffer.from(hexA || "", "hex");
  const b = Buffer.from(hexB || "", "hex");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function createAccountService({ userStore, logFilePath } = {}) {
  const accountLogPath = logFilePath || path.join(__dirname, "..", "..", "logs", "account.log");

  function appendAccountLog(entry) {
    try {
      fs.appendFileSync(accountLogPath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (error) {
      // Logging failures should not change user-facing behavior.
    }
  }

  async function changePassword({ userId, currentPassword, newPassword } = {}) {
    const validation = validatePasswordChange({ currentPassword, newPassword });
    if (!validation.valid) {
      return {
        type: "validation_error",
        status: 400,
        message: VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE,
        fieldErrors: validation.fieldErrors,
      };
    }

    try {
      if (!userStore || typeof userStore.findById !== "function") {
        throw new Error("USER_STORE_UNAVAILABLE");
      }

      const user = await userStore.findById(userId);
      if (!user || !user.salt || !user.password_hash) {
        throw new Error("USER_NOT_FOUND");
      }

      const currentHashHex = hashPassword(String(currentPassword), user.salt).toString("hex");
      const currentMatches = secureCompareHex(currentHashHex, user.password_hash);
      if (!currentMatches) {
        return {
          type: "invalid_current_password",
          status: 401,
          message: VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID,
          fieldErrors: {
            currentPassword: VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID,
          },
        };
      }

      const newSalt = crypto.randomBytes(16).toString("hex");
      const newHashHex = hashPassword(String(newPassword), newSalt).toString("hex");

      if (!userStore || typeof userStore.updatePassword !== "function") {
        throw new Error("USER_STORE_READ_ONLY");
      }

      const updated = await userStore.updatePassword(userId, {
        salt: newSalt,
        password_hash: newHashHex,
        password_updated_at: new Date().toISOString(),
      });

      if (!updated) {
        throw new Error("PASSWORD_UPDATE_FAILED");
      }

      return {
        type: "success",
        status: 200,
        message: VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS,
      };
    } catch (error) {
      appendAccountLog({
        timestamp: new Date().toISOString(),
        user_id: userId || null,
        outcome: "system_error",
        reason: "password_update_failure",
        error_code: error.message || "UNKNOWN_ERROR",
      });

      return {
        type: "system_error",
        status: 500,
        message: VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE,
      };
    }
  }

  return {
    changePassword,
  };
}

module.exports = {
  createAccountService,
  __test: {
    secureCompareHex,
    hashPassword,
  },
};
