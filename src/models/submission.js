function createSubmission({
  submission_id,
  author_id,
  status,
  title,
  activeManuscriptId,
  manuscript,
  updated_at,
} = {}) {
  return {
    submission_id: submission_id || "",
    author_id: author_id || "",
    status: status || "in_progress",
    title: title || "",
    activeManuscriptId: activeManuscriptId || (manuscript && manuscript.file_id) || null,
    manuscript: manuscript || null,
    updated_at: updated_at || new Date().toISOString(),
  };
}

function attachActiveManuscript(submission, manuscript) {
  const next = {
    ...(submission || {}),
    manuscript: manuscript || null,
    activeManuscriptId: manuscript ? manuscript.file_id || manuscript.id || null : null,
    updated_at: new Date().toISOString(),
  };
  return next;
}

module.exports = {
  createSubmission,
  attachActiveManuscript,
};
