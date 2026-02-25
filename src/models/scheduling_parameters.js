function normalizeArray(values) {
  return Array.isArray(values) ? values : [];
}

function createSchedulingParameters({
  conferenceId,
  conferenceDates,
  sessionLengthMinutes,
  dailyTimeWindow,
  availableRoomIds,
} = {}) {
  return {
    conferenceId: String(conferenceId || "").trim(),
    conferenceDates: normalizeArray(conferenceDates).map((value) => String(value || "").trim()),
    sessionLengthMinutes: Number(sessionLengthMinutes),
    dailyTimeWindow: {
      start: String((dailyTimeWindow && dailyTimeWindow.start) || "").trim(),
      end: String((dailyTimeWindow && dailyTimeWindow.end) || "").trim(),
    },
    availableRoomIds: normalizeArray(availableRoomIds).map((value) => String(value || "").trim()),
  };
}

module.exports = {
  createSchedulingParameters,
};
