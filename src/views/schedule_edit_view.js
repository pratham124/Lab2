const { createErrorPayload } = require("../services/error_payload");

function renderSchedule({ schedule, actor, message } = {}) {
  const role = String((actor && actor.role) || "").trim().toLowerCase();
  const canEdit = role === "editor" || role === "admin";

  return {
    schedule,
    message: String(message || "").trim(),
    canEdit,
    controlsDisabled: !canEdit,
  };
}

function renderScheduleItem({ item, actor } = {}) {
  const role = String((actor && actor.role) || "").trim().toLowerCase();
  const canEdit = role === "editor" || role === "admin";
  return {
    item,
    canEdit,
    controlsDisabled: !canEdit,
  };
}

function buildEditSelection({ schedule, itemId, assignment } = {}) {
  return {
    scheduleId: schedule && schedule.id,
    itemId: String(itemId || "").trim(),
    assignment: {
      sessionId: String((assignment && assignment.sessionId) || "").trim(),
      roomId: String((assignment && assignment.roomId) || "").trim(),
      timeSlotId: String((assignment && assignment.timeSlotId) || "").trim(),
      lastUpdatedAt: String((assignment && assignment.lastUpdatedAt) || "").trim(),
    },
  };
}

function renderError(error) {
  return createErrorPayload(error || {});
}

module.exports = {
  renderSchedule,
  renderScheduleItem,
  buildEditSelection,
  renderError,
};
