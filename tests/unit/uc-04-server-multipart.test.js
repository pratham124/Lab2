const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { createAppServer, __test } = require("../../src/server");

function makeMultipartBody(boundary) {
  return Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="title"\r\n\r\n` +
      `Example Title\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="manuscript"; filename="paper.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n` +
      `PDFDATA\r\n` +
      `--${boundary}--\r\n`,
    "latin1"
  );
}

test("server.parseMultipartForm covers boundary missing and mixed fields", () => {
  assert.deepEqual(__test.parseMultipartForm(Buffer.from("x"), "multipart/form-data"), {});

  const boundary = "boundary123";
  const parsed = __test.parseMultipartForm(
    makeMultipartBody(boundary),
    `multipart/form-data; boundary=${boundary}`
  );

  assert.equal(parsed.title, "Example Title");
  assert.equal(parsed.manuscript.filename, "paper.pdf");
  assert.equal(parsed.manuscript.sizeBytes, 7);
  assert.equal(Buffer.isBuffer(parsed.manuscript.contentBuffer), true);
});

test("server.parseBody covers multipart path and error event branch", async () => {
  const boundary = "boundaryXYZ";
  const reqMultipart = new EventEmitter();
  reqMultipart.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  const multipartPromise = __test.parseBody(reqMultipart);
  reqMultipart.emit("data", makeMultipartBody(boundary));
  reqMultipart.emit("end");
  const multipartParsed = await multipartPromise;

  assert.equal(multipartParsed.title, "Example Title");
  assert.equal(multipartParsed.manuscript.filename, "paper.pdf");

  const reqError = new EventEmitter();
  reqError.headers = {};
  const errorPromise = __test.parseBody(reqError);
  reqError.emit("error", new Error("network"));
  const errorResult = await errorPromise;
  assert.equal(errorResult.__parse_error, "upload_interrupted");
});

test("server.parseBody multipart catch branch returns upload_interrupted", async () => {
  const originalToString = Buffer.prototype.toString;
  Buffer.prototype.toString = function patchedToString(encoding, ...rest) {
    if (encoding === "latin1") {
      throw new Error("latin1 parse failure");
    }
    return originalToString.call(this, encoding, ...rest);
  };

  try {
    const boundary = "boundaryThrow";
    const req = new EventEmitter();
    req.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
    const promise = __test.parseBody(req);
    req.emit("data", makeMultipartBody(boundary));
    req.emit("end");
    const parsed = await promise;
    assert.equal(parsed.__parse_error, "upload_interrupted");
  } finally {
    Buffer.prototype.toString = originalToString;
  }
});

test("server.parseMultipartForm covers divider/disposition/name continue branches", () => {
  const boundary = "boundarySkip";
  const raw = Buffer.from(
    `--${boundary}\r\n` +
      `just-text-without-divider\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `value-without-disposition\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; random="value"\r\n\r\n` +
      `body-without-name\r\n` +
      `--${boundary}--\r\n`,
    "latin1"
  );

  const parsed = __test.parseMultipartForm(raw, `multipart/form-data; boundary=${boundary}`);
  assert.deepEqual(parsed, {});
});

test("server.parseMultipartForm covers quoted boundary and empty filename fallback", () => {
  const boundary = "quotedBoundary";
  const raw = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="manuscript"; filename=""\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n` +
      `X\r\n` +
      `--${boundary}--\r\n`,
    "latin1"
  );

  const parsed = __test.parseMultipartForm(raw, `multipart/form-data; boundary="${boundary}"`);
  assert.equal(typeof parsed.manuscript, "object");
  assert.equal(parsed.manuscript.filename, "");
  assert.equal(parsed.manuscript.sizeBytes, 1);
});

function sendServerRequest(server, { method = "GET", path = "/" } = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = path;
    req.headers = { host: "127.0.0.1:3000" };

    const result = {
      status: null,
      headers: null,
      body: null,
    };
    const res = {
      writeHead(status, headers) {
        result.status = status;
        result.headers = headers;
      },
      end(body) {
        result.body = body;
        resolve(result);
      },
    };

    server.emit("request", req, res);
    req.emit("end");
  });
}

test("server serves UC-04 static assets routes", async () => {
  const { server } = createAppServer();
  const css = await sendServerRequest(server, { path: "/css/submission.css" });
  assert.equal(css.status, 200);
  assert.equal(css.headers["Content-Type"], "text/css");

  const js = await sendServerRequest(server, { path: "/js/submission.js" });
  assert.equal(js.status, 200);
  assert.equal(js.headers["Content-Type"], "application/javascript");
});

test("server serves register javascript asset route", async () => {
  const { server } = createAppServer();
  const js = await sendServerRequest(server, { path: "/js/register.js" });
  assert.equal(js.status, 200);
  assert.equal(js.headers["Content-Type"], "application/javascript");
});
