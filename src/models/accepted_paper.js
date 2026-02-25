function createAcceptedPaper({ id, conferenceId, title, status = "accepted" } = {}) {
  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    title: String(title || "").trim(),
    status: String(status || "accepted").trim().toLowerCase(),
  };
}

module.exports = {
  createAcceptedPaper,
};
