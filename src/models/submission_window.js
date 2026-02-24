function createSubmissionWindow({ submission_window_id, opens_at, closes_at, conference_id } = {}) {
  return {
    submission_window_id: submission_window_id || "default_window",
    opens_at: opens_at || "1970-01-01T00:00:00.000Z",
    closes_at: closes_at || "2999-01-01T00:00:00.000Z",
    conference_id: conference_id || "default_conference",
  };
}

function isWithinSubmissionWindow(window, at = new Date()) {
  const now = at instanceof Date ? at.getTime() : new Date(at).getTime();
  const opens = new Date(window.opens_at).getTime();
  const closes = new Date(window.closes_at).getTime();
  return now >= opens && now <= closes;
}

module.exports = {
  createSubmissionWindow,
  isWithinSubmissionWindow,
};
