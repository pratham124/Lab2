const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {
  createAppServer,
  createRegistrationFileStore,
  startServer,
  __test,
} = require("../../src/server");
const { EventEmitter } = require("events");

async function withServer(handler) {
  const { server } = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await handler(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
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
    if (body) req.write(body);
    req.end();
  });
}

test("server serves registration page and static assets", { concurrency: false }, async () => {
  const cssPath = path.join(__dirname, "..", "..", "public", "css", "register.css");
  const backupPath = `${cssPath}.bak`;
  if (!fs.existsSync(cssPath) && fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, cssPath);
  }
  assert.equal(fs.existsSync(cssPath), true);

  await withServer(async (baseUrl) => {
    const page = await requestRaw(baseUrl, { path: "/register" });
    assert.equal(page.status, 200);
    assert.equal(page.headers["content-type"], "text/html");

    const css = await requestRaw(baseUrl, { path: "/css/register.css" });
    assert.equal(css.status, 200);
    assert.equal(css.headers["content-type"], "text/css");

    const js = await requestRaw(baseUrl, { path: "/js/register.js" });
    assert.equal(js.status, 200);
    assert.equal(js.headers["content-type"], "application/javascript");

    const manuscriptJs = await requestRaw(baseUrl, { path: "/js/manuscript_upload.js" });
    assert.equal(manuscriptJs.status, 200);
    assert.equal(manuscriptJs.headers["content-type"], "application/javascript");
  });
});

test("server returns login placeholder and 404 for unknown routes", async () => {
  await withServer(async (baseUrl) => {
    const login = await requestRaw(baseUrl, { path: "/login" });
    assert.equal(login.status, 200);
    assert.equal(login.headers["content-type"], "text/html");

    const missing = await requestRaw(baseUrl, { path: "/does-not-exist" });
    assert.equal(missing.status, 404);
    assert.equal(missing.body, "Not found");
  });
});

test("server handles JSON and urlencoded submissions", async () => {
  await withServer(async (baseUrl) => {
    const okJson = await requestRaw(
      baseUrl,
      {
        path: "/register",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      JSON.stringify({ email: "test.user@example.com", password: "ValidPassw0rd1" })
    );
    assert.equal(okJson.status, 302);
    assert.equal(okJson.headers.location, "/login");

    const formBody = "email=&password=";
    const form = await requestRaw(
      baseUrl,
      {
        path: "/register",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(formBody),
        },
      },
      formBody
    );
    assert.equal(form.status, 400);
    assert.equal(form.headers["content-type"], "text/html");
  });
});

