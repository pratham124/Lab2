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

  async function findById(userId) {
    const users = await getAllUsers();
    return users.find((user) => user.id === userId) || null;
  }

  async function updatePassword(userId, updates) {
    const users = await getAllUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) {
      return null;
    }

    const user = users[index];
    users[index] = createUserAccount({
      ...user,
      ...updates,
    });
    await fs.promises.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
    return users[index];
  }

  return {
    getAllUsers,
    findByEmail,
    findById,
    updatePassword,
    usersFilePath,
  };
}

module.exports = {
  createUserStore,
};
