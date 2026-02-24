const crypto = require("crypto");

function createManuscriptStorage() {
  const files = new Map();

  return {
    async save({ submission_id, filename, format, contentBuffer }) {
      const buffer = Buffer.isBuffer(contentBuffer)
        ? contentBuffer
        : Buffer.from(String(contentBuffer || ""), "utf8");
      const content_hash = crypto.createHash("sha256").update(buffer).digest("hex");

      const stored = {
        submission_id,
        filename,
        format,
        size_bytes: buffer.length,
        content_hash,
      };
      files.set(content_hash, stored);
      return stored;
    },

    async hash(contentBuffer) {
      const buffer = Buffer.isBuffer(contentBuffer)
        ? contentBuffer
        : Buffer.from(String(contentBuffer || ""), "utf8");
      return crypto.createHash("sha256").update(buffer).digest("hex");
    },
  };
}

module.exports = {
  createManuscriptStorage,
};
