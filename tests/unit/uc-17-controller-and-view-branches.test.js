const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleEditController } = require("../../src/controllers/schedule_edit_controller");
const view = require("../../src/views/schedule_edit_view");

function parseJson(response) {
  return JSON.parse(response.body);
}

test("UC-17 view helpers cover editor/non-editor branches and field normalization", () => {
  const editor = view.renderSchedule({ schedule: { id: "S" }, actor: { role: " editor " }, message: " ok " });
  assert.equal(editor.canEdit, true);
  assert.equal(editor.controlsDisabled, false);
  assert.equal(editor.message, "ok");

  const nonEditor = view.renderScheduleItem({ item: { id: "I" }, actor: { role: "author" } });
  assert.equal(nonEditor.canEdit, false);
  assert.equal(nonEditor.controlsDisabled, true);

  const selection = view.buildEditSelection({
    schedule: { id: " C1 " },
    itemId: " I1 ",
    assignment: {
      sessionId: " S1 ",
      roomId: " R1 ",
      timeSlotId: " T1 ",
      lastUpdatedAt: " 2026-02-10T00:00:00.000Z ",
    },
  });
  assert.equal(selection.itemId, "I1");
  assert.equal(selection.assignment.lastUpdatedAt, "2026-02-10T00:00:00.000Z");

  const err = view.renderError({
    errorCode: "CONFLICT",
    summary: "Conflict",
    affectedItemId: "I1",
    recommendedAction: "Retry",
    conflicts: [" I2 ", ""],
  });
  assert.deepEqual(err.conflicts, ["I2"]);
});

test("UC-17 controller throws when scheduleService is missing", () => {
  assert.throws(() => createScheduleEditController(), /scheduleService is required/);
});

test("UC-17 controller get handlers cover not-found and success branches", async () => {
  const controller = createScheduleEditController({
    scheduleService: {
      getCurrentSchedule() {
        return { type: "not_found" };
      },
      getScheduleItem() {
        return { type: "not_found_item" };
      },
    },
    authService: {
      resolveActor() {
        return { id: "u1", role: "author" };
      },
    },
  });

  const missingSchedule = await controller.handleGetCurrentSchedule({ params: { conference_id: "C1" } });
  assert.equal(missingSchedule.status, 404);
  assert.equal(missingSchedule.headers["Cache-Control"], "no-store, max-age=0");

  const missingItem = await controller.handleGetScheduleItem({ params: { conference_id: "C1", item_id: "I1" } });
  assert.equal(missingItem.status, 404);

  const successController = createScheduleEditController({
    scheduleService: {
      getCurrentSchedule() {
        return { type: "success", schedule: { id: "S1", items: [] } };
      },
      getScheduleItem() {
        return { type: "success", item: { id: "I1" } };
      },
    },
    authService: {
      resolveActor() {
        return { id: "u1", role: "editor" };
      },
    },
  });

  const scheduleOk = await successController.handleGetCurrentSchedule({ params: { conference_id: "C1" } });
  assert.equal(scheduleOk.status, 200);
  assert.equal(parseJson(scheduleOk).canEdit, true);

  const itemOk = await successController.handleGetScheduleItem({ params: { conference_id: "C1", item_id: "I1" } });
  assert.equal(itemOk.status, 200);
  assert.equal(parseJson(itemOk).item.id, "I1");
});

test("UC-17 controller update handler covers unauthorized and result-type branches", async () => {
  const updates = [];
  const service = {
    getCurrentSchedule() {
      return { type: "success", schedule: { id: "S1", items: [{ id: "I1" }] } };
    },
    updateScheduleItem({ update }) {
      updates.push(update);
      return service.next;
    },
    next: { type: "success" },
  };

  const controller = createScheduleEditController({
    scheduleService: service,
    authService: {
      resolveActor() {
        return { id: "u1", role: "author" };
      },
    },
  });

  const denied = await controller.handleUpdateScheduleItem({ params: { conference_id: "C1", item_id: "I1" }, body: {} });
  assert.equal(denied.status, 403);

  const editorController = createScheduleEditController({
    scheduleService: service,
    authService: {
      resolveActor() {
        return { id: "u2", role: "editor" };
      },
    },
  });

  service.next = { type: "missing_item", payload: { errorCode: "ITEM_NOT_FOUND", summary: "x", affectedItemId: "I1", recommendedAction: "y" } };
  assert.equal((await editorController.handleUpdateScheduleItem({ params: { conference_id: "C1", item_id: "I1" }, body: {} })).status, 404);

  service.next = { type: "invalid_update", payload: { errorCode: "INVALID_UPDATE", summary: "x", affectedItemId: "I1", recommendedAction: "y" } };
  assert.equal((await editorController.handleUpdateScheduleItem({ params: { conference_id: "C1", item_id: "I1" }, body: {} })).status, 400);

  service.next = { type: "stale", payload: { errorCode: "STALE_EDIT", summary: "x", affectedItemId: "I1", recommendedAction: "y" } };
  assert.equal((await editorController.handleUpdateScheduleItem({ params: { conference_id: "C1", item_id: "I1" }, body: {} })).status, 409);

  service.next = { type: "conflict", payload: { errorCode: "CONFLICT", summary: "x", affectedItemId: "I1", recommendedAction: "y" } };
  assert.equal((await editorController.handleUpdateScheduleItem({ params: { conference_id: "C1", item_id: "I1" }, body: {} })).status, 409);

  service.next = { type: "save_failed", payload: { errorCode: "SAVE_FAILED", summary: "x", affectedItemId: "I1", recommendedAction: "y" } };
  assert.equal((await editorController.handleUpdateScheduleItem({ params: { conference_id: "C1", item_id: "I1" }, body: {} })).status, 500);

  service.next = { type: "success" };
  const success = await editorController.handleUpdateScheduleItem({
    params: { conference_id: " C1 ", item_id: " I1 " },
    body: {
      sessionId: " S1 ",
      roomId: " R1 ",
      timeSlotId: " T1 ",
      lastUpdatedAt: " 2026-02-10T00:00:00.000Z ",
    },
  });
  assert.equal(success.status, 200);
  assert.equal(updates[updates.length - 1].lastUpdatedAt, "2026-02-10T00:00:00.000Z");
});
