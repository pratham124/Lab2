const { MAX_MANUSCRIPT_SIZE_BYTES } = require("../lib/submission_constraints");

const ACCEPTED_MANUSCRIPT_TYPES = Object.freeze([
  { extension: "pdf", label: "PDF" },
  { extension: "doc", label: "Word (.doc)" },
  { extension: "docx", label: "Word (.docx)" },
  { extension: "zip", label: "LaTeX (.zip)" },
]);

function getFileExtension(filename) {
  const value = String(filename || "").trim().toLowerCase();
  const index = value.lastIndexOf(".");
  return index > -1 ? value.slice(index + 1) : "";
}

function acceptedFormatsLabel() {
  return "PDF, Word (.doc/.docx), LaTeX (.zip)";
}

function validateUpload(file) {
  if (!file || !file.filename) {
    return {
      ok: false,
      code: "missing_file",
      message: "Select a manuscript file to upload.",
    };
  }

  const extension = getFileExtension(file.filename);
  const acceptedExtensions = ACCEPTED_MANUSCRIPT_TYPES.map((entry) => entry.extension);
  if (!acceptedExtensions.includes(extension)) {
    return {
      ok: false,
      code: "invalid_format",
      message: `Accepted formats: ${acceptedFormatsLabel()}.`,
      details: {
        acceptedFormats: acceptedFormatsLabel(),
      },
    };
  }

  const sizeBytes = Number(file.sizeBytes || file.size_bytes || 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return {
      ok: false,
      code: "empty_file",
      message: "Selected file is empty or unreadable.",
    };
  }

  if (sizeBytes > MAX_MANUSCRIPT_SIZE_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `Maximum allowed size is ${Math.floor(MAX_MANUSCRIPT_SIZE_BYTES / (1024 * 1024))} MB.`,
      details: {
        maxSizeBytes: MAX_MANUSCRIPT_SIZE_BYTES,
      },
    };
  }

  return {
    ok: true,
    extension,
    sizeBytes,
  };
}

module.exports = {
  ACCEPTED_MANUSCRIPT_TYPES,
  getFileExtension,
  acceptedFormatsLabel,
  validateUpload,
};
