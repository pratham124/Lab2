function createRoom({ id, conferenceId, name, capacity } = {}) {
  return {
    id: String(id || "").trim(),
    conferenceId: String(conferenceId || "").trim(),
    name: String(name || "").trim(),
    capacity: Number.isFinite(Number(capacity)) ? Number(capacity) : null,
  };
}

module.exports = {
  createRoom,
};
