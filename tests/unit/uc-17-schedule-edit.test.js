const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleService } = require("../../src/services/schedule_service");
const { createScheduleEditController } = require("../../src/controllers/schedule_edit_controller");

function makeStorage({ schedule, failSave = false } = {}) {
  const scheduleMap = new Map([["C1", schedule]]);
  return {
    getSchedule({ conferenceId }) {
      return scheduleMap.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule: next }) {
      if (failSave) {
        throw new Error("save_failed");
      }
      scheduleMap.set(conferenceId, next);
      return next;
    },
    listAcceptedPapers() {
      return [];
    },
    getSchedulingParameters() {
      return {};
    },
  };
}

function makeSchedule() {
  return {
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
  };
}

test("UC-17 service updates schedule item and supports idempotent double-submit", () => {
  const service = createScheduleService({
    storageAdapter: makeStorage({ schedule: makeSchedule() }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });

  const update = {
    sessionId: "S3",
    roomId: "R3",
    timeSlotId: "T3",
    lastUpdatedAt: "2026-02-10T00:00:00.000Z",
  };

  const first = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: "I1",
    update,
    actorId: "editor_1",
  });
  assert.equal(first.type, "success");
  assert.equal(first.item.roomId, "R3");

  const second = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: "I1",
    update,
    actorId: "editor_1",
  });
  assert.equal(second.type, "success");
  assert.equal(second.item.roomId, "R3");
});

test("UC-17 service blocks conflicts and stale edits", () => {
  const service = createScheduleService({
    storageAdapter: makeStorage({ schedule: makeSchedule() }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });

  const conflict = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: "I1",
    update: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
    actorId: "editor_1",
  });
  assert.equal(conflict.type, "conflict");
  assert.equal(conflict.payload.errorCode, "CONFLICT");

  const stale = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: "I1",
    update: {
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2020-01-01T00:00:00.000Z",
    },
    actorId: "editor_1",
  });
  assert.equal(stale.type, "stale");
  assert.equal(stale.payload.errorCode, "STALE_EDIT");
});

test("UC-17 service handles save failures atomically", () => {
  const service = createScheduleService({
    storageAdapter: makeStorage({ schedule: makeSchedule(), failSave: true }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });

  const failed = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: "I1",
    update: {
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
    actorId: "editor_1",
  });

  assert.equal(failed.type, "save_failed");
  assert.equal(failed.payload.errorCode, "SAVE_FAILED");
});

test("UC-17 controller enforces editor-only update access", async () => {
  const service = createScheduleService({
    storageAdapter: makeStorage({ schedule: makeSchedule() }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });

  const controller = createScheduleEditController({
    scheduleService: service,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_editor") {
          return { user_id: "editor_1", role: "editor" };
        }
        if (sessionId === "sid_author") {
          return { user_id: "author_1", role: "author" };
        }
        return null;
      },
    },
  });

  const denied = await controller.handleUpdateScheduleItem({
    headers: { cookie: "cms_session=sid_author" },
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(denied.status, 403);

  const allowed = await controller.handleUpdateScheduleItem({
    headers: { cookie: "cms_session=sid_editor" },
    params: { conference_id: "C1", item_id: "I1" },
    body: {
      sessionId: "S3",
      roomId: "R3",
      timeSlotId: "T3",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(allowed.status, 200);
});
