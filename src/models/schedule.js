function normalizeString(value) {
  return String(value || "").trim();
}

function createScheduleItem({ id, scheduleId, paperId, sessionId, roomId, timeSlotId } = {}) {
  return {
    id: normalizeString(id),
    scheduleId: normalizeString(scheduleId),
    paperId: normalizeString(paperId),
    sessionId: normalizeString(sessionId),
    roomId: normalizeString(roomId),
    timeSlotId: normalizeString(timeSlotId),
  };
}

function toItems(schedule) {
  if (!Array.isArray(schedule && schedule.sessions)) {
    return [];
  }

  const scheduleId = normalizeString(schedule.id);
  const items = [];
  for (const session of schedule.sessions) {
    const paperIds = Array.isArray(session && session.paperIds) ? session.paperIds : [];
    for (const paperId of paperIds) {
      const itemId = `item_${normalizeString(session.id)}_${normalizeString(paperId)}`;
      items.push(
        createScheduleItem({
          id: itemId,
          scheduleId,
          paperId,
          sessionId: session.id,
          roomId: session.roomId,
          timeSlotId: session.timeSlotId,
        })
      );
    }
  }

  return items;
}

function toSessions(items) {
  return items.map((item) => ({
    id: normalizeString(item.sessionId),
    scheduleId: normalizeString(item.scheduleId),
    roomId: normalizeString(item.roomId),
    timeSlotId: normalizeString(item.timeSlotId),
    paperIds: [normalizeString(item.paperId)],
  }));
}

function createSchedule({ id, name, status, version, lastUpdatedAt, conferenceId, items, sessions } = {}) {
  const scheduleId = normalizeString(id);
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => createScheduleItem({ ...item, scheduleId: item.scheduleId || scheduleId }))
    : toItems({ id: scheduleId, sessions });
  const timestamp = normalizeString(lastUpdatedAt) || new Date().toISOString();

  return {
    id: scheduleId,
    conferenceId: normalizeString(conferenceId),
    name: normalizeString(name) || "Current Conference Schedule",
    status: normalizeString(status) || "generated",
    version: normalizeString(version) || timestamp,
    lastUpdatedAt: timestamp,
    items: normalizedItems,
    sessions: toSessions(normalizedItems),
  };
}

module.exports = {
  createSchedule,
  createScheduleItem,
};
