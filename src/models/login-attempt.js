const crypto = require("crypto");

function generateId() {
  return `login_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function createLoginAttempt({ email, outcome, message, timestamp } = {}) {
  return {
    id: generateId(),
    email,
    timestamp: timestamp || new Date().toISOString(),
    outcome,
    message,
  };
}

module.exports = {
  createLoginAttempt,
};
