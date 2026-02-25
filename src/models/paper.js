function createPaper({
  id,
  conferenceId,
  title,
  abstract,
  status,
  assignedReviewerCount,
  assignedEditorId,
} = {}) {
  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    title: String(title || "").trim(),
    abstract: String(abstract || "").trim(),
    status: String(status || "submitted").trim() || "submitted",
    assignedReviewerCount: Number(assignedReviewerCount || 0),
    assignedEditorId: String(assignedEditorId || "").trim(),
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
  getAssignedEditorId(paper = {}) {
    return String(paper.assignedEditorId || "").trim();
  },
};
