const { createErrorPayload } = require("./error_payload");
const { isStale } = require("./concurrency");

function normalize(value) {
  return String(value || "").trim();
}

function findItem(schedule, itemId) {
  const items = Array.isArray(schedule && schedule.items) ? schedule.items : [];
  return items.find((item) => normalize(item.id) === normalize(itemId)) || null;
}

function isReassignOnlyUpdate(update = {}) {
  const allowedFields = new Set(["sessionId", "roomId", "timeSlotId", "lastUpdatedAt"]);
  return Object.keys(update).every((key) => allowedFields.has(key));
}

function validateStaleEdit({ schedule, update, itemId } = {}) {
  const stale = isStale({
    expectedLastUpdatedAt: update && update.lastUpdatedAt,
    currentLastUpdatedAt: schedule && schedule.lastUpdatedAt,
  });
  if (!stale) {
    return null;
  }
  return createErrorPayload({
    errorCode: "STALE_EDIT",
    summary: "Schedule changed since it was loaded.",
    affectedItemId: itemId,
    recommendedAction: "Refresh and retry the edit.",
  });
}

function validateConflicts({ schedule, itemId, update } = {}) {
  const items = Array.isArray(schedule && schedule.items) ? schedule.items : [];
  const targetItemId = normalize(itemId);
  const roomId = normalize(update && update.roomId);
  const timeSlotId = normalize(update && update.timeSlotId);
  const item = findItem(schedule, targetItemId);
  if (!item) {
    return null;
  }

  const paperId = normalize(item.paperId);
  const conflicts = items
    .filter((entry) => normalize(entry.id) !== targetItemId)
    .filter((entry) => {
      const sameRoomTime = normalize(entry.roomId) === roomId && normalize(entry.timeSlotId) === timeSlotId;
      const samePaperTime = normalize(entry.paperId) === paperId && normalize(entry.timeSlotId) === timeSlotId;
      return sameRoomTime || samePaperTime;
    })
    .map((entry) => normalize(entry.id));

  if (conflicts.length === 0) {
    return null;
  }

  return createErrorPayload({
    errorCode: "CONFLICT",
    summary: "Room/time slot is already occupied.",
    affectedItemId: targetItemId,
    conflicts,
    recommendedAction: "Choose a different room or time slot.",
  });
}

function validateScheduleItemUpdate({ schedule, itemId, update } = {}) {
  const item = findItem(schedule, itemId);
  if (!item) {
    return {
      type: "missing_item",
      payload: {
        errorCode: "ITEM_NOT_FOUND",
        summary: "Selected schedule item cannot be edited.",
        affectedItemId: normalize(itemId),
        recommendedAction: "Refresh schedule and select another item.",
      },
    };
  }

  if (!isReassignOnlyUpdate(update || {})) {
    return {
      type: "invalid_update",
      payload: {
        errorCode: "INVALID_UPDATE",
        summary: "Only session, room, and time slot reassignment is allowed.",
        affectedItemId: normalize(itemId),
        recommendedAction: "Remove unsupported fields and retry.",
      },
    };
  }

  const staleError = validateStaleEdit({ schedule, update, itemId });
  if (staleError) {
    return { type: "stale", payload: staleError };
  }

  const conflictError = validateConflicts({ schedule, itemId, update });
  if (conflictError) {
    return { type: "conflict", payload: conflictError };
  }

  return { type: "ok", item };
}

module.exports = {
  findItem,
  isReassignOnlyUpdate,
  validateStaleEdit,
  validateConflicts,
  validateScheduleItemUpdate,
};
