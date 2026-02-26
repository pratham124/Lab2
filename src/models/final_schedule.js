function normalize(value) {
  return String(value || "").trim();
}

function createFinalSchedule({
  id,
  conferenceId,
  status = "draft",
  publishedAt = null,
  conferenceTimezone = "UTC",
} = {}) {
  return {
    id: normalize(id) || "final_schedule",
    conferenceId: normalize(conferenceId),
    status: normalize(status) || "draft",
    publishedAt: publishedAt || null,
    conferenceTimezone: normalize(conferenceTimezone) || "UTC",
  };
}

module.exports = {
  createFinalSchedule,
};