test("server handles invalid JSON payloads safely", async () => {
  await withServer(async (baseUrl) => {
    const badJson = await requestRaw(
      baseUrl,
      {
        path: "/register",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      "{bad json"
    );
    assert.equal(badJson.status, 400);
    const payload = JSON.parse(badJson.body);
    assert.equal(payload.error, "Validation error");
  });
});

test("server forwards submission form query params to submissionController", async () => {
  let capturedQuery = null;
  const { server } = createAppServer({
    submissionController: {
      async handleGetForm(req) {
        capturedQuery = req.query;
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, query: req.query }),
        };
      },
      async handlePost() {
        return { status: 500, headers: {}, body: "" };
      },
      async handleGetConfirmation() {
        return { status: 500, headers: {}, body: "" };
      },
    },
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const response = await requestRaw(baseUrl, {
      path: "/submissions/new?draft=submission_1&mode=resume",
    });
    assert.equal(response.status, 200);
    const payload = JSON.parse(response.body);
    assert.deepEqual(payload.query, { draft: "submission_1", mode: "resume" });
    assert.deepEqual(capturedQuery, { draft: "submission_1", mode: "resume" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server returns 404 for missing static assets", async () => {
  await withServer(async (baseUrl) => {
    const missing = await requestRaw(baseUrl, { path: "/css/missing.css" });
    assert.equal(missing.status, 404);
    assert.equal(missing.body, "Not found");
  });
});

test("server uses memory store duplicate branch and failure logger", () => {
  const { store } = createAppServer();
  const user = { email: "dup@example.com", credential: "ValidPassw0rd1" };
  const created = store.createUserAccount(user);
  assert.equal(created.status, "active");
  assert.equal(typeof created.salt, "string");
  assert.equal(typeof created.password_hash, "string");
  assert.equal(created.password_hash.length > 0, true);
  assert.throws(() => store.createUserAccount(user), /Email already exists/);
  store.recordRegistrationFailure({ id: "fail" });
});

test("server registration file store persists login-compatible users to users.json", () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp-users-"));
  const usersFilePath = path.join(tempDir, "users.json");
  try {
    const store = createRegistrationFileStore({ usersFilePath });
    const created = store.createUserAccount({
      email: "persistent.user@example.com",
      credential: "ValidPassw0rd1",
    });

    assert.equal(created.email, "persistent.user@example.com");
    assert.equal(created.status, "active");
    assert.equal(typeof created.password_hash, "string");
    assert.equal(typeof created.salt, "string");
    assert.equal(created.password_hash.length > 0, true);

    const fromStore = store.findUserByEmailCanonical("persistent.user@example.com");
    assert.equal(fromStore.email, "persistent.user@example.com");
    assert.equal(fromStore.credential, undefined);

    assert.throws(
      () =>
        store.createUserAccount({
          email: "persistent.user@example.com",
          credential: "AnotherPassw0rd1",
        }),
      /Email already exists/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("server registration file store records registration attempts and failures", () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp-users-attempts-"));
  const usersFilePath = path.join(tempDir, "users.json");
  try {
    const store = createRegistrationFileStore({ usersFilePath });
    assert.doesNotThrow(() => store.recordRegistrationAttempt({ id: "a1" }));
    assert.doesNotThrow(() => store.recordRegistrationFailure({ id: "f1" }));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("server memory store supports user without credential (null password_hash branch)", () => {
  const { store } = createAppServer();
  const created = store.createUserAccount({ email: "no.credential@example.com" });
  assert.equal(created.password_hash, null);
});

test("server memory store findUserById and updateUserPassword branches", () => {
  const { store } = createAppServer();
  const created = store.createUserAccount({
    id: "mem-user-1",
    email: "memory.user@example.com",
    credential: "ValidPassw0rd!",
  });

  const found = store.findUserById("mem-user-1");
  assert.equal(found.email, "memory.user@example.com");
  assert.equal(store.findUserById("missing-user"), null);

  const updated = store.updateUserPassword("mem-user-1", {
    salt: "new-salt",
    password_hash: "new-hash",
  });
  assert.equal(updated.salt, "new-salt");
  assert.equal(updated.password_hash, "new-hash");
  assert.equal(store.updateUserPassword("missing-user", { password_hash: "x" }), null);
  assert.equal(created.id, "mem-user-1");
});

test("server registration file store handles non-array json and missing credential branch", () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp-users-non-array-"));
  const usersFilePath = path.join(tempDir, "users.json");
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify({ bad: "shape" }), "utf8");
    const store = createRegistrationFileStore({ usersFilePath });

    assert.equal(store.findUserByEmailCanonical("missing@example.com"), null);

    const created = store.createUserAccount({ email: "file.nullhash@example.com" });
    assert.equal(created.password_hash, null);

    assert.equal(store.findUserByEmailCanonical("not-found@example.com"), null);
    assert.equal(store.findUserByEmailCanonical("file.nullhash@example.com").email, "file.nullhash@example.com");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("server registration file store findUserById and updateUserPassword branches", () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp-users-find-update-"));
  const usersFilePath = path.join(tempDir, "users.json");
  try {
    const store = createRegistrationFileStore({ usersFilePath });
    const created = store.createUserAccount({
      id: "file-user-1",
      email: "file.user.find@example.com",
      credential: "ValidPassw0rd!",
    });

    const found = store.findUserById("file-user-1");
    assert.equal(found.email, created.email);
    assert.equal(store.findUserById("missing-user"), null);

    const updated = store.updateUserPassword("file-user-1", {
      salt: "file-new-salt",
      password_hash: "file-new-hash",
    });
    assert.equal(updated.salt, "file-new-salt");
    assert.equal(updated.password_hash, "file-new-hash");
    assert.equal(store.updateUserPassword("missing-user", { password_hash: "x" }), null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("server login lookup uses in-memory store before file fallback", async () => {
  const salt = "mem-first-salt";
  const password = "ValidPassw0rd!";
  const memoryUser = {
    id: "mem_1",
    email: "mem.first@example.com",
    status: "active",
    salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };

  const store = {
    findUserByEmailCanonical(emailCanonical) {
      return emailCanonical === memoryUser.email ? memoryUser : null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const fileStore = {
    async findByEmail() {
      throw new Error("Should not hit file store when memory user exists");
    },
  };

  const { server } = createAppServer({ store, userStore: fileStore });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const payload = JSON.stringify({
      email: memoryUser.email,
      password,
    });
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

    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"], "application/json");
    const setCookie = response.headers["set-cookie"];
    assert.equal(Array.isArray(setCookie) || typeof setCookie === "string", true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server login lookup falls back to file store and returns invalid credentials when no lookup exists", async () => {
  const salt = "file-fallback-salt";
  const password = "ValidPassw0rd!";
  const fileUser = {
    id: "file_1",
    email: "file.user@example.com",
    status: "active",
    salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };

  const baseStore = {
    findUserByEmailCanonical() {
      return null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const fallbackStore = {
    async findByEmail(emailCanonical) {
      return emailCanonical === fileUser.email ? fileUser : null;
    },
  };

  const { server: fallbackServer } = createAppServer({ store: baseStore, userStore: fallbackStore });
  await new Promise((resolve) => fallbackServer.listen(0, "127.0.0.1", resolve));
  const fallbackBaseUrl = `http://127.0.0.1:${fallbackServer.address().port}`;
  try {
    const payload = JSON.stringify({ email: fileUser.email, password });
    const ok = await requestRaw(
      fallbackBaseUrl,
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
    assert.equal(ok.status, 200);
  } finally {
    await new Promise((resolve) => fallbackServer.close(resolve));
  }

  const { server: noLookupServer } = createAppServer({ store: baseStore, userStore: {} });
  await new Promise((resolve) => noLookupServer.listen(0, "127.0.0.1", resolve));
  const noLookupBaseUrl = `http://127.0.0.1:${noLookupServer.address().port}`;
  try {
    const payload = JSON.stringify({ email: "missing@example.com", password });
    const denied = await requestRaw(
      noLookupBaseUrl,
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
    assert.equal(denied.status, 401);
    const body = JSON.parse(denied.body);
    assert.equal(body.error_code, "invalid_credentials");
  } finally {
    await new Promise((resolve) => noLookupServer.close(resolve));
  }
});

test("server login lookup handles appStore without findUserByEmailCanonical function", async () => {
  const salt = "no-find-fn-salt";
  const password = "ValidPassw0rd!";
  const fileUser = {
    id: "file_2",
    email: "no.find.fn@example.com",
    status: "active",
    salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };

  const storeWithoutFind = {
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const fallbackStore = {
    async findByEmail(emailCanonical) {
      return emailCanonical === fileUser.email ? fileUser : null;
    },
  };

  const { server } = createAppServer({ store: storeWithoutFind, userStore: fallbackStore });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const payload = JSON.stringify({ email: fileUser.email, password });
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

    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.user_id, fileUser.id);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server account lookup falls back to file userStore findById/updatePassword when app store lacks account hooks", async () => {
  const password = "ValidPassw0rd!";
  const oldSalt = "file-account-old-salt";
  const fileUser = {
    id: "file_account_1",
    email: "file.account@example.com",
    status: "active",
    salt: oldSalt,
    password_hash: crypto.scryptSync(password, oldSalt, 64).toString("hex"),
  };

  const appStore = {
    findUserByEmailCanonical(emailCanonical) {
      return emailCanonical === fileUser.email ? fileUser : null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const fileStore = {
    async findByEmail() {
      return null;
    },
    async findById(userId) {
      return userId === fileUser.id ? fileUser : null;
    },
    async updatePassword(userId, updates) {
      if (userId !== fileUser.id) {
        return null;
      }
      Object.assign(fileUser, updates);
      return fileUser;
    },
  };

  const { server } = createAppServer({ store: appStore, userStore: fileStore });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginPayload = JSON.stringify({ email: fileUser.email, password });
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
    const cookie = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
    assert.equal(typeof cookie, "string");

    const changePayload = JSON.stringify({
      currentPassword: password,
      newPassword: "NewPassw0rd1",
    });
    const changed = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(changed.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server account lookup/update wrappers return null when neither app nor file store provide account hooks", async () => {
  const password = "ValidPassw0rd!";
  const salt = "no-account-hooks-salt";
  const memoryUser = {
    id: "mem_account_1",
    email: "memory.account@example.com",
    status: "active",
    salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };

  const appStore = {
    findUserByEmailCanonical(emailCanonical) {
      return emailCanonical === memoryUser.email ? memoryUser : null;
    },
    findUserById(userId) {
      return userId === memoryUser.id ? memoryUser : null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const { server } = createAppServer({ store: appStore, userStore: {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginPayload = JSON.stringify({ email: memoryUser.email, password });
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
    const cookie = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
    assert.equal(typeof cookie, "string");

    const changePayload = JSON.stringify({
      currentPassword: password,
      newPassword: "NewPassw0rd1",
    });
    const failed = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(failed.status, 500);
    const body = JSON.parse(failed.body);
    assert.equal(body.errorCode, "system_error");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server account findById wrapper returns null when both app and file stores lack findById", async () => {
  const password = "ValidPassw0rd!";
  const salt = "findbyid-null-salt";
  const memoryUser = {
    id: "mem_account_findbyid_null",
    email: "memory.findbyid.null@example.com",
    status: "active",
    salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };

  const appStore = {
    findUserByEmailCanonical(emailCanonical) {
      return emailCanonical === memoryUser.email ? memoryUser : null;
    },
    createUserAccount() {
      return null;
    },
    recordRegistrationAttempt() {},
    recordRegistrationFailure() {},
  };

  const fileStoreWithoutFindById = {
    async findByEmail() {
      return null;
    },
  };

  const { server } = createAppServer({ store: appStore, userStore: fileStoreWithoutFindById });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginPayload = JSON.stringify({ email: memoryUser.email, password });
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
    const cookie = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
    assert.equal(typeof cookie, "string");

    const changePayload = JSON.stringify({
      currentPassword: password,
      newPassword: "NewPassw0rd1",
    });
    const failed = await requestRaw(
      baseUrl,
      {
        path: "/account/password",
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(changePayload),
        },
      },
      changePayload
    );
    assert.equal(failed.status, 500);
    const body = JSON.parse(failed.body);
    assert.equal(body.errorCode, "system_error");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server parseBody resolves empty object for non-json/form content", async () => {
  await withServer(async (baseUrl) => {
    const response = await requestRaw(
      baseUrl,
      {
        path: "/register",
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Accept: "application/json",
        },
      },
      "plain text"
    );
    assert.equal(response.status, 400);
    const payload = JSON.parse(response.body);
    assert.equal(payload.error, "Validation error");
  });
});

test("server serveStatic 404 branch when asset missing", { concurrency: false }, async () => {
  const originalReadFileSync = fs.readFileSync;
  const cssPathSuffix = path.join("public", "css", "register.css");

  fs.readFileSync = function patchedReadFileSync(filePath, ...rest) {
    const normalized = String(filePath || "");
    if (normalized.endsWith(cssPathSuffix)) {
      const error = new Error("ENOENT");
      error.code = "ENOENT";
      throw error;
    }
    return originalReadFileSync.call(this, filePath, ...rest);
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await requestRaw(baseUrl, { path: "/css/register.css" });
      assert.equal(response.status, 404);
      assert.equal(response.body, "Not found");
    });
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test("server startServer starts and logs", async () => {
  let logLine = "";
  const logger = {
    log(message) {
      logLine = message;
    },
  };

  const server = startServer({ port: 0, host: "127.0.0.1", logger });
  await new Promise((resolve) => server.on("listening", resolve));
  assert.equal(logLine.includes("CMS dev server running on http://127.0.0.1:"), true);

  await new Promise((resolve) => server.close(resolve));
});

test("server main entry runs when executed directly", async () => {
  const serverPath = path.join(__dirname, "..", "..", "src", "server.js");
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for server start"));
    }, 2000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
      if (output.includes("CMS dev server running on http://127.0.0.1:")) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  child.kill("SIGTERM");
  await new Promise((resolve) => child.on("exit", resolve));
});

test("server send handles missing headers/body", () => {
  const calls = [];
  const res = {
    writeHead(status, headers) {
      calls.push({ status, headers });
    },
    end(body) {
      calls.push({ body });
    },
  };

  __test.send(res, { status: 204 });
  assert.equal(calls[0].status, 204);
  assert.deepEqual(calls[0].headers, {});
  assert.equal(calls[1].body, "");
});

test("server parseBody handles json and default branches", async () => {
  const reqJson = new EventEmitter();
  reqJson.headers = { "content-type": "application/json" };
  const jsonPromise = __test.parseBody(reqJson);
  reqJson.emit("data", Buffer.from('{"ok":true}'));
  reqJson.emit("end");
  const jsonBody = await jsonPromise;
  assert.equal(jsonBody.ok, true);

  const reqBadJson = new EventEmitter();
  reqBadJson.headers = { "content-type": "application/json" };
  const badPromise = __test.parseBody(reqBadJson);
  reqBadJson.emit("data", Buffer.from("{bad json"));
  reqBadJson.emit("end");
  const badBody = await badPromise;
  assert.deepEqual(badBody, {});

  const reqEmptyJson = new EventEmitter();
  reqEmptyJson.headers = { "content-type": "application/json" };
  const emptyPromise = __test.parseBody(reqEmptyJson);
  reqEmptyJson.emit("end");
  const emptyBody = await emptyPromise;
  assert.deepEqual(emptyBody, {});

  const reqMissingHeaders = new EventEmitter();
  const missingHeadersPromise = __test.parseBody(reqMissingHeaders);
  reqMissingHeaders.emit("data", Buffer.from("plain"));
  reqMissingHeaders.emit("end");
  const missingHeadersBody = await missingHeadersPromise;
  assert.deepEqual(missingHeadersBody, {});

  const reqDefault = new EventEmitter();
  reqDefault.headers = { "content-type": "text/plain" };
  const defaultPromise = __test.parseBody(reqDefault);
  reqDefault.emit("data", Buffer.from("plain"));
  reqDefault.emit("end");
  const defaultBody = await defaultPromise;
  assert.deepEqual(defaultBody, {});
});

test("server parseMultipartForm handles quoted boundary in content-type", () => {
  const boundary = "quoted-b";
  const raw = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="title"\r\n\r\n` +
      `Quoted boundary title\r\n` +
      `--${boundary}--\r\n`,
    "latin1"
  );

  const parsedQuoted = __test.parseMultipartForm(
    raw,
    `multipart/form-data; boundary="${boundary}"`
  );
  assert.equal(parsedQuoted.title, "Quoted boundary title");

  const parsedUnquoted = __test.parseMultipartForm(
    raw,
    `multipart/form-data; boundary=${boundary}`
  );
  assert.equal(parsedUnquoted.title, "Quoted boundary title");

  const parsedMissingBoundary = __test.parseMultipartForm(raw, "multipart/form-data");
  assert.deepEqual(parsedMissingBoundary, {});

  const parsedUndefinedContentType = __test.parseMultipartForm(raw, undefined);
  assert.deepEqual(parsedUndefinedContentType, {});
});

test("server resolvePort handles address fallback", () => {
  assert.equal(__test.resolvePort({ port: 1234 }, 3000), 1234);
  assert.equal(__test.resolvePort(null, 3000), 3000);
  assert.equal(__test.resolvePort("not-an-object", 3000), 3000);
});
