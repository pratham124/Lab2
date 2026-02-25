const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleGenerator } = require("../../src/services/schedule_generator");
const { createScheduleService } = require("../../src/services/schedule_service");
const { createScheduleController } = require("../../src/controllers/schedule_controller");

function acceptedPaper(id) {
  return { id, conferenceId: "C1", title: `Paper ${id}`, status: "accepted" };
}

function nonAcceptedPaper(id, status) {
  return { id, conferenceId: "C1", title: `Paper ${id}`, status };
}

function createHarness({
  papers,
  parameters,
  failSave = false,
  existingSchedule = null,
} = {}) {
  const state = {
    acceptedPapers: Array.isArray(papers)
      ? papers.slice()
      : [acceptedPaper("P1"), acceptedPaper("P2"), acceptedPaper("P3")],
    schedulingParameters: parameters || {
      conferenceDates: ["2026-04-10", "2026-04-11"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "12:00" },
      availableRoomIds: ["R1", "R2"],
    },
    failSave,
    scheduleByConference: new Map(),
  };

  if (existingSchedule) {
    state.scheduleByConference.set("C1", existingSchedule);
  }

  const storageAdapter = {
    listAcceptedPapers() {
      return state.acceptedPapers.slice();
    },
    getSchedulingParameters() {
      return state.schedulingParameters;
    },
    getSchedule({ conferenceId }) {
      return state.scheduleByConference.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      if (state.failSave) {
        const error = new Error("DB_WRITE_FAILURE");
        error.code = "DB_WRITE_FAILURE";
        throw error;
      }
      state.scheduleByConference.set(conferenceId, schedule);
      return schedule;
    },
  };

  const scheduleService = createScheduleService({
    storageAdapter,
    scheduleGenerator: createScheduleGenerator(),
  });

  const sessionMap = {
    sid_admin_a: { user_id: "admin_a", role: "admin" },
    sid_admin_b: { user_id: "admin_b", role: "admin" },
    sid_author: { user_id: "author_1", role: "author" },
    sid_editor: { user_id: "editor_1", role: "editor" },
  };

  const sessionService = {
    validate(sessionId) {
      return sessionMap[sessionId] || null;
    },
  };

  const scheduleController = createScheduleController({
    scheduleService,
    sessionService,
  });

  return {
    state,
    scheduleController,
    scheduleService,
    setAcceptedPapers(nextPapers) {
      state.acceptedPapers = nextPapers.slice();
    },
    getStoredSchedule() {
      return state.scheduleByConference.get("C1") || null;
    },
  };
}

function adminHeaders(sessionId = "sid_admin_a") {
  return {
    cookie: `cms_session=${sessionId}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

function nonAdminHeaders(sessionId = "sid_author") {
  return {
    cookie: `cms_session=${sessionId}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

function parseJson(response) {
  return JSON.parse(response.body);
}

function flattenPaperIdsFromSessions(sessions) {
  return sessions.flatMap((session) => session.paperIds || []);
}

test("AT-UC16-01 — Generate Schedule Successfully (Main Success Scenario)", async () => {
  const harness = createHarness({
    papers: [acceptedPaper("P3"), acceptedPaper("P1"), acceptedPaper("P2")],
  });

  const response = await harness.scheduleController.handleGenerate({
    headers: adminHeaders("sid_admin_a"),
    params: { conference_id: "C1" },
    body: { confirmReplace: false },
  });

  assert.equal(response.status, 200);
  const payload = parseJson(response);
  assert.equal(payload.status, "generated");

  const assignedIds = flattenPaperIdsFromSessions(payload.sessions);
  assert.deepEqual(new Set(assignedIds), new Set(["P1", "P2", "P3"]));
  assert.equal(assignedIds.length, 3);
  assert.equal(new Set(assignedIds).size, 3);

  const stored = harness.getStoredSchedule();
  assert.equal(Boolean(stored), true);
  assert.equal(stored.status, "generated");
});

test("AT-UC16-02 — Generated Schedule Persists and Can Be Re-Viewed", async () => {
  const harness = createHarness();

  const generated = await harness.scheduleController.handleGenerate({
    headers: adminHeaders("sid_admin_a"),
    params: { conference_id: "C1" },
    body: { confirmReplace: false },
  });
  assert.equal(generated.status, 200);

  const reread = await harness.scheduleController.handleGetSchedule({
    headers: adminHeaders("sid_admin_b"),
    params: { conference_id: "C1" },
  });

  assert.equal(reread.status, 200);
  const generatedPayload = parseJson(generated);
  const rereadPayload = parseJson(reread);
  assert.deepEqual(rereadPayload.schedule.sessions, generatedPayload.sessions);
});

test("AT-UC16-03 — Reject Generation When Required Parameters Missing (Extension 4a)", async () => {
  const harness = createHarness({
    parameters: {
      conferenceDates: ["2026-04-10"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "12:00" },
      availableRoomIds: [],
    },
  });

  const response = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: {},
  });

  assert.equal(response.status, 400);
  const payload = parseJson(response);
  assert.equal(payload.errorCode, "missing_parameters");
  assert.equal(payload.missing.includes("availableRoomIds"), true);
  assert.equal(harness.getStoredSchedule(), null);
});

