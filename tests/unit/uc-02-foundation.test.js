const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createUserStore } = require("../../src/services/user-store");
const { createSessionService } = require("../../src/services/session-service");
const { createUserAccount } = require("../../src/models/user-account");
const { createLoginAttempt } = require("../../src/models/login-attempt");
const { renderLoginView } = require("../../src/views/login-view");
const { renderDashboardView } = require("../../src/views/dashboard-view");

function createTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("user-store getAllUsers handles non-array and maps valid array records", async (t) => {
  const fixtureA = createTempDir("uc02-store-a-");
  t.after(() => fixtureA.cleanup());
  const fileA = path.join(fixtureA.dir, "users.json");
  fs.writeFileSync(fileA, JSON.stringify({ not: "array" }), "utf8");
  const storeA = createUserStore({ filePath: fileA });
  assert.deepEqual(await storeA.getAllUsers(), []);

  const fixtureB = createTempDir("uc02-store-b-");
  t.after(() => fixtureB.cleanup());
  const fileB = path.join(fixtureB.dir, "users.json");
  fs.writeFileSync(
    fileB,
    JSON.stringify([
      {
        id: "user_1",
        email: "user1@example.com",
        password_hash: "abc",
        salt: "salt",
        status: "active",
        created_at: "2026-02-24T00:00:00.000Z",
      },
    ]),
    "utf8"
  );
  const storeB = createUserStore({ filePath: fileB });
  const users = await storeB.getAllUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].id, "user_1");

  const found = await storeB.findByEmail("user1@example.com");
  assert.equal(found.email, "user1@example.com");
  const missing = await storeB.findByEmail("unknown@example.com");
  assert.equal(missing, null);
});

test("session-service create/validate/destroy covers missing unknown expired and active branches", () => {
  const noExpiry = createSessionService();
  assert.equal(noExpiry.validate(), null);
  assert.equal(noExpiry.validate("unknown"), null);

  const created = noExpiry.create("user_1");
  const initialLastActive = created.last_active_at;
  const validated = noExpiry.validate(created.session_id);
  assert.equal(validated.user_id, "user_1");
  assert.notEqual(validated.last_active_at, undefined);
  assert.equal(new Date(validated.last_active_at).getTime() >= new Date(initialLastActive).getTime(), true);

  noExpiry.destroy(created.session_id);
  assert.equal(noExpiry.validate(created.session_id), null);

  const alreadyExpired = createSessionService({ ttlMs: -1 });
  const expired = alreadyExpired.create("user_2");
  assert.equal(alreadyExpired.validate(expired.session_id), null);
});

test("UC-02 models cover default and override branches", () => {
  const defaultUser = createUserAccount({
    email: "user@example.com",
    password_hash: "h",
    salt: "s",
  });
  assert.equal(defaultUser.status, "active");
  assert.equal(typeof defaultUser.id, "string");
  assert.equal(typeof defaultUser.created_at, "string");

  const explicitUser = createUserAccount({
    id: "explicit-id",
    email: "explicit@example.com",
    password_hash: "h",
    salt: "s",
    status: "disabled",
    created_at: "2026-02-24T00:00:00.000Z",
  });
  assert.equal(explicitUser.id, "explicit-id");
  assert.equal(explicitUser.status, "disabled");
  assert.equal(explicitUser.created_at, "2026-02-24T00:00:00.000Z");

  const defaultAttempt = createLoginAttempt({
    email: "user@example.com",
    outcome: "invalid_credentials",
    message: "Invalid email or password.",
  });
  assert.equal(typeof defaultAttempt.id, "string");
  assert.equal(typeof defaultAttempt.timestamp, "string");

  const explicitAttempt = createLoginAttempt({
    email: "user@example.com",
    outcome: "success",
    message: "ok",
    timestamp: "2026-02-24T00:00:00.000Z",
  });
  assert.equal(explicitAttempt.timestamp, "2026-02-24T00:00:00.000Z");
});

test("UC-02 views render templates and escape HTML-sensitive values", () => {
  const loginHtml = renderLoginView({
    email: '<script>"x"&y</script>',
    errorMessage: "Invalid email or password.",
  });
  assert.equal(loginHtml.includes("&lt;script&gt;&quot;x&quot;&amp;y&lt;/script&gt;"), true);
  assert.equal(loginHtml.includes("<script>"), false);
  assert.equal(loginHtml.includes("Invalid email or password."), true);

  const dashboardHtml = renderDashboardView({
    userId: "<b>user_1</b>",
  });
  assert.equal(dashboardHtml.includes("&lt;b&gt;user_1&lt;/b&gt;"), true);
  assert.equal(dashboardHtml.includes("<b>user_1</b>"), false);
});

test("dashboard view handles missing userId with empty fallback rendering", () => {
  const dashboardHtml = renderDashboardView();
  assert.equal(dashboardHtml.includes("Signed in as"), true);
  assert.equal(dashboardHtml.includes("{{userId}}"), false);
});
