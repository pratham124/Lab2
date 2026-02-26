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

function adminHeaders() {
  return {
    host: "localhost",
    cookie: "cms_session=sid_admin",
    accept: "application/json",
    "content-type": "application/json",
  };
}

function makeSessionService() {
  return {
    validate(sessionId) {
      if (sessionId === "sid_admin") {
        return { user_id: "admin_1", role: "admin" };
      }
      return null;
    },
  };
}

async function generateSchedule(server) {
  const response = await injectRequest(
    server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: adminHeaders(),
    },
    JSON.stringify({ confirmReplace: true })
  );
  assert.equal(response.status, 200);
}

async function publishSchedule(server) {
  const response = await injectRequest(server, {
    method: "POST",
    path: "/api/admin/schedule/publish",
    headers: {
      host: "localhost",
      cookie: "cms_session=sid_admin",
      accept: "application/json",
    },
  });
  assert.equal(response.status, 200);
}

test("UC-19 integration happy path: public page + published endpoint return schedule entries", async () => {
  const { server } = createAppServer({ sessionService: makeSessionService() });

  await generateSchedule(server);
  await publishSchedule(server);

  const page = await injectRequest(server, {
    method: "GET",
    path: "/schedule",
    headers: { host: "localhost", accept: "text/html" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Conference C1 Schedule"), true);

  const api = await injectRequest(server, {
    method: "GET",
    path: "/schedule/published",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(api.status, 200);
  const payload = JSON.parse(api.body);
  assert.equal(payload.status, "published");
  assert.equal(Array.isArray(payload.entries), true);
  assert.equal(payload.entries.length > 0, true);
  assert.equal(payload.entries.every((entry) => entry.timeSlot && entry.location), true);
});

test("UC-19 integration invalid input: unknown conference and no-match filters handled safely", async () => {
  const { server } = createAppServer({ sessionService: makeSessionService() });

  await generateSchedule(server);
  await publishSchedule(server);

  const unknownConference = await injectRequest(server, {
    method: "GET",
    path: "/schedule/published?conferenceId=UNKNOWN",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(unknownConference.status, 404);
  const unknownPayload = JSON.parse(unknownConference.body);
  assert.equal(unknownPayload.canRetry, false);

  const noMatchFilters = await injectRequest(server, {
    method: "GET",
    path: "/schedule/published?day=2099-01-01&session=missing",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(noMatchFilters.status, 200);
  const noMatchPayload = JSON.parse(noMatchFilters.body);
  assert.deepEqual(noMatchPayload.entries, []);
  assert.equal(noMatchPayload.viewState, "no_results");
});

test("UC-19 integration failure paths: unpublished=404 and retrieval failure=503 with retry", async () => {
  const { server: unpublishedServer } = createAppServer();
  const unpublished = await injectRequest(unpublishedServer, {
    method: "GET",
    path: "/schedule/published",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(unpublished.status, 404);
  const unpublishedPayload = JSON.parse(unpublished.body);
  assert.equal(unpublishedPayload.canRetry, false);

  const { server: failureServer } = createAppServer({
    scheduleController: {
      async handleGenerate() {
        return { status: 501, headers: {}, body: "" };
      },
      async handleGetSchedule() {
        return { status: 501, headers: {}, body: "" };
      },
      async handleGetPublishedPage() {
        return { status: 200, headers: { "Content-Type": "text/html" }, body: "<html></html>" };
      },
      async handleGetPublished() {
        return {
          status: 503,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Schedule is temporarily unavailable. Please try again.",
            canRetry: true,
          }),
        };
      },
    },
  });

  const unavailable = await injectRequest(failureServer, {
    method: "GET",
    path: "/schedule/published",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(unavailable.status, 503);
  const unavailablePayload = JSON.parse(unavailable.body);
  assert.equal(unavailablePayload.canRetry, true);
  assert.equal(typeof unavailablePayload.message, "string");
});
