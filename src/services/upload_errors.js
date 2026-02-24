function mapUploadError(error) {
  const code = (error && error.code) || "upload_failed";

  if (code === "missing_file") {
    return {
      code,
      inlineMessage: "Select a manuscript file before submitting.",
    };
  }

  if (code === "invalid_format") {
    return {
      code,
      inlineMessage: "Invalid file format. Accepted formats: PDF, Word (.doc/.docx), LaTeX (.zip).",
    };
  }

  if (code === "file_too_large") {
    return {
      code,
      inlineMessage: "File exceeds the 7 MB limit. Choose a smaller file.",
    };
  }

  if (code === "empty_file") {
    return {
      code,
      inlineMessage: "Selected file is empty or unreadable.",
    };
  }

  if (code === "duplicate_submit") {
    return {
      code,
      inlineMessage: "Upload already in progress. Please wait for the current request.",
    };
  }

  if (code === "upload_failed") {
    return {
      code,
      inlineMessage: "Upload failed. No partial file was saved. Please retry.",
    };
  }

  return {
    code,
    inlineMessage: "Unable to upload manuscript right now. Please retry.",
  };
}

module.exports = {
  mapUploadError,
};
