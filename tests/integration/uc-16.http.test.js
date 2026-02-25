const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
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

function acceptedPaper(id) {
  return { id, conferenceId: "C1", title: `Paper ${id}`, status: "accepted" };
}

function nonAcceptedPaper(id, status) {
  return { id, conferenceId: "C1", title: `Paper ${id}`, status };
}

function createHarness({
  acceptedPapers,
  schedulingParameters,
  existingSchedule,
  failScheduleSave = false,
} = {}) {
  const store = {
    acceptedPapersByConference: new Map([
      [
        "C1",
        acceptedPapers || [acceptedPaper("P1"), acceptedPaper("P2"), acceptedPaper("P3")],
      ],
    ]),
    schedulingParametersByConference: new Map([
      [
        "C1",
        schedulingParameters || {
          conferenceDates: ["2026-06-01", "2026-06-02"],
          sessionLengthMinutes: 60,
          dailyTimeWindow: { start: "09:00", end: "12:00" },
          availableRoomIds: ["R1", "R2"],
        },
      ],
    ]),
    scheduleByConference: new Map(),
    failScheduleSave,
  };

  if (existingSchedule) {
    store.scheduleByConference.set("C1", existingSchedule);
  }

  const { server } = createAppServer({
    store,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_admin") {
          return { user_id: "admin_1", role: "admin" };
        }
        if (sessionId === "sid_admin_2") {
          return { user_id: "admin_2", role: "admin" };
        }
        if (sessionId === "sid_author") {
          return { user_id: "author_1", role: "author" };
        }
        return null;
      },
    },
  });

  return {
    server,
    store,
  };
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

test("UC-16 integration happy path: admin generates schedule, schedule persists, and can be re-viewed", async () => {
  const harness = createHarness({
    acceptedPapers: [acceptedPaper("P3"), acceptedPaper("P1"), acceptedPaper("P2")],
  });

  const generated = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({ confirmReplace: false })
  );

  assert.equal(generated.status, 200);
  const generatedPayload = parseJson(generated);
  assert.equal(generatedPayload.status, "generated");

  const paperOrder = generatedPayload.sessions.map((session) => session.paperIds[0]);
  assert.deepEqual(paperOrder, ["P1", "P2", "P3"]);

  const reread = await injectRequest(harness.server, {
    method: "GET",
    path: "/admin/conferences/C1/schedule",
    headers: jsonHeaders("sid_admin_2"),
  });

  assert.equal(reread.status, 200);
  const rereadPayload = parseJson(reread);
  assert.deepEqual(rereadPayload.schedule.sessions, generatedPayload.sessions);
});

test("UC-16 integration invalid input/setup path: missing scheduling parameters returns 400 and nothing is stored", async () => {
  const harness = createHarness({
    schedulingParameters: {
      conferenceDates: ["2026-06-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "12:00" },
      availableRoomIds: [],
    },
  });

  const generate = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({})
  );

  assert.equal(generate.status, 400);
  const payload = parseJson(generate);
  assert.equal(payload.errorCode, "missing_parameters");
  assert.equal(payload.missing.includes("availableRoomIds"), true);

  const getAfterFailure = await injectRequest(harness.server, {
    method: "GET",
    path: "/admin/conferences/C1/schedule",
    headers: jsonHeaders("sid_admin"),
  });

  assert.equal(getAfterFailure.status, 404);
});

test("UC-16 integration expected failure path: unsatisfiable constraints returns 409 and no final schedule", async () => {
  const harness = createHarness({
    acceptedPapers: [
      acceptedPaper("P1"),
      acceptedPaper("P2"),
      acceptedPaper("P3"),
      acceptedPaper("P4"),
      acceptedPaper("P5"),
      acceptedPaper("P6"),
      acceptedPaper("P7"),
      acceptedPaper("P8"),
      acceptedPaper("P9"),
      acceptedPaper("P10"),
    ],
    schedulingParameters: {
      conferenceDates: ["2026-06-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "10:00" },
      availableRoomIds: ["R1"],
    },
  });

  const generate = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({})
  );

  assert.equal(generate.status, 409);
  const payload = parseJson(generate);
  assert.equal(payload.errorCode, "unsatisfiable_constraints");

  const getAfterFailure = await injectRequest(harness.server, {
    method: "GET",
    path: "/admin/conferences/C1/schedule",
    headers: jsonHeaders("sid_admin"),
  });

  assert.equal(getAfterFailure.status, 404);
});

test("UC-16 integration expected failure path: save error returns 500 and existing schedule remains unchanged", async () => {
  const existing = {
    id: "schedule_existing",
    conferenceId: "C1",
    status: "generated",
    sessions: [{ id: "session_existing", paperIds: ["P_KEEP"] }],
  };

  const harness = createHarness({
    existingSchedule: existing,
    failScheduleSave: true,
  });

  const generate = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({ confirmReplace: true })
  );

  assert.equal(generate.status, 500);
  const payload = parseJson(generate);
  assert.equal(payload.errorCode, "save_failed");

  const reread = await injectRequest(harness.server, {
    method: "GET",
    path: "/admin/conferences/C1/schedule",
    headers: jsonHeaders("sid_admin"),
  });

  assert.equal(reread.status, 200);
  const rereadPayload = parseJson(reread);
  assert.deepEqual(rereadPayload.schedule, existing);
});

test("UC-16 integration expected failure path: non-admin forbidden; confirmReplace flow enforces conflict then replacement", async () => {
  const harness = createHarness({
    acceptedPapers: [
      acceptedPaper("P1"),
      acceptedPaper("P2"),
      nonAcceptedPaper("P3", "rejected"),
    ],
  });

  const forbiddenGenerate = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_author"),
    },
    JSON.stringify({})
  );
  assert.equal(forbiddenGenerate.status, 403);

  const forbiddenView = await injectRequest(harness.server, {
    method: "GET",
    path: "/admin/conferences/C1/schedule",
    headers: jsonHeaders("sid_author"),
  });
  assert.equal(forbiddenView.status, 403);

  const firstGenerate = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({})
  );
  assert.equal(firstGenerate.status, 200);

  const secondWithoutConfirm = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({})
  );
  assert.equal(secondWithoutConfirm.status, 409);
  assert.equal(parseJson(secondWithoutConfirm).errorCode, "confirm_replace_required");

  const secondWithConfirm = await injectRequest(
    harness.server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: jsonHeaders("sid_admin"),
    },
    JSON.stringify({ confirmReplace: true })
  );
  assert.equal(secondWithConfirm.status, 200);

  const payload = parseJson(secondWithConfirm);
  const scheduledPaperIds = payload.sessions.flatMap((session) => session.paperIds);
  assert.deepEqual(new Set(scheduledPaperIds), new Set(["P1", "P2"]));
  assert.equal(scheduledPaperIds.includes("P3"), false);
});
