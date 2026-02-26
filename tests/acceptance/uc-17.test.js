const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleService } = require("../../src/services/schedule_service");
const { createScheduleEditController } = require("../../src/controllers/schedule_edit_controller");

function createBaseSchedule() {
  return {
    id: "schedule_c1",
    conferenceId: "C1",
    name: "Current Conference Schedule",
    status: "generated",
    version: "2026-02-10T00:00:00.000Z",
    lastUpdatedAt: "2026-02-10T00:00:00.000Z",
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
        sessionId: "S9",
        roomId: "R3",
        timeSlotId: "T3",
      },
    ],
  };
}

function createHarness({ failSave = false } = {}) {
  const state = {
    scheduleByConference: new Map([["C1", createBaseSchedule()]]),
    failSave,
    errorLog: [],
  };

  const storageAdapter = {
    getSchedule({ conferenceId }) {
      return state.scheduleByConference.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      if (state.failSave) {
        const error = new Error("DB_WRITE_FAILURE");
        state.errorLog.push({
          code: error.message,
          conferenceId,
          at: "2026-02-25T00:00:00.000Z",
        });
        throw error;
      }
      state.scheduleByConference.set(conferenceId, schedule);
      return schedule;
    },
    listAcceptedPapers() {
      return [];
    },
    getSchedulingParameters() {
      return {};
    },
  };

  const scheduleService = createScheduleService({
    storageAdapter,
    scheduleGenerator: {
      generate() {
        return { type: "success", schedule: createBaseSchedule() };
      },
    },
  });

  const sessionService = {
    validate(sessionId) {
      const sessions = {
        sid_editor_1: { user_id: "E1", role: "editor" },
        sid_editor_2: { user_id: "E2", role: "editor" },
        sid_author_1: { user_id: "A1", role: "author" },
      };
      return sessions[sessionId] || null;
    },
  };

  const scheduleEditController = createScheduleEditController({
    scheduleService,
    sessionService,
  });

  return {
    state,
    scheduleEditController,
    removeItem(itemId) {
      const current = state.scheduleByConference.get("C1");
      current.items = current.items.filter((item) => item.id !== itemId);
      state.scheduleByConference.set("C1", current);
    },
    getCurrentSchedule() {
      return state.scheduleByConference.get("C1");
    },
  };
}

