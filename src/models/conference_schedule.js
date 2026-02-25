function createConferenceSchedule({ id, conferenceId, createdByAdminId, createdAt, status, sessions } = {}) {
  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    createdByAdminId: String(createdByAdminId || "").trim(),
    createdAt: createdAt || new Date().toISOString(),
    status: String(status || "generated").trim(),
    sessions: Array.isArray(sessions) ? sessions : [],
  };
}

module.exports = {
  createConferenceSchedule,
};
