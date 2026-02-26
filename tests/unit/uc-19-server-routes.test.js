const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");

function injectRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const reqBody = body ? Buffer.from(body, "utf8") : Buffer.alloc(0);
    let sent = false;

    const req = new Readable({
      read() {
        if (sent) {
          return;
        }
        sent = true;
        if (reqBody.length > 0) {
          this.push(reqBody);
        }
        this.push(null);
      },
    });

    req.method = options.method || "GET";
    req.url = options.path;
    req.headers = options.headers || {};

    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        callback();
      },
    });

    res.writeHead = function writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers || {};
      return res;
    };

    res.end = function end(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resolve({
        status: res.statusCode || 200,
        headers: res.headers || {},
        body: Buffer.concat(chunks).toString("utf8"),
      });
      return res;
    };

    try {
      server.emit("request", req, res);
    } catch (error) {
      reject(error);
    }
  });
}

test("server UC-19 routes map /schedule and /schedule/published with query params", async () => {
  const calls = [];
  const { server } = createAppServer({
    scheduleController: {
      async handleGenerate() {
        return { status: 501, headers: {}, body: "" };
      },
      async handleGetSchedule() {
        return { status: 501, headers: {}, body: "" };
      },
      async handleGetPublishedPage(input) {
        calls.push({ route: "page", input });
        return {
          status: 200,
          headers: { "Content-Type": "text/html" },
          body: "<html>ok</html>",
        };
      },
      async handleGetPublished(input) {
        calls.push({ route: "published", input });
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published", entries: [] }),
        };
      },
    },
  });

  const page = await injectRequest(server, {
    method: "GET",
    path: "/schedule",
    headers: { host: "localhost", accept: "text/html" },
  });
  assert.equal(page.status, 200);

  const api = await injectRequest(server, {
    method: "GET",
    path: "/schedule/published?conferenceId=C77&day=2026-04-10&session=session_1",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(api.status, 200);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].route, "page");
  assert.equal(calls[1].route, "published");
  assert.equal(calls[1].input.query.conferenceId, "C77");
  assert.equal(calls[1].input.query.day, "2026-04-10");
  assert.equal(calls[1].input.query.session, "session_1");
});

test("server UC-19 static asset routes serve schedule assets", async () => {
  const { server } = createAppServer();

  const css = await injectRequest(server, {
    method: "GET",
    path: "/css/schedule_view.css",
    headers: { host: "localhost" },
  });
  assert.equal(css.status, 200);

  const reviewJs = await injectRequest(server, {
    method: "GET",
    path: "/js/review-invitations.js",
    headers: { host: "localhost" },
  });
  assert.equal(reviewJs.status, 200);

  const clientJs = await injectRequest(server, {
    method: "GET",
    path: "/js/http_client.js",
    headers: { host: "localhost" },
  });
  assert.equal(clientJs.status, 200);

  const viewJs = await injectRequest(server, {
    method: "GET",
    path: "/js/schedule_view.js",
    headers: { host: "localhost" },
  });
  assert.equal(viewJs.status, 200);
});
