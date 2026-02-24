const fs = require("fs");
const path = require("path");
const { createUserAccount } = require("../models/user-account");

function createUserStore({ filePath } = {}) {
  const usersFilePath = filePath || path.join(__dirname, "..", "..", "data", "users.json");

  async function getAllUsers() {
    const raw = await fs.promises.readFile(usersFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((user) => createUserAccount(user));
  }

  async function findByEmail(emailCanonical) {
    const users = await getAllUsers();
    return users.find((user) => user.email === emailCanonical) || null;
  }

  return {
    getAllUsers,
    findByEmail,
    usersFilePath,
  };
}

module.exports = {
  createUserStore,
};
