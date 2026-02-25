function createSession({ id, scheduleId, roomId, timeSlotId, paperIds } = {}) {
  return {
    id: String(id || "").trim(),
    scheduleId: String(scheduleId || "").trim(),
    roomId: String(roomId || "").trim(),
    timeSlotId: String(timeSlotId || "").trim(),
    paperIds: Array.isArray(paperIds) ? paperIds.map((value) => String(value || "").trim()) : [],
  };
}

module.exports = {
  createSession,
};
