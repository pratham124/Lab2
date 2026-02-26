function createPaper({
  id,
  conferenceId,
  title,
  abstract,
  status,
  authorId,
  authorIds,
  assignedReviewerCount,
  assignedEditorId,
} = {}) {
  const normalizedAuthorId = String(authorId || "").trim();
  const normalizedAuthorIds = Array.isArray(authorIds)
    ? authorIds.map((entry) => String(entry || "").trim()).filter(Boolean)
    : normalizedAuthorId
      ? [normalizedAuthorId]
      : [];

  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    title: String(title || "").trim(),
    abstract: String(abstract || "").trim(),
    status: String(status || "submitted").trim() || "submitted",
    authorId: normalizedAuthorId,
    authorIds: normalizedAuthorIds,
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
