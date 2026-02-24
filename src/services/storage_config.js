const path = require("path");

const MANUSCRIPT_STORAGE_ROOT = path.resolve(__dirname, "..", "..", "data", "manuscripts_private");
const MANUSCRIPT_RETENTION_POLICY = Object.freeze({
  autoDelete: false,
  ttlMs: null,
  note: "Manuscripts are retained indefinitely unless explicitly removed by an authorized user.",
});

module.exports = {
  MANUSCRIPT_STORAGE_ROOT,
  MANUSCRIPT_RETENTION_POLICY,
};
