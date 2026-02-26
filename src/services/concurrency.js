function isStale({ expectedLastUpdatedAt, currentLastUpdatedAt } = {}) {
  const expected = String(expectedLastUpdatedAt || "").trim();
  const current = String(currentLastUpdatedAt || "").trim();
  if (!expected || !current) {
    return true;
  }
  return expected !== current;
}

function createNextConcurrencyToken() {
  return new Date().toISOString();
}

module.exports = {
  isStale,
  createNextConcurrencyToken,
};
