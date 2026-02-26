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

    const responseChunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
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
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resolve({
        status: res.statusCode || 200,
        headers: res.headers || {},
        body: Buffer.concat(responseChunks).toString("utf8"),
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

function createHarness({ failScheduleSave = false } = {}) {
  const store = {
    acceptedPapersByConference: new Map(),
    schedulingParametersByConference: new Map(),
    scheduleByConference: new Map([
      [
        "C1",
        {
          id: "schedule_c1",
          conferenceId: "C1",
          status: "generated",
          lastUpdatedAt: "2026-02-10T00:00:00.000Z",
          version: "2026-02-10T00:00:00.000Z",
          items: [
            {
              id: "I1",
              scheduleId: "schedule_c1",
              paperId: "P1",
              sessionId: "S1",
              roomId: "R1",
              timeSlotId: "T1",
            },
            {
              id: "I2",
              scheduleId: "schedule_c1",
              paperId: "P2",
              sessionId: "S2",
              roomId: "R2",
              timeSlotId: "T2",
            },
          ],
        },
      ],
    ]),
    failScheduleSave,
  };

  const { server } = createAppServer({
    store,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_editor") {
          return { user_id: "editor_1", role: "editor" };
        }
        if (sessionId === "sid_editor_2") {
          return { user_id: "editor_2", role: "editor" };
        }
        if (sessionId === "sid_author") {
          return { user_id: "author_1", role: "author" };
        }
        return null;
      },
    },
  });

  return { server, store };
}

function jsonHeaders(sessionId) {
  return {
    cookie: `cms_session=${sessionId}`,
    accept: "application/json",
    "content-type": "application/json",
    host: "localhost",
  };
}

function parseJson(response) {
  return JSON.parse(response.body);
}

test("UC-17 integration happy path persists and is immediately visible", async () => {
  const harness = createHarness();

  const before = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/current?conferenceId=C1",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(before.status, 200);
  assert.equal(before.headers["Cache-Control"], "no-store, max-age=0");

  const updated = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );

  assert.equal(updated.status, 200);
  const payload = parseJson(updated);
  const moved = payload.schedule.items.find((item) => item.id === "I1");
  assert.equal(moved.roomId, "R3");

  const reread = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/current?conferenceId=C1",
    headers: jsonHeaders("sid_editor_2"),
  });
  assert.equal(reread.status, 200);
  const rereadPayload = parseJson(reread);
  assert.equal(rereadPayload.schedule.items.find((item) => item.id === "I1").roomId, "R3");
});

test("UC-17 integration happy path supports item fetch endpoint before and after update", async () => {
  const harness = createHarness();

  const beforeItem = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/items/I1?conferenceId=C1",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(beforeItem.status, 200);
  assert.equal(parseJson(beforeItem).item.roomId, "R1");

  const updated = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );
  assert.equal(updated.status, 200);

  const afterItem = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/items/I1?conferenceId=C1",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(afterItem.status, 200);
  assert.equal(afterItem.headers["Cache-Control"], "no-store, max-age=0");
  assert.equal(parseJson(afterItem).item.roomId, "R3");
});

test("UC-17 integration invalid input: missing required update token is rejected", async () => {
  const harness = createHarness();

  const invalid = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
    })
  );

  assert.equal(invalid.status, 409);
  const payload = parseJson(invalid);
  assert.equal(payload.errorCode, "STALE_EDIT");
  assert.equal(payload.recommendedAction, "Refresh and retry the edit.");

  const reread = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/current?conferenceId=C1",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(reread.status, 200);
  assert.equal(parseJson(reread).schedule.items.find((item) => item.id === "I1").roomId, "R1");
});

test("UC-17 integration blocks conflict and stale-edit saves", async () => {
  const harness = createHarness();

  const conflict = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );

  assert.equal(conflict.status, 409);
  assert.equal(parseJson(conflict).errorCode, "CONFLICT");

  const stale = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2000-01-01T00:00:00.000Z",
    })
  );

  assert.equal(stale.status, 409);
  assert.equal(parseJson(stale).errorCode, "STALE_EDIT");
});

test("UC-17 integration expected failure: missing conference schedule returns not found", async () => {
  const harness = createHarness();

  const missingSchedule = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/current?conferenceId=UNKNOWN",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(missingSchedule.status, 404);
  assert.equal(parseJson(missingSchedule).errorCode, "SCHEDULE_NOT_FOUND");
});

test("UC-17 integration server routes default conferenceId to C1 when query param omitted", async () => {
  const harness = createHarness();

  const current = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/current",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(current.status, 200);

  const item = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/items/I1",
    headers: jsonHeaders("sid_editor"),
  });
  assert.equal(item.status, 200);

  const updated = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S4",
      roomId: "R4",
      timeSlotId: "T4",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );
  assert.equal(updated.status, 200);
  assert.equal(parseJson(updated).schedule.items.find((entry) => entry.id === "I1").roomId, "R4");
});

test("UC-17 integration blocks non-editors and handles missing-item path", async () => {
  const harness = createHarness();

  const denied = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_author"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );
  assert.equal(denied.status, 403);

  const missing = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/items/DOES_NOT_EXIST?conferenceId=C1",
    headers: jsonHeaders("sid_editor"),
  });

  assert.equal(missing.status, 404);
  assert.equal(parseJson(missing).errorCode, "ITEM_NOT_FOUND");

  const missingUpdate = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/DOES_NOT_EXIST?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );

  assert.equal(missingUpdate.status, 404);
  assert.equal(parseJson(missingUpdate).errorCode, "ITEM_NOT_FOUND");
});

test("UC-17 integration returns SAVE_FAILED without partial updates", async () => {
  const harness = createHarness({ failScheduleSave: true });

  const failed = await injectRequest(
    harness.server,
    {
      method: "PUT",
      path: "/schedule/items/I1?conferenceId=C1",
      headers: jsonHeaders("sid_editor"),
    },
    JSON.stringify({
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    })
  );

  assert.equal(failed.status, 500);
  assert.equal(parseJson(failed).errorCode, "SAVE_FAILED");

  const reread = await injectRequest(harness.server, {
    method: "GET",
    path: "/schedule/current?conferenceId=C1",
    headers: jsonHeaders("sid_editor"),
  });

  assert.equal(reread.status, 200);
  assert.equal(parseJson(reread).schedule.items.find((item) => item.id === "I1").roomId, "R1");
});
