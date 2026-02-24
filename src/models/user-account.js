const crypto = require("crypto");

function generateId() {
  return `user_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function createUserAccount({ id, email, password_hash, salt, status = "active", created_at } = {}) {
  return {
    id: id || generateId(),
    email,
    password_hash,
    salt,
    status,
    created_at: created_at || new Date().toISOString(),
  };
}

module.exports = {
  createUserAccount,
};
