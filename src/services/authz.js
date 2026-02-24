const PRIVILEGED_ROLES = Object.freeze(["program_chair", "track_chair", "admin"]);

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function hasPrivilegedRole(session) {
  return PRIVILEGED_ROLES.includes(normalizeRole(session && session.role));
}

function canAccessSubmissionManuscript({ session, submission } = {}) {
  if (!session || !submission) {
    return false;
  }

  if (String(submission.author_id || "") === String(session.user_id || "")) {
    return true;
  }

  return hasPrivilegedRole(session);
}

module.exports = {
  PRIVILEGED_ROLES,
  normalizeRole,
  hasPrivilegedRole,
  canAccessSubmissionManuscript,
};
