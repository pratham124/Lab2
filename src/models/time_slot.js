function createTimeSlot({ id, conferenceId, date, startTime, endTime } = {}) {
  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    date: String(date || "").trim(),
    startTime: String(startTime || "").trim(),
    endTime: String(endTime || "").trim(),
  };
}

module.exports = {
  createTimeSlot,
};
