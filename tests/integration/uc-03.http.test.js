const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const http = require("http");
const { createAppServer } = require("../../src/server");

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function requestRaw(baseUrl, options, body) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: options.path,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function makeStore({ email, oldPassword, failUpdate = false } = {}) {
  const salt = "uc03-salt";
  const user = {
    id: "uc03_user",
    email,
    status: "active",
    salt,
    password_hash: hashPassword(oldPassword, salt),
  };
  return {
    usersByEmail: new Map([[email, user]]),
    failUpdate,
    findUserByEmailCanonical(emailCanonical) {
      return this.usersByEmail.get(emailCanonical) || null;
    },
    findUserById(userId) {
      for (const existingUser of this.usersByEmail.values()) {
        if (existingUser.id === userId) {
          return existingUser;
        }
      }
      return null;
    },
    updateUserPassword(userId, updates) {
      if (this.failUpdate) {
        throw new Error("DB_WRITE_FAILED");
      }

      for (const [userEmail, existingUser] of this.usersByEmail.entries()) {
        if (existingUser.id !== userId) {
          continue;
        }
        const updated = {
          ...existingUser,
          ...updates,
        };
        this.usersByEmail.set(userEmail, updated);
        return updated;
      }
      return null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };
}

async function loginAndGetSessionCookie(baseUrl, { email, password }) {
  const loginPayload = JSON.stringify({ email, password });
  const login = await requestRaw(
    baseUrl,
    {
      path: "/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(loginPayload),
      },
    },
    loginPayload
  );
  assert.equal(login.status, 200);
  const rawSetCookie = login.headers["set-cookie"];
  const sessionCookie = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
  assert.equal(typeof sessionCookie, "string");
  return sessionCookie;
}

async function assertLoginStatus(baseUrl, { email, password, expectedStatus }) {
  const payload = JSON.stringify({ email, password });
  const response = await requestRaw(
    baseUrl,
    {
      path: "/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    payload
  );
  assert.equal(response.status, expectedStatus);
}

test("UC-03 integration: successful password change keeps active session and updates credentials", async () => {
  const email = "uc03.user@example.com";
  const oldPassword = "OldPassw0rd!";
  const newPassword = "NewPassw0rd1";
  const store = makeStore({ email, oldPassword });
  const { server } = createAppServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const sessionCookie = await loginAndGetSessionCookie(baseUrl, {
      email,
      password: oldPassword,
    });

    const settingsPage = await requestRaw(baseUrl, {
      path: "/account/settings.html",
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(settingsPage.status, 200);
    assert.equal(settingsPage.body.includes("name=\"confirmPassword\""), false);

    const changePayload = JSON.stringify({
      userId: "forged_user",
      currentPassword: oldPassword,
      newPassword,
    });
    const change = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(change.status, 200);
    const changeBody = JSON.parse(change.body);
    assert.equal(changeBody.message, "Password changed successfully.");

    const sessionCheck = await requestRaw(baseUrl, {
      path: "/session",
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(sessionCheck.status, 200);

    await assertLoginStatus(baseUrl, { email, password: oldPassword, expectedStatus: 401 });
    await assertLoginStatus(baseUrl, { email, password: newPassword, expectedStatus: 200 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-03 integration: unauthenticated requests are rejected/redirected", async () => {
  const store = makeStore({ email: "uc03.auth@example.com", oldPassword: "OldPassw0rd!" });
  const { server } = createAppServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const settings = await requestRaw(baseUrl, { path: "/account/settings.html" });
    assert.equal(settings.status, 302);
    assert.equal(settings.headers.location, "/login.html");

    const changePayload = JSON.stringify({
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    });
    const change = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(change.status, 401);
    const body = JSON.parse(change.body);
    assert.equal(body.errorCode, "unauthenticated");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-03 integration: incorrect current password is rejected and password remains unchanged", async () => {
  const email = "uc03.invalid-current@example.com";
  const oldPassword = "OldPassw0rd!";
  const store = makeStore({ email, oldPassword });
  const { server } = createAppServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const sessionCookie = await loginAndGetSessionCookie(baseUrl, { email, password: oldPassword });
    const changePayload = JSON.stringify({
      currentPassword: "WrongOldPass!",
      newPassword: "NewPassw0rd1",
    });
    const change = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(change.status, 401);
    const body = JSON.parse(change.body);
    assert.equal(body.errorCode, "invalid_current_password");
    assert.equal(body.fieldErrors.currentPassword, "Current password is incorrect");

    await assertLoginStatus(baseUrl, { email, password: oldPassword, expectedStatus: 200 });
    await assertLoginStatus(baseUrl, { email, password: "NewPassw0rd1", expectedStatus: 401 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-03 integration: policy failures return validation errors and do not update password", async () => {
  const email = "uc03.policy@example.com";
  const oldPassword = "OldPassw0rd!";
  const store = makeStore({ email, oldPassword });
  const { server } = createAppServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const sessionCookie = await loginAndGetSessionCookie(baseUrl, { email, password: oldPassword });

    const weakPayload = JSON.stringify({
      currentPassword: oldPassword,
      newPassword: "123",
    });
    const weak = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(weakPayload),
        },
      },
      weakPayload
    );
    assert.equal(weak.status, 400);
    const weakBody = JSON.parse(weak.body);
    assert.equal(weakBody.errorCode, "validation_error");
    assert.equal(typeof weakBody.fieldErrors.newPassword, "string");

    const equalPayload = JSON.stringify({
      currentPassword: oldPassword,
      newPassword: oldPassword,
    });
    const equal = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(equalPayload),
        },
      },
      equalPayload
    );
    assert.equal(equal.status, 400);
    const equalBody = JSON.parse(equal.body);
    assert.equal(equalBody.errorCode, "validation_error");
    assert.equal(equalBody.fieldErrors.newPassword, "New password must be different from the current password");

    const blankPayload = JSON.stringify({
      currentPassword: "",
      newPassword: "",
    });
    const blank = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(blankPayload),
        },
      },
      blankPayload
    );
    assert.equal(blank.status, 400);
    const blankBody = JSON.parse(blank.body);
    assert.equal(blankBody.fieldErrors.currentPassword, "Current password is required");
    assert.equal(blankBody.fieldErrors.newPassword, "New password is required");

    await assertLoginStatus(baseUrl, { email, password: oldPassword, expectedStatus: 200 });
    await assertLoginStatus(baseUrl, { email, password: "NewPassw0rd1", expectedStatus: 401 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("UC-03 integration: update failure returns safe error and leaves password unchanged", async () => {
  const email = "uc03.failure@example.com";
  const oldPassword = "OldPassw0rd!";
  const store = makeStore({ email, oldPassword, failUpdate: true });
  const { server } = createAppServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const sessionCookie = await loginAndGetSessionCookie(baseUrl, { email, password: oldPassword });
    const changePayload = JSON.stringify({
      currentPassword: oldPassword,
      newPassword: "NewPassw0rd1",
    });
    const change = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(change.status, 500);
    const body = JSON.parse(change.body);
    assert.equal(body.errorCode, "system_error");
    assert.equal(body.message, "Password change failed. Please try again.");

    await assertLoginStatus(baseUrl, { email, password: oldPassword, expectedStatus: 200 });
    await assertLoginStatus(baseUrl, { email, password: "NewPassw0rd1", expectedStatus: 401 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
