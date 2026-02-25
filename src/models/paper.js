function createPaper({ id, conferenceId, title, status, assignedReviewerCount } = {}) {
  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    title: String(title || "").trim(),
    status: String(status || "submitted").trim() || "submitted",
    assignedReviewerCount: Number(assignedReviewerCount || 0),
  };
}

function paperBelongsToConference(paper, conferenceId) {
  if (!paper) {
    return false;
  }
  const normalizedConferenceId = String(conferenceId || "").trim();
  if (!normalizedConferenceId) {
    return true;
  }
  const paperConferenceId = String(paper.conferenceId || "").trim();
  return !paperConferenceId || paperConferenceId === normalizedConferenceId;
}

module.exports = {
  createPaper,
  paperBelongsToConference,
};
