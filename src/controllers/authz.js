const { getAssignedEditorId } = require("../models/paper");

function normalizeId(value) {
  return String(value || "").trim();
}

function canAccessAssignedPaper({ editorId, paper } = {}) {
  const normalizedEditorId = normalizeId(editorId);
  if (!normalizedEditorId || !paper) {
    return false;
  }

  const assignedEditorId = normalizeId(getAssignedEditorId(paper));
  if (!assignedEditorId) {
    return false;
  }

  return assignedEditorId === normalizedEditorId;
}

module.exports = {
  canAccessAssignedPaper,
};
