const {
  MAX_MANUSCRIPT_SIZE_BYTES,
  ACCEPTED_MANUSCRIPT_LABELS,
} = require("./submission_constraints");

function mapValidationErrors(errors = {}) {
  return {
    title: errors.title || "",
    abstract: errors.abstract || "",
    keywords: errors.keywords || "",
    affiliation: errors.affiliation || "",
    contact_email: errors.contact_email || "",
    manuscript: errors.manuscript || "",
  };
}

function fileRequirementMessage() {
  return `Upload PDF, DOCX, or LaTeX ZIP up to ${Math.floor(
    MAX_MANUSCRIPT_SIZE_BYTES / (1024 * 1024)
  )} MB.`;
}

function formatListLabel() {
  return `${ACCEPTED_MANUSCRIPT_LABELS.pdf}, ${ACCEPTED_MANUSCRIPT_LABELS.docx}, ${ACCEPTED_MANUSCRIPT_LABELS.zip}`;
}

function composeSafeSaveFailureMessage() {
  return "We could not submit your paper right now. Please try again later or contact support.";
}

module.exports = {
  mapValidationErrors,
  fileRequirementMessage,
  formatListLabel,
  composeSafeSaveFailureMessage,
};
