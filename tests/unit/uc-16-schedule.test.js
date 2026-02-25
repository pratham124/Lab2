const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleGenerator } = require("../../src/services/schedule_generator");
const { createScheduleService } = require("../../src/services/schedule_service");
const { createScheduleController } = require("../../src/controllers/schedule_controller");

function makeStorage({ hasExisting = false, failSave = false } = {}) {
  const scheduleMap = new Map();
  if (hasExisting) {
    scheduleMap.set("C1", { id: "existing", conferenceId: "C1", sessions: [] });
  }

  return {
    listAcceptedPapers() {
      return [
        { id: "P2", status: "accepted" },
        { id: "P1", status: "accepted" },
      ];
    },
    getSchedulingParameters() {
      return {
        conferenceDates: ["2026-03-10"],
        sessionLengthMinutes: 60,
        dailyTimeWindow: { start: "09:00", end: "11:00" },
        availableRoomIds: ["R2", "R1"],
      };
    },
    getSchedule({ conferenceId }) {
      return scheduleMap.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      if (failSave) {
        throw new Error("save_failed");
      }
      scheduleMap.set(conferenceId, schedule);
      return schedule;
    },
  };
}

test("UC-16 generator enforces deterministic paper ordering", () => {
  const generator = createScheduleGenerator();
  const result = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [
      { id: "P20", status: "accepted" },
      { id: "P3", status: "accepted" },
      { id: "P10", status: "accepted" },
    ],
    parameters: {
      conferenceDates: ["2026-03-10"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "12:00" },
      availableRoomIds: ["R1"],
    },
    createdByAdminId: "admin_1",
  });

  assert.equal(result.type, "success");
  const order = result.schedule.sessions.map((session) => session.paperIds[0]);
  assert.deepEqual(order, ["P10", "P20", "P3"]);
});

test("UC-16 service handles confirmReplace and save failures", () => {
  const generator = createScheduleGenerator();

  const existingService = createScheduleService({
    storageAdapter: makeStorage({ hasExisting: true }),
    scheduleGenerator: generator,
  });
  const conflict = existingService.generateSchedule({
    conferenceId: "C1",
    confirmReplace: false,
    createdByAdminId: "admin_1",
  });
  assert.equal(conflict.type, "confirm_replace_required");

  const failingService = createScheduleService({
    storageAdapter: makeStorage({ failSave: true }),
    scheduleGenerator: generator,
  });
  const saveFailed = failingService.generateSchedule({
    conferenceId: "C1",
    confirmReplace: true,
    createdByAdminId: "admin_1",
  });
  assert.equal(saveFailed.type, "save_failed");
});

test("UC-16 controller returns 403 for non-admin and 200 for admin", async () => {
  const service = createScheduleService({
    storageAdapter: makeStorage(),
    scheduleGenerator: createScheduleGenerator(),
  });

  const controller = createScheduleController({
    scheduleService: service,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "admin_sid") {
          return { user_id: "admin_1", role: "admin" };
        }
        if (sessionId === "author_sid") {
          return { user_id: "author_1", role: "author" };
        }
        return null;
      },
    },
  });

  const forbidden = await controller.handleGenerate({
    headers: { cookie: "cms_session=author_sid", accept: "application/json" },
    params: { conference_id: "C1" },
    body: {},
  });
  assert.equal(forbidden.status, 403);

  const success = await controller.handleGenerate({
    headers: { cookie: "cms_session=admin_sid", accept: "application/json" },
    params: { conference_id: "C1" },
    body: { confirmReplace: true },
  });
  assert.equal(success.status, 200);
  const payload = JSON.parse(success.body);
  assert.equal(payload.status, "generated");
});
