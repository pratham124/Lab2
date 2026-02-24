const { createPaperSubmission } = require("../models/paper_submission");
const { createManuscriptFile } = require("../models/manuscript_file");
const {
  MAX_MANUSCRIPT_SIZE_BYTES,
  ACCEPTED_MANUSCRIPT_EXTENSIONS,
} = require("../lib/submission_constraints");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function extensionOf(filename) {
  const raw = String(filename || "").trim().toLowerCase();
  const index = raw.lastIndexOf(".");
  return index > -1 ? raw.slice(index + 1) : "";
}

function toKeywords(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function trimText(value) {
  return String(value || "").trim();
}

function isLikelyInvalidLatexZip(filename, contentBuffer) {
  const ext = extensionOf(filename);
  if (ext !== "zip") {
    return false;
  }

  if (!Buffer.isBuffer(contentBuffer) || contentBuffer.length < 4) {
    return true;
  }

  const signature = contentBuffer.subarray(0, 2).toString("hex").toLowerCase();
  return signature !== "504b";
}

function createSubmissionService({
  submissionRepository,
  manuscriptStorage,
  submissionWindowProvider,
  failureLogger,
} = {}) {
  const submissionWindow =
    submissionWindowProvider && typeof submissionWindowProvider.current === "function"
      ? submissionWindowProvider
      : {
          current() {
            return {
              submission_window_id: "default_window",
              opens_at: "1970-01-01T00:00:00.000Z",
              closes_at: "2999-01-01T00:00:00.000Z",
            };
          },
        };
  const logger =
    failureLogger && typeof failureLogger.log === "function"
      ? failureLogger
      : {
          log() {},
        };

  function validateMetadata(input = {}) {
    const errors = {};

    if (!String(input.title || "").trim()) {
      errors.title = "Title is required.";
    }
    if (!String(input.abstract || "").trim()) {
      errors.abstract = "Abstract is required.";
    }
    if (!String(input.keywords || "").trim()) {
      errors.keywords = "Keywords are required.";
    }
    if (!String(input.affiliation || "").trim()) {
      errors.affiliation = "Affiliation is required.";
    }

    const email = normalizeEmail(input.contact_email);
    if (!email) {
      errors.contact_email = "Contact email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.contact_email = "Contact email must be valid.";
    }

    return errors;
  }

  function normalizeManuscript(input = {}) {
    const manuscript = input.manuscript || null;

    if (manuscript && typeof manuscript === "object") {
      return {
        filename: manuscript.filename || "",
        size_bytes: Number(manuscript.sizeBytes || manuscript.size_bytes || 0),
        contentBuffer: Buffer.isBuffer(manuscript.contentBuffer)
          ? manuscript.contentBuffer
          : Buffer.from(manuscript.content || "", "utf8"),
      };
    }

    const filename = input.manuscript_filename || "";
    const providedSize = Number(input.manuscript_size_bytes || 0);
    const base64 = String(input.manuscript_content_base64 || "");
    const textFallback = String(input.manuscript_content || "");

    let contentBuffer = Buffer.alloc(0);
    if (base64) {
      try {
        contentBuffer = Buffer.from(base64, "base64");
      } catch (error) {
        contentBuffer = Buffer.alloc(0);
      }
    } else if (textFallback) {
      contentBuffer = Buffer.from(textFallback, "utf8");
    }

    return {
      filename,
      size_bytes: providedSize || contentBuffer.length,
      contentBuffer,
    };
  }

  function validateManuscript(input = {}) {
    const errors = {};
    const manuscript = normalizeManuscript(input);

    if (!manuscript.filename) {
      errors.manuscript = "Manuscript is required.";
      return { errors, manuscript: null };
    }

    const ext = extensionOf(manuscript.filename);
    if (!ACCEPTED_MANUSCRIPT_EXTENSIONS.includes(ext)) {
      errors.manuscript = "Manuscript must be PDF, DOCX, or LaTeX ZIP.";
    }

    if (manuscript.size_bytes <= 0) {
      errors.manuscript = "Manuscript file is empty or unreadable.";
    } else if (manuscript.size_bytes > MAX_MANUSCRIPT_SIZE_BYTES) {
      errors.manuscript = "Manuscript exceeds the 7 MB limit.";
    }

    if (isLikelyInvalidLatexZip(manuscript.filename, manuscript.contentBuffer)) {
      errors.manuscript = "LaTeX submission must be a valid ZIP archive.";
    }

    return { errors, manuscript };
  }

  async function submit(payload = {}) {
    const metadataErrors = validateMetadata(payload);
    const fileCheck = validateManuscript(payload);
    const validationErrors = {
      ...metadataErrors,
      ...fileCheck.errors,
    };

    if (Object.keys(validationErrors).length > 0) {
      return {
        type: "validation_error",
        status: 400,
        message: "Please correct highlighted fields.",
        fieldErrors: validationErrors,
      };
    }

    const activeWindow = submissionWindow.current();
    const authorId = String(payload.author_id || "").trim();
    const hash = await manuscriptStorage.hash(fileCheck.manuscript.contentBuffer);

    const duplicate = await submissionRepository.findDuplicate({
      author_id: authorId,
      title: payload.title,
      content_hash: hash,
      submission_window_id: activeWindow.submission_window_id,
    });
    if (duplicate) {
      return {
        type: "duplicate",
        status: 409,
        message: "A submission already exists for this paper.",
      };
    }

    try {
      const submission = createPaperSubmission({
        author_id: authorId,
        title: trimText(payload.title),
        abstract: trimText(payload.abstract),
        keywords: toKeywords(payload.keywords),
        affiliation: trimText(payload.affiliation),
        contact_email: normalizeEmail(payload.contact_email),
        submission_window_id: activeWindow.submission_window_id,
      });

      const stored = await manuscriptStorage.save({
        submission_id: submission.submission_id,
        filename: fileCheck.manuscript.filename,
        format: extensionOf(fileCheck.manuscript.filename),
        contentBuffer: fileCheck.manuscript.contentBuffer,
      });

      submission.manuscript = createManuscriptFile({
        submission_id: submission.submission_id,
        filename: stored.filename,
        format: stored.format,
        size_bytes: stored.size_bytes,
        content_hash: stored.content_hash,
      });

      await submissionRepository.create(submission);

      return {
        type: "success",
        status: 201,
        submission,
      };
    } catch (error) {
      logger.log({
        timestamp: new Date().toISOString(),
        outcome: "system_error",
        reason: "submission_save_failure",
        error_code: error && error.message ? error.message : "UNKNOWN_ERROR",
      });
      return {
        type: "system_error",
        status: 500,
        message: "save_failure",
      };
    }
  }

  async function getSubmission(submissionId) {
    return submissionRepository.findById(submissionId);
  }

  return {
    submit,
    getSubmission,
    validateMetadata,
    validateManuscript,
  };
}

module.exports = {
  createSubmissionService,
  __test: {
    extensionOf,
    toKeywords,
    trimText,
    isLikelyInvalidLatexZip,
  },
};
