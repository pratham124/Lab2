const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleService } = require("../../src/services/schedule_service");
const { createSchedule } = require("../../src/models/schedule");
const { isStale, createNextConcurrencyToken } = require("../../src/services/concurrency");
const { createErrorPayload } = require("../../src/services/error_payload");
const { createPerfMetrics } = require("../../src/services/perf_metrics");
const { hasScheduleEditRole, normalizeRole } = require("../../src/services/authz");

function makeSchedule() {
  return {
    id: "schedule_c1",
    conferenceId: "C1",
    status: "generated",
    createdAt: "2026-02-10T00:00:00.000Z",
    sessions: [{ id: "S1", scheduleId: "schedule_c1", paperIds: ["P1"], roomId: "R1", timeSlotId: "T1" }],
  };
}

function makeStorage({ schedule = makeSchedule(), failSave = false } = {}) {
  const map = new Map();
  if (schedule) {
    map.set("C1", schedule);
  }
  return {
    map,
    getSchedule({ conferenceId }) {
      return map.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule: next }) {
      if (failSave) {
        throw new Error("save_failed");
      }
      map.set(conferenceId, next);
      return next;
    },
    listAcceptedPapers() {
      return [{ id: "P1", status: "accepted" }];
    },
    getSchedulingParameters() {
      return {
        conferenceDates: ["2026-02-10"],
        sessionLengthMinutes: 60,
        dailyTimeWindow: { start: "09:00", end: "10:00" },
        availableRoomIds: ["R1"],
      };
    },
  };
}

test("UC-17 helper modules cover normalization and edge branches", () => {
  assert.equal(isStale({ expectedLastUpdatedAt: "A", currentLastUpdatedAt: "A" }), false);
  assert.equal(isStale({ expectedLastUpdatedAt: "A", currentLastUpdatedAt: "B" }), true);
  assert.equal(isStale({ expectedLastUpdatedAt: "", currentLastUpdatedAt: "B" }), true);
  assert.equal(typeof createNextConcurrencyToken(), "string");

  assert.deepEqual(createErrorPayload({ errorCode: "X", summary: "Y", affectedItemId: "Z", recommendedAction: "R" }), {
    errorCode: "X",
    summary: "Y",
    affectedItemId: "Z",
    recommendedAction: "R",
  });
  assert.deepEqual(
    createErrorPayload({ errorCode: "X", summary: "Y", affectedItemId: "Z", recommendedAction: "R", conflicts: [" A ", "", null] }).conflicts,
    ["A"]
  );

  const metrics = createPerfMetrics();
  assert.equal(metrics.getP95(), 0);
  const started = metrics.start();
  const duration = metrics.stop(started);
  assert.equal(duration >= 0, true);
  assert.equal(metrics.getP95() >= 0, true);

  assert.equal(normalizeRole(" Track Chair "), "track_chair");
  assert.equal(hasScheduleEditRole({ role: "editor" }), true);
  assert.equal(hasScheduleEditRole({ role: "author" }), false);

  const schedule = createSchedule({
    id: "S1",
    sessions: [{ id: "SS1", roomId: "R1", timeSlotId: "T1", paperIds: ["P1"] }],
  });
  assert.equal(schedule.items.length, 1);
  assert.equal(schedule.sessions.length, 1);
});

test("UC-17 schedule service constructor and read methods cover branches", () => {
  assert.throws(() => createScheduleService({}), /storageAdapter is required/);
  assert.throws(() => createScheduleService({ storageAdapter: makeStorage() }), /scheduleGenerator is required/);

  const storage = makeStorage({ schedule: null });
  const service = createScheduleService({
    storageAdapter: storage,
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });

  assert.equal(service.hasSchedule({ conferenceId: "C1" }), false);
  assert.equal(service.getSchedule({ conferenceId: "C1" }).type, "not_found");
  assert.equal(service.getCurrentSchedule({ conferenceId: "C1" }).type, "not_found");
  assert.equal(service.getScheduleItem({ conferenceId: "C1", itemId: "I1" }).type, "not_found_schedule");
  assert.equal(service.updateScheduleItem({ conferenceId: "C1", itemId: "I1", update: {}, actorId: "u1" }).type, "save_failed");
});

test("UC-17 schedule service update and generate branches", () => {
  const storage = makeStorage();
  const metrics = createPerfMetrics();
  const service = createScheduleService({
    storageAdapter: storage,
    scheduleGenerator: {
      generate: ({ conferenceId }) => ({ type: "success", schedule: { ...makeSchedule(), conferenceId, id: "generated_1", sessions: [] } }),
    },
    perfMetrics: metrics,
  });

  assert.equal(service.getScheduleItem({ conferenceId: "C1", itemId: "missing" }).type, "not_found_item");

  const current = service.getCurrentSchedule({ conferenceId: "C1" });
  assert.equal(current.type, "success");
  assert.equal(current.schedule.items.length, 1);

  const ok = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: current.schedule.items[0].id,
    update: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: current.schedule.lastUpdatedAt,
    },
    actorId: "editor_1",
  });
  assert.equal(ok.type, "success");
  assert.equal(ok.schedule.status, "edited");
  assert.equal(typeof ok.validateAndSaveMs, "number");

  const cached = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: current.schedule.items[0].id,
    update: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: current.schedule.lastUpdatedAt,
    },
    actorId: "editor_1",
  });
  assert.equal(cached.type, "success");
  assert.deepEqual(cached.item, ok.item);

  const invalid = service.updateScheduleItem({
    conferenceId: "C1",
    itemId: current.schedule.items[0].id,
    update: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: ok.schedule.lastUpdatedAt,
      forbidden: true,
    },
    actorId: "editor_1",
  });
  assert.equal(invalid.type, "invalid_update");

  const withExisting = createScheduleService({
    storageAdapter: makeStorage(),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });
  assert.equal(withExisting.generateSchedule({ conferenceId: "C1", confirmReplace: false }).type, "confirm_replace_required");

  const generatedFail = createScheduleService({
    storageAdapter: makeStorage({ schedule: null }),
    scheduleGenerator: { generate: () => ({ type: "unsatisfiable_constraints", message: "x" }) },
  });
  assert.equal(generatedFail.generateSchedule({ conferenceId: "C1", confirmReplace: true }).type, "unsatisfiable_constraints");

  const generatedOk = createScheduleService({
    storageAdapter: makeStorage({ schedule: null }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });
  assert.equal(generatedOk.generateSchedule({ conferenceId: "C1", confirmReplace: true }).type, "success");

  const generatedSaveFail = createScheduleService({
    storageAdapter: makeStorage({ schedule: null, failSave: true }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });
  assert.equal(generatedSaveFail.generateSchedule({ conferenceId: "C1", confirmReplace: true }).type, "save_failed");

  const updateSaveFail = createScheduleService({
    storageAdapter: makeStorage({ failSave: true }),
    scheduleGenerator: { generate: () => ({ type: "success", schedule: makeSchedule() }) },
  });
  const current2 = updateSaveFail.getCurrentSchedule({ conferenceId: "C1" }).schedule;
  const targetId = current2.items[0].id;
  const failed = updateSaveFail.updateScheduleItem({
    conferenceId: "C1",
    itemId: targetId,
    update: {
      sessionId: "S2",
      roomId: "R2",
      timeSlotId: "T2",
      lastUpdatedAt: current2.lastUpdatedAt,
    },
    actorId: "editor_1",
  });
  assert.equal(failed.type, "save_failed");
});