test("AT-UC16-04 — Handle Unsatisfiable Constraints (Extension 5a)", async () => {
  const harness = createHarness({
    papers: [
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
    parameters: {
      conferenceDates: ["2026-04-10"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "10:00" },
      availableRoomIds: ["R1"],
    },
  });

  const response = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: {},
  });

  assert.equal(response.status, 409);
  const payload = parseJson(response);
  assert.equal(payload.errorCode, "unsatisfiable_constraints");
  assert.equal(harness.getStoredSchedule(), null);
});

test("AT-UC16-05 — Database Failure While Saving Generated Schedule (Extension 7a)", async () => {
  const existing = {
    id: "schedule_existing",
    conferenceId: "C1",
    status: "generated",
    sessions: [{ id: "session_existing", paperIds: ["P_KEEP"] }],
  };

  const harness = createHarness({
    existingSchedule: existing,
    failSave: true,
  });

  const response = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: { confirmReplace: true },
  });

  assert.equal(response.status, 500);
  const payload = parseJson(response);
  assert.equal(payload.errorCode, "save_failed");
  assert.equal(payload.message, "Schedule could not be saved.");
  assert.equal(payload.message.includes("DB_WRITE_FAILURE"), false);

  assert.deepEqual(harness.getStoredSchedule(), existing);
});

test("AT-UC16-06 — Authorization: Non-Admin Cannot Generate Schedule", async () => {
  const harness = createHarness();

  const generateResponse = await harness.scheduleController.handleGenerate({
    headers: nonAdminHeaders("sid_author"),
    params: { conference_id: "C1" },
    body: {},
  });
  assert.equal(generateResponse.status, 403);

  const viewResponse = await harness.scheduleController.handleGetSchedule({
    headers: nonAdminHeaders("sid_editor"),
    params: { conference_id: "C1" },
  });
  assert.equal(viewResponse.status, 403);

  assert.equal(harness.getStoredSchedule(), null);
});

test("AT-UC16-07 — Schedule Assigns Only Accepted Papers", async () => {
  const harness = createHarness({
    papers: [
      acceptedPaper("P1"),
      acceptedPaper("P2"),
      acceptedPaper("P3"),
      acceptedPaper("P4"),
      acceptedPaper("P5"),
      nonAcceptedPaper("P6", "rejected"),
      nonAcceptedPaper("P7", "submitted"),
      nonAcceptedPaper("P8", "pending"),
    ],
  });

  const response = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: {},
  });

  assert.equal(response.status, 200);
  const payload = parseJson(response);
  const assignedIds = flattenPaperIdsFromSessions(payload.sessions);

  assert.deepEqual(new Set(assignedIds), new Set(["P1", "P2", "P3", "P4", "P5"]));
  assert.equal(assignedIds.includes("P6"), false);
  assert.equal(assignedIds.includes("P7"), false);
  assert.equal(assignedIds.includes("P8"), false);
});

test("AT-UC16-08 — No Duplicate Paper Assignments in Schedule", async () => {
  const harness = createHarness({
    papers: [
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
    parameters: {
      conferenceDates: ["2026-04-10", "2026-04-11"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "15:00" },
      availableRoomIds: ["R1", "R2"],
    },
  });

  const response = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: {},
  });

  assert.equal(response.status, 200);
  const payload = parseJson(response);
  const assignedIds = flattenPaperIdsFromSessions(payload.sessions);

  assert.equal(assignedIds.length, 10);
  assert.equal(new Set(assignedIds).size, 10);
});

test("AT-UC16-09 — Idempotency / Re-Generate Behavior (If Supported)", async () => {
  const harness = createHarness({
    papers: [acceptedPaper("P1"), acceptedPaper("P2")],
  });

  const first = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: { confirmReplace: false },
  });
  assert.equal(first.status, 200);

  harness.setAcceptedPapers([acceptedPaper("P9")]);

  const secondWithoutConfirm = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: {},
  });
  assert.equal(secondWithoutConfirm.status, 409);

  const secondWithConfirm = await harness.scheduleController.handleGenerate({
    headers: adminHeaders(),
    params: { conference_id: "C1" },
    body: { confirmReplace: true },
  });
  assert.equal(secondWithConfirm.status, 200);

  const payload = parseJson(secondWithConfirm);
  const assignedIds = flattenPaperIdsFromSessions(payload.sessions);
  assert.deepEqual(assignedIds, ["P9"]);
});
