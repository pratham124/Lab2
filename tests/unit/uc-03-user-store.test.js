const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createUserStore } = require("../../src/services/user-store");

function makeUser({ id, email, salt = "seed", password_hash = "hash" }) {
  return {
    id,
    email,
    salt,
    password_hash,
    status: "active",
    created_at: "2026-02-24T00:00:00.000Z",
  };
}

test("user-store findById returns user or null", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc03-user-store-"));
  const usersPath = path.join(tempDir, "users.json");
  fs.writeFileSync(
    usersPath,
    JSON.stringify(
      [
        makeUser({ id: "user_1", email: "user1@example.com" }),
        makeUser({ id: "user_2", email: "user2@example.com" }),
      ],
      null,
      2
    ),
    "utf8"
  );

  try {
    const store = createUserStore({ filePath: usersPath });
    const found = await store.findById("user_2");
    assert.equal(found.email, "user2@example.com");

    const missing = await store.findById("missing");
    assert.equal(missing, null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("user-store updatePassword updates matching user and returns null when missing", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc03-user-store-update-"));
  const usersPath = path.join(tempDir, "users.json");
  fs.writeFileSync(
    usersPath,
    JSON.stringify([makeUser({ id: "user_1", email: "user1@example.com" })], null, 2),
    "utf8"
  );

  try {
    const store = createUserStore({ filePath: usersPath });
    const updated = await store.updatePassword("user_1", {
      salt: "new-salt",
      password_hash: "new-hash",
      password_updated_at: "2026-02-24T12:00:00.000Z",
    });

    assert.equal(updated.salt, "new-salt");
    assert.equal(updated.password_hash, "new-hash");

    const fromDisk = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    assert.equal(fromDisk[0].salt, "new-salt");
    assert.equal(fromDisk[0].password_hash, "new-hash");

    const missing = await store.updatePassword("missing", {
      salt: "x",
      password_hash: "y",
    });
    assert.equal(missing, null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
