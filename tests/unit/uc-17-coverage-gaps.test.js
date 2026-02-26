const test = require("node:test");
const assert = require("node:assert/strict");

const { createSchedule } = require("../../src/models/schedule");
const { createErrorPayload } = require("../../src/services/error_payload");
const { isStale } = require("../../src/services/concurrency");
const { createPerfMetrics } = require("../../src/services/perf_metrics");
const { createScheduleEditController } = require("../../src/controllers/schedule_edit_controller");
const { validateConflicts, validateScheduleItemUpdate, findItem } = require("../../src/services/schedule_validation");
const view = require("../../src/views/schedule_edit_view");

test("UC-17 coverage gaps: model/helpers default and empty branches", () => {
  const fromItems = createSchedule({
    id: "S1",
    items: [{ id: "I1", scheduleId: "S1", paperId: "P1", sessionId: "SS1", roomId: "R1", timeSlotId: "T1" }],
  });
  assert.equal(fromItems.items.length, 1);
  assert.equal(fromItems.items[0].id, "I1");

  const noSessions = createSchedule({ id: "S2", sessions: null });
  assert.deepEqual(noSessions.items, []);

  const nonArrayPaperIds = createSchedule({
    id: "S3",
    sessions: [
      {
        id: "SX",
        roomId: "R1",
        timeSlotId: "T1",
        paperIds: null,
      },
    ],
  });
  assert.deepEqual(nonArrayPaperIds.items, []);

  const explicitItems = createSchedule({
    id: "S4",
    items: [{ id: " I1 ", scheduleId: "", paperId: " P1 ", sessionId: " SS1 ", roomId: " R1 ", timeSlotId: " T1 " }],
  });
  assert.equal(explicitItems.items[0].id, "I1");
  assert.equal(explicitItems.items[0].scheduleId, "S4");

  const staleWhenCurrentMissing = isStale({
    expectedLastUpdatedAt: "2026-02-10T00:00:00.000Z",
    currentLastUpdatedAt: "",
  });
  assert.equal(staleWhenCurrentMissing, true);

  const emptyPayload = createErrorPayload();
  assert.deepEqual(emptyPayload, {
    errorCode: "",
    summary: "",
    affectedItemId: "",
    recommendedAction: "",
  });

  const metrics = createPerfMetrics();
  const duration = metrics.stop(undefined);
  assert.equal(typeof duration, "number");
  assert.equal(duration >= 0, true);
});

test("UC-17 coverage gaps: validation default branches", () => {
  assert.equal(findItem({}, "I1"), null);
  assert.equal(findItem(undefined, undefined), null);
  assert.equal(validateConflicts({ schedule: {}, itemId: "I1", update: { roomId: "R1", timeSlotId: "T1" } }), null);

  const missingUpdate = validateScheduleItemUpdate({
    schedule: { lastUpdatedAt: "2026-02-10T00:00:00.000Z", items: [{ id: "I1", paperId: "P1", roomId: "R1", timeSlotId: "T1" }] },
    itemId: "I1",
    update: undefined,
  });
  assert.equal(missingUpdate.type, "stale");
});

test("UC-17 coverage gaps: controller and view fallback branches", async () => {
  const service = {
    getCurrentSchedule() {
      return { type: "success", schedule: { id: "S1", items: [] } };
    },
    getScheduleItem() {
      return { type: "success", item: { id: "I1" } };
    },
    updateScheduleItem() {
      return { type: "success" };
    },
  };

  const customResponse = {
    json(status, payload) {
      return { status, headers: undefined, body: JSON.stringify(payload) };
    },
  };

  const controller = createScheduleEditController({
    scheduleService: service,
    authService: {
      resolveActor() {
        return null;
      },
    },
    response: customResponse,
  });

  const current = await controller.handleGetCurrentSchedule();
  assert.equal(current.status, 200);
  assert.equal(current.headers["Cache-Control"], "no-store, max-age=0");

  const item = await controller.handleGetScheduleItem();
  assert.equal(item.status, 200);

  const denied = await controller.handleUpdateScheduleItem({ body: {} });
  assert.equal(denied.status, 403);

  const controllerWithDefaults = createScheduleEditController({
    scheduleService: {
      getCurrentSchedule() {
        return { type: "success", schedule: { id: "S1", items: [] } };
      },
      getScheduleItem() {
        return { type: "success", item: { id: "I1" } };
      },
      updateScheduleItem(args) {
        assert.equal(args.conferenceId, "C1");
        assert.equal(args.itemId, "");
        return {
          type: "invalid_update",
          payload: {
            errorCode: "INVALID_UPDATE",
            summary: "x",
            affectedItemId: "",
            recommendedAction: "y",
          },
        };
      },
    },
    authService: {
      resolveActor() {
        return { id: "editor_1", role: "editor" };
      },
    },
    response: customResponse,
  });

  const invalidDefaultParams = await controllerWithDefaults.handleUpdateScheduleItem({ body: {} });
  assert.equal(invalidDefaultParams.status, 400);

  const rendered = view.renderSchedule();
  assert.equal(rendered.message, "");
  const renderedItem = view.renderScheduleItem();
  assert.equal(renderedItem.controlsDisabled, true);
  const selection = view.buildEditSelection();
  assert.equal(selection.itemId, "");
  const err = view.renderError();
  assert.equal(err.errorCode, "");
});

test("UC-17 coverage gaps: service buildEditableSchedule handles undefined save return", () => {
  const storage = {
    map: new Map([
      [
        "C1",
        {
          id: "schedule_c1",
          conferenceId: "C1",
          status: "generated",
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
          ],
        },
      ],
    ]),
    getSchedule({ conferenceId }) {
      return this.map.get(conferenceId) || null;
    },
    saveSchedule() {
      return undefined;
    },
    listAcceptedPapers() {
      return [];
    },
    getSchedulingParameters() {
      return {};
    },
  };
  const { createScheduleService } = require("../../src/services/schedule_service");
  const service = createScheduleService({
    storageAdapter: storage,
    scheduleGenerator: { generate: () => ({ type: "success", schedule: {} }) },
  });
  const result = service.updateScheduleItem({
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
  assert.equal(result.type, "success");
  assert.equal(result.schedule.id, "");
});
