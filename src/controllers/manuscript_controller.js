const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { canAccessSubmissionManuscript } = require("../services/authz");
const { validateUpload, getFileExtension } = require("../services/upload_validation");
const { mapUploadError } = require("../services/upload_errors");

function parseCookies(headers) {
  const raw = (headers && headers.cookie) || "";
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf("=");
      const key = idx > -1 ? pair.slice(0, idx) : pair;
      const value = idx > -1 ? pair.slice(idx + 1) : "";
      acc[key] = decodeURIComponent(value || "");
      return acc;
    }, {});
}

function wantsJson(headers) {
  const accept = (headers && headers.accept) || "";
  const contentType = (headers && headers["content-type"]) || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function loadUploadTemplate() {
  return fs.readFileSync(path.join(__dirname, "..", "views", "manuscripts", "upload.html"), "utf8");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(template, model) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => escapeHtml(model[key] || ""));
}

function createManuscriptController({ submissionRepository, manuscriptStorage, sessionService }) {
  const template = loadUploadTemplate();
  const tokenLedger = new Map();

  function readSession(req) {
    const cookies = parseCookies((req && req.headers) || {});
    return sessionService.validate(cookies.cms_session || "");
  }

  function fail(status, code, message) {
    return {
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message }),
    };
  }

  function renderUploadPage({ submissionId, successMessage = "", inlineError = "", manuscriptName = "" }) {
    return renderTemplate(template, {
      submissionId,
      successMessage,
      inlineError,
      manuscriptName,
      retryVisible: inlineError ? "true" : "false",
      idempotencyToken: crypto.randomBytes(16).toString("hex"),
    });
  }

  async function loadAuthorizedSubmission(req) {
    const session = readSession(req);
    if (!session) {
      return { error: fail(401, "session_expired", "Session expired. Please log in again.") };
    }

    const submissionId = String((req && req.params && req.params.submission_id) || "");
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) {
      return { error: fail(404, "submission_not_found", "Submission not found.") };
    }

    if (!canAccessSubmissionManuscript({ session, submission })) {
      return { error: fail(403, "forbidden", "You are not authorized to access this manuscript.") };
    }

    return { session, submission, submissionId };
  }

  async function handleGetUploadForm(req) {
    const context = await loadAuthorizedSubmission(req);
    if (context.error) {
      if (wantsJson(req && req.headers)) {
        return context.error;
      }
      if (context.error.status === 401) {
        return { status: 302, headers: { Location: "/login.html" }, body: "" };
      }
      return { status: context.error.status, headers: { "Content-Type": "text/plain" }, body: "Not found" };
    }

    const active = await manuscriptStorage.getActiveBySubmissionId(context.submissionId);
    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderUploadPage({
        submissionId: context.submissionId,
        manuscriptName: active ? active.filename : "",
      }),
    };
  }

  async function handleUpload(req) {
    const context = await loadAuthorizedSubmission(req);
    if (context.error) {
      return context.error;
    }

    const payload = (req && req.body) || {};
    const token = String(payload.idempotency_token || "").trim();
    const ledgerKey = `${context.session.user_id}:${context.submissionId}:${token}`;
    if (token && tokenLedger.has(ledgerKey)) {
      const mapped = mapUploadError({ code: "duplicate_submit" });
      return fail(409, mapped.code, mapped.inlineMessage);
    }
    if (token) {
      tokenLedger.set(ledgerKey, Date.now());
    }

    const upload = payload.file || payload.manuscript || null;
    const validation = validateUpload(upload);
    if (!validation.ok) {
      const mapped = mapUploadError({ code: validation.code });
      if (token) {
        tokenLedger.delete(ledgerKey);
      }
      if (wantsJson(req && req.headers)) {
        return fail(400, mapped.code, mapped.inlineMessage);
      }
      return {
        status: 400,
        headers: { "Content-Type": "text/html" },
        body: renderUploadPage({
          submissionId: context.submissionId,
          inlineError: mapped.inlineMessage,
        }),
      };
    }

    try {
      const stored = await manuscriptStorage.save({
        submission_id: context.submissionId,
        filename: upload.filename,
        format: getFileExtension(upload.filename),
        contentBuffer: upload.contentBuffer || upload.content,
      });

      const updated = {
        ...context.submission,
        manuscript: stored,
        activeManuscriptId: stored.file_id,
        updated_at: new Date().toISOString(),
      };
      await submissionRepository.upsert(updated);

      if (!wantsJson(req && req.headers)) {
        return {
          status: 200,
          headers: { "Content-Type": "text/html" },
          body: renderUploadPage({
            submissionId: context.submissionId,
            successMessage: `Uploaded ${stored.filename} successfully.`,
            manuscriptName: stored.filename,
          }),
        };
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: context.submissionId,
          manuscript: {
            id: stored.file_id,
            filename: stored.filename,
            format: stored.format,
            sizeBytes: stored.size_bytes,
            uploadedAt: stored.uploaded_at,
          },
          isActive: true,
        }),
      };
    } catch (error) {
      if (token) {
        tokenLedger.delete(ledgerKey);
      }
      const mapped = mapUploadError({ code: error && error.code ? error.code : "upload_failed" });
      if (!wantsJson(req && req.headers)) {
        return {
          status: 500,
          headers: { "Content-Type": "text/html" },
          body: renderUploadPage({
            submissionId: context.submissionId,
            inlineError: mapped.inlineMessage,
          }),
        };
      }
      return fail(500, mapped.code, mapped.inlineMessage);
    }
  }

  async function handleGetMetadata(req) {
    const context = await loadAuthorizedSubmission(req);
    if (context.error) {
      return context.error;
    }

    const active = await manuscriptStorage.getActiveBySubmissionId(context.submissionId);
    if (!active) {
      return fail(404, "manuscript_not_found", "No manuscript is attached to this submission.");
    }

    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: context.submissionId,
        manuscript: {
          id: active.file_id,
          filename: active.filename,
          format: active.format,
          sizeBytes: active.size_bytes,
          uploadedAt: active.uploaded_at,
        },
        isActive: true,
      }),
    };
  }

  return {
    handleGetUploadForm,
    handleUpload,
    handleGetMetadata,
  };
}

module.exports = {
  createManuscriptController,
};
