function createManuscriptFile({
  file_id,
  submission_id,
  filename,
  original_filename,
  format,
  size_bytes,
  content_hash,
  uploaded_at,
  uploaded_by_author_id,
  is_active,
} = {}) {
  return {
    file_id: file_id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    submission_id: submission_id || "",
    filename: filename || "",
    original_filename: original_filename || filename || "",
    format: format || "",
    size_bytes: Number(size_bytes || 0),
    content_hash: content_hash || "",
    uploaded_at: uploaded_at || new Date().toISOString(),
    uploaded_by_author_id: uploaded_by_author_id || "",
    is_active: typeof is_active === "boolean" ? is_active : true,
  };
}

module.exports = {
  createManuscriptFile,
};
