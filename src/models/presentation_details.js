function normalize(value) {
  return String(value || "").trim();
}

function createPresentationDetails({
  id,
  paperId,
  date,
  time,
  session,
  location,
  timezone,
} = {}) {
  return {
    id: normalize(id) || `presentation_${Date.now()}`,
    paperId: normalize(paperId),
    date: normalize(date),
    time: normalize(time),
    session: normalize(session),
    location: normalize(location),
    timezone: normalize(timezone),
  };
}

module.exports = {
  createPresentationDetails,
};
