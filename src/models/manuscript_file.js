function createManuscriptFile({
  file_id,
  submission_id,
  filename,
  format,
  size_bytes,
  content_hash,
} = {}) {
  return {
    file_id: file_id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    submission_id: submission_id || "",
    filename: filename || "",
    format: format || "",
    size_bytes: Number(size_bytes || 0),
    content_hash: content_hash || "",
  };
}

module.exports = {
  createManuscriptFile,
};
