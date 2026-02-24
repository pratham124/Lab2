function createPaperSubmission({
  submission_id,
  author_id,
  title,
  abstract,
  keywords,
  affiliation,
  contact_email,
  status,
  submission_window_id,
  manuscript,
  created_at,
} = {}) {
  return {
    submission_id:
      submission_id || `submission_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    author_id: author_id || "",
    title: title || "",
    abstract: abstract || "",
    keywords: keywords || "",
    affiliation: affiliation || "",
    contact_email: contact_email || "",
    status: status || "submitted",
    submission_window_id: submission_window_id || "default_window",
    manuscript: manuscript || null,
    created_at: created_at || new Date().toISOString(),
  };
}

module.exports = {
  createPaperSubmission,
};
