const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const { createAppServer, startServer, __test } = require("../../src/server");
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

test("server serves registration page and static assets", async () => {
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

test("server returns 404 for missing static assets", async () => {
  await withServer(async (baseUrl) => {
    const missing = await requestRaw(baseUrl, { path: "/css/missing.css" });
    assert.equal(missing.status, 404);
    assert.equal(missing.body, "Not found");
  });
});

test("server uses memory store duplicate branch and failure logger", () => {
  const { store } = createAppServer();
  const user = { email: "dup@example.com" };
  store.createUserAccount(user);
  assert.throws(() => store.createUserAccount(user), /Email already exists/);
  store.recordRegistrationFailure({ id: "fail" });
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

test("server serveStatic 404 branch when asset missing", async () => {
  const cssPath = path.join(__dirname, "..", "..", "public", "css", "register.css");
  const backupPath = `${cssPath}.bak`;
  fs.renameSync(cssPath, backupPath);
  try {
    await withServer(async (baseUrl) => {
      const response = await requestRaw(baseUrl, { path: "/css/register.css" });
      assert.equal(response.status, 404);
      assert.equal(response.body, "Not found");
    });
  } finally {
    fs.renameSync(backupPath, cssPath);
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

test("server resolvePort handles address fallback", () => {
  assert.equal(__test.resolvePort({ port: 1234 }, 3000), 1234);
  assert.equal(__test.resolvePort(null, 3000), 3000);
  assert.equal(__test.resolvePort("not-an-object", 3000), 3000);
});
