const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { MANUSCRIPT_STORAGE_ROOT } = require("./storage_config");

function normalizeBuffer(contentBuffer) {
  if (Buffer.isBuffer(contentBuffer)) {
    return contentBuffer;
  }
  return Buffer.from(String(contentBuffer || ""), "utf8");
}

function createManuscriptStorage({ storageRoot } = {}) {
  const root = path.resolve(storageRoot || MANUSCRIPT_STORAGE_ROOT);
  const privateFiles = new Map();
  const activeBySubmission = new Map();

  if (root.includes(`${path.sep}public${path.sep}`) || root.endsWith(`${path.sep}public`)) {
    throw new Error("Invalid manuscript storage root: must be outside public web root");
  }

  fs.mkdirSync(root, { recursive: true });

  function buildAbsolutePath(storedFilename) {
    return path.join(root, storedFilename);
  }

  function makeStoredFilename(submissionId, originalFilename) {
    const safeExt = path.extname(String(originalFilename || "")).toLowerCase() || ".bin";
    return `${submissionId}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`;
  }

  function snapshot(metadata) {
    if (!metadata) {
      return null;
    }
    return {
      ...metadata,
    };
  }

  function ensureNotPublicPath(filePath) {
    const normalized = path.resolve(filePath);
    if (!normalized.startsWith(root + path.sep) && normalized !== root) {
      throw new Error("Attempted manuscript access outside storage root");
    }
    return normalized;
  }

  async function hash(contentBuffer) {
    const buffer = normalizeBuffer(contentBuffer);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  async function save({ submission_id, filename, format, contentBuffer, forceFailure } = {}) {
    const submissionId = String(submission_id || "").trim();
    if (!submissionId) {
      throw new Error("submission_id is required");
    }

    const buffer = normalizeBuffer(contentBuffer);
    const content_hash = await hash(buffer);
    const storedFilename = makeStoredFilename(submissionId, filename);
    const absolutePath = ensureNotPublicPath(buildAbsolutePath(storedFilename));

    try {
      fs.writeFileSync(absolutePath, buffer);
      if (forceFailure || process.env.MANUSCRIPT_STORAGE_FORCE_FAIL === "1") {
        throw new Error("MANUSCRIPT_STORAGE_WRITE_FAILED");
      }
    } catch (error) {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
      const wrapped = new Error("upload_failed");
      wrapped.code = "upload_failed";
      wrapped.cause = error;
      throw wrapped;
    }

    const existingId = activeBySubmission.get(submissionId);
    if (existingId && privateFiles.has(existingId)) {
      const previous = privateFiles.get(existingId);
      previous.is_active = false;
      if (previous.file_path && fs.existsSync(previous.file_path)) {
        fs.unlinkSync(previous.file_path);
      }
    }

    const file_id = `ms_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const record = {
      file_id,
      submission_id: submissionId,
      filename: String(filename || ""),
      format: String(format || path.extname(filename || "").slice(1) || ""),
      size_bytes: buffer.length,
      content_hash,
      file_path: absolutePath,
      uploaded_at: new Date().toISOString(),
      is_active: true,
    };

    privateFiles.set(file_id, record);
    activeBySubmission.set(submissionId, file_id);

    return snapshot(record);
  }

  async function getActiveBySubmissionId(submissionId) {
    const activeId = activeBySubmission.get(String(submissionId || ""));
    return snapshot(activeId ? privateFiles.get(activeId) : null);
  }

  async function readContent(fileId) {
    const record = privateFiles.get(String(fileId || ""));
    if (!record) {
      return null;
    }
    const filePath = ensureNotPublicPath(record.file_path);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath);
  }

  async function deleteById(fileId) {
    const record = privateFiles.get(String(fileId || ""));
    if (!record) {
      return false;
    }

    if (record.file_path && fs.existsSync(record.file_path)) {
      fs.unlinkSync(record.file_path);
    }

    privateFiles.delete(record.file_id);
    if (activeBySubmission.get(record.submission_id) === record.file_id) {
      activeBySubmission.delete(record.submission_id);
    }

    return true;
  }

  function getPublicUrl() {
    return null;
  }

  return {
    hash,
    save,
    getActiveBySubmissionId,
    readContent,
    deleteById,
    getPublicUrl,
  };
}

module.exports = {
  createManuscriptStorage,
};