function headers(sessionId) {
  return {
    cookie: `cms_session=${sessionId}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

function parseJson(response) {
  return JSON.parse(response.body);
}

function getItem(schedule, itemId) {
  return schedule.items.find((item) => item.id === itemId) || null;
}

test("AT-UC17-01 — Edit a Schedule Item Successfully (Main Success Scenario)", async () => {
  const harness = createHarness();

  const before = await harness.scheduleEditController.handleGetCurrentSchedule({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1" },
  });
  assert.equal(before.status, 200);

  const selected = await harness.scheduleEditController.handleGetScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
  });
  assert.equal(selected.status, 200);

  const save = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });

  assert.equal(save.status, 200);
  const savedPayload = parseJson(save);
  assert.equal(savedPayload.message, "Schedule updated successfully.");

  const moved = getItem(savedPayload.schedule, "I1");
  assert.equal(moved.sessionId, "S2");
  assert.equal(moved.roomId, "R2");
  assert.equal(moved.timeSlotId, "T2");

  const reread = await harness.scheduleEditController.handleGetCurrentSchedule({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1" },
  });
  assert.equal(reread.status, 200);
  assert.equal(reread.headers["Cache-Control"], "no-store, max-age=0");
  const rereadPayload = parseJson(reread);
  const rereadItem = getItem(rereadPayload.schedule, "I1");
  assert.equal(rereadItem.sessionId, "S2");
  assert.equal(rereadItem.roomId, "R2");
  assert.equal(rereadItem.timeSlotId, "T2");
});

test("AT-UC17-02 — Persist Changes Across Sessions", async () => {
  const harness = createHarness();

  const save = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(save.status, 200);

  const reread = await harness.scheduleEditController.handleGetCurrentSchedule({
    headers: headers("sid_editor_2"),
    params: { conference_id: "C1" },
  });
  assert.equal(reread.status, 200);

  const item = getItem(parseJson(reread).schedule, "I1");
  assert.equal(item.sessionId, "S2");
  assert.equal(item.roomId, "R2");
  assert.equal(item.timeSlotId, "T2");
});

test("AT-UC17-03 — Block Save When Edit Introduces a Conflict (Extension 6a)", async () => {
  const harness = createHarness();

  const current = harness.getCurrentSchedule();
  current.items.push({
    id: "I3",
    scheduleId: "schedule_c1",
    paperId: "P3",
    sessionId: "S3",
    roomId: "R1",
    timeSlotId: "T1",
  });
  harness.state.scheduleByConference.set("C1", current);

  const blocked = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S8",
      roomId: "R1",
      timeSlotId: "T1",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });

  assert.equal(blocked.status, 409);
  const payload = parseJson(blocked);
  assert.equal(payload.errorCode, "CONFLICT");
  assert.equal(payload.summary, "Room/time slot is already occupied.");

  const unchanged = getItem(harness.getCurrentSchedule(), "I1");
  assert.equal(unchanged.roomId, "R1");
  assert.equal(unchanged.timeSlotId, "T1");
});

test("AT-UC17-04 — Conflict Message Is Actionable", async () => {
  const harness = createHarness();

  const current = harness.getCurrentSchedule();
  current.items.push({
    id: "I3",
    scheduleId: "schedule_c1",
    paperId: "P3",
    sessionId: "S3",
    roomId: "R1",
    timeSlotId: "T1",
  });
  harness.state.scheduleByConference.set("C1", current);

  const blocked = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S8",
      roomId: "R1",
      timeSlotId: "T1",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });

  assert.equal(blocked.status, 409);
  const payload = parseJson(blocked);
  assert.equal(payload.errorCode, "CONFLICT");
  assert.equal(typeof payload.summary, "string");
  assert.equal(payload.summary.length > 0, true);
  assert.equal(payload.affectedItemId, "I1");
  assert.equal(Array.isArray(payload.conflicts), true);
  assert.equal(payload.conflicts.includes("I3"), true);
  assert.equal(typeof payload.recommendedAction, "string");
  assert.equal(payload.recommendedAction.includes("Choose a different room or time slot."), true);
  assert.equal(payload.summary.includes("Error:"), false);
  assert.equal(payload.summary.includes("DB_WRITE_FAILURE"), false);
});

test("AT-UC17-05 — Handle System/Database Failure While Saving (Extension 7a)", async () => {
  const harness = createHarness({ failSave: true });

  const failed = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });

  assert.equal(failed.status, 500);
  const payload = parseJson(failed);
  assert.equal(payload.errorCode, "SAVE_FAILED");
  assert.equal(payload.summary, "Schedule save failed due to an internal error.");
  assert.equal(payload.recommendedAction, "Retry the save or refresh the schedule.");
  assert.equal(payload.summary.includes("DB_WRITE_FAILURE"), false);

  assert.equal(harness.state.errorLog.length, 1);
  assert.equal(harness.state.errorLog[0].code, "DB_WRITE_FAILURE");

  const unchanged = getItem(harness.getCurrentSchedule(), "I1");
  assert.equal(unchanged.sessionId, "S1");
  assert.equal(unchanged.roomId, "R1");
  assert.equal(unchanged.timeSlotId, "T1");
});

test("AT-UC17-06 — Editing Non-Existent Schedule Element (Extension 4a)", async () => {
  const harness = createHarness();

  const selected = await harness.scheduleEditController.handleGetScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
  });
  assert.equal(selected.status, 200);

  harness.removeItem("I1");

  const failed = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });

  assert.equal(failed.status, 404);
  const payload = parseJson(failed);
  assert.equal(payload.errorCode, "ITEM_NOT_FOUND");
  assert.equal(payload.summary, "Selected schedule item cannot be edited.");

  const current = await harness.scheduleEditController.handleGetCurrentSchedule({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1" },
  });
  assert.equal(current.status, 200);
});

test("AT-UC17-07 — Authorization: Non-Editor Cannot Edit Schedule", async () => {
  const harness = createHarness();

  const read = await harness.scheduleEditController.handleGetCurrentSchedule({
    headers: headers("sid_author_1"),
    params: { conference_id: "C1" },
  });
  assert.equal(read.status, 200);
  const readPayload = parseJson(read);
  assert.equal(readPayload.canEdit, false);
  assert.equal(readPayload.controlsDisabled, true);

  const blocked = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_author_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(blocked.status, 403);

  const unchanged = getItem(harness.getCurrentSchedule(), "I1");
  assert.equal(unchanged.sessionId, "S1");
  assert.equal(unchanged.roomId, "R1");
  assert.equal(unchanged.timeSlotId, "T1");
});

test("AT-UC17-08 — Prevent Duplicate/Overlapping Edits From Double-Save", async () => {
  const harness = createHarness();

  const first = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(first.status, 200);

  const second = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(second.status, 200);

  const current = harness.getCurrentSchedule();
  const ids = current.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const moved = getItem(current, "I1");
  assert.equal(moved.roomId, "R2");
  assert.equal(moved.timeSlotId, "T2");
});

test("AT-UC17-09 — Block Stale Edit When Schedule Changed Since Load", async () => {
  const harness = createHarness();

  const loaded = await harness.scheduleEditController.handleGetCurrentSchedule({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1" },
  });
  assert.equal(loaded.status, 200);

  const externalUpdate = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_2"),
    params: { conference_id: "C1", item_id: "I2" },
    body: {
      sessionId: "S5",
      roomId: "R5",
      timeSlotId: "T5",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(externalUpdate.status, 200);

  const staleSave = await harness.scheduleEditController.handleUpdateScheduleItem({
    headers: headers("sid_editor_1"),
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });

  assert.equal(staleSave.status, 409);
  const payload = parseJson(staleSave);
  assert.equal(payload.errorCode, "STALE_EDIT");
  assert.equal(payload.recommendedAction, "Refresh and retry the edit.");

  const unchanged = getItem(harness.getCurrentSchedule(), "I1");
  assert.equal(unchanged.roomId, "R1");
  assert.equal(unchanged.timeSlotId, "T1");
});
