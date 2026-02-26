const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findItem,
  isReassignOnlyUpdate,
  validateStaleEdit,
  validateConflicts,
  validateScheduleItemUpdate,
} = require("../../src/services/schedule_validation");

function scheduleFixture() {
  return {
    lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    items: [
      { id: "I1", paperId: "P1", roomId: "R1", timeSlotId: "T1" },
      { id: "I2", paperId: "P2", roomId: "R2", timeSlotId: "T2" },
      { id: "I3", paperId: "P1", roomId: "R3", timeSlotId: "T3" },
    ],
  };
}

test("UC-17 validation helpers: findItem and reassign-only checks", () => {
  const schedule = scheduleFixture();
  assert.equal(findItem(schedule, "I2").id, "I2");
  assert.equal(findItem(schedule, "missing"), null);
  assert.equal(findItem(undefined, undefined), null);

  assert.equal(
    isReassignOnlyUpdate({
      sessionId: "S1",
      roomId: "R1",
      timeSlotId: "T1",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    }),
    true
  );
  assert.equal(isReassignOnlyUpdate({ sessionId: "S1", addSession: true }), false);
});

test("UC-17 validateStaleEdit covers stale and non-stale branches", () => {
  const schedule = scheduleFixture();

  const nonStale = validateStaleEdit({
    schedule,
    itemId: "I1",
    update: { lastUpdatedAt: "2026-02-10T00:00:00.000Z" },
  });
  assert.equal(nonStale, null);

  const stale = validateStaleEdit({
    schedule,
    itemId: "I1",
    update: { lastUpdatedAt: "2026-02-09T00:00:00.000Z" },
  });
  assert.equal(stale.errorCode, "STALE_EDIT");
});

test("UC-17 validateConflicts covers no-item, no-conflict, and conflict branches", () => {
  const schedule = scheduleFixture();

  const noItem = validateConflicts({
    schedule,
    itemId: "missing",
    update: { roomId: "R1", timeSlotId: "T1" },
  });
  assert.equal(noItem, null);

  const noConflict = validateConflicts({
    schedule,
    itemId: "I1",
    update: { roomId: "R9", timeSlotId: "T9" },
  });
  assert.equal(noConflict, null);

  const roomTimeConflict = validateConflicts({
    schedule,
    itemId: "I1",
    update: { roomId: "R2", timeSlotId: "T2" },
  });
  assert.equal(roomTimeConflict.errorCode, "CONFLICT");
  assert.equal(roomTimeConflict.conflicts.includes("I2"), true);

  const paperTimeConflict = validateConflicts({
    schedule,
    itemId: "I1",
    update: { roomId: "R9", timeSlotId: "T3" },
  });
  assert.equal(paperTimeConflict.errorCode, "CONFLICT");
  assert.equal(paperTimeConflict.conflicts.includes("I3"), true);

  const emptyUpdate = validateConflicts({
    schedule,
    itemId: "I1",
    update: {},
  });
  assert.equal(emptyUpdate, null);
});

test("UC-17 validateScheduleItemUpdate covers missing, invalid, stale, conflict, ok", () => {
  const schedule = scheduleFixture();

  const missing = validateScheduleItemUpdate({
    schedule,
    itemId: "missing",
    update: {},
  });
  assert.equal(missing.type, "missing_item");

  const invalid = validateScheduleItemUpdate({
    schedule,
    itemId: "I1",
    update: {
      roomId: "R1",
      timeSlotId: "T1",
      sessionId: "S1",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
      unsupported: "x",
    },
  });
  assert.equal(invalid.type, "invalid_update");

  const stale = validateScheduleItemUpdate({
    schedule,
    itemId: "I1",
    update: {
      roomId: "R1",
      timeSlotId: "T1",
      sessionId: "S1",
      lastUpdatedAt: "2020-01-01T00:00:00.000Z",
    },
  });
  assert.equal(stale.type, "stale");

  const conflict = validateScheduleItemUpdate({
    schedule,
    itemId: "I1",
    update: {
      roomId: "R2",
      timeSlotId: "T2",
      sessionId: "S2",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(conflict.type, "conflict");

  const ok = validateScheduleItemUpdate({
    schedule,
    itemId: "I1",
    update: {
      roomId: "R9",
      timeSlotId: "T9",
      sessionId: "S9",
      lastUpdatedAt: "2026-02-10T00:00:00.000Z",
    },
  });
  assert.equal(ok.type, "ok");
  assert.equal(ok.item.id, "I1");
});
