const fs = require("fs");
const path = require("path");
const {
  mapValidationErrors,
  composeSafeSaveFailureMessage,
  fileRequirementMessage,
} = require("../lib/response_helpers");

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, "..", "views", name), "utf8");
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

function createSubmissionController({ submissionService, sessionService, draftService }) {
  const formTemplate = loadTemplate("submission_form.html");
  const confirmationTemplate = loadTemplate("submission_confirm.html");

  function getSession(req) {
    const cookies = parseCookies((req && req.headers) || {});
    return sessionService.validate(cookies.cms_session || "");
  }

  function renderForm({
    values = {},
    fieldErrors = {},
    formMessage = "",
    failureMessage = "",
    draftSubmissionId = "",
    lastSavedAt = "",
  } = {}) {
    const normalized = mapValidationErrors(fieldErrors);

    return renderTemplate(formTemplate, {
      title: values.title || "",
      abstract: values.abstract || "",
      keywords: values.keywords || "",
      affiliation: values.affiliation || "",
      contact_email: values.contact_email || "",
      titleError: normalized.title,
      abstractError: normalized.abstract,
      keywordsError: normalized.keywords,
      affiliationError: normalized.affiliation,
      contactEmailError: normalized.contact_email,
      manuscriptError: normalized.manuscript,
      formMessage,
      failureMessage,
      fileRequirements: fileRequirementMessage(),
      fieldErrorsJson: JSON.stringify(normalized),
      draftSubmissionId,
      lastSavedAt,
    });
  }

  async function handleGetForm(req) {
    const session = getSession(req);
    if (!session) {
      if (wantsJson(req && req.headers)) {
        return {
          status: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "session_expired",
            message: "Session expired. Please log in again.",
          }),
        };
      }
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    const requestedDraftId = String((req && req.query && req.query.draft) || "").trim();
    if (requestedDraftId && draftService && typeof draftService.getDraft === "function") {
      const draftResult = await draftService.getDraft({
        submission_id: requestedDraftId,
        author_id: session.user_id,
      });

      if (draftResult.type === "success") {
        return {
          status: 200,
          headers: { "Content-Type": "text/html" },
          body: renderForm({
            values: draftResult.draft.data || {},
            formMessage: "Draft loaded.",
            draftSubmissionId: requestedDraftId,
            lastSavedAt: draftResult.draft.saved_at,
          }),
        };
      }
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderForm(),
    };
  }

  async function handlePost(req) {
    const session = getSession(req);
    const payload = (req && req.body) || {};

    if (!session) {
      if (wantsJson(req && req.headers)) {
        return {
          status: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "session_expired",
            message: "Session expired. Please log in again.",
          }),
        };
      }
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    if (payload.__parse_error === "upload_interrupted") {
      const interruptionMessage = "Upload interrupted. Check your network and try again.";
      if (wantsJson(req && req.headers)) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "upload_interrupted",
            message: interruptionMessage,
          }),
        };
      }
      return {
        status: 400,
        headers: { "Content-Type": "text/html" },
        body: renderForm({
          values: payload,
          failureMessage: interruptionMessage,
        }),
      };
    }

    const result = await submissionService.submit({
      ...payload,
      author_id: session.user_id,
    });

    if (result.type === "success") {
      if (wantsJson(req && req.headers)) {
        return {
          status: 201,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submission_id: result.submission.submission_id,
            status: result.submission.status,
            redirect_to: `/submissions/${result.submission.submission_id}`,
          }),
        };
      }

      return {
        status: 302,
        headers: { Location: `/submissions/${result.submission.submission_id}` },
        body: "",
      };
    }

    if (result.type === "duplicate") {
      if (wantsJson(req && req.headers)) {
        return {
          status: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "duplicate_submission",
            message: result.message,
          }),
        };
      }

      return {
        status: 409,
        headers: { "Content-Type": "text/html" },
        body: renderForm({
          values: payload,
          failureMessage: result.message,
        }),
      };
    }

    if (result.type === "validation_error") {
      if (wantsJson(req && req.headers)) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "validation_error",
            message: result.message,
            fieldErrors: mapValidationErrors(result.fieldErrors),
          }),
        };
      }

      return {
        status: 400,
        headers: { "Content-Type": "text/html" },
        body: renderForm({
          values: payload,
          fieldErrors: result.fieldErrors,
        }),
      };
    }

    const failureMessage = composeSafeSaveFailureMessage();
    if (wantsJson(req && req.headers)) {
      return {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorCode: "save_failure",
          message: failureMessage,
        }),
      };
    }

    return {
      status: 500,
      headers: { "Content-Type": "text/html" },
      body: renderForm({
        values: payload,
        failureMessage,
      }),
    };
  }

  async function handleGetConfirmation(req) {
    const session = getSession(req);
    if (!session) {
      if (wantsJson(req && req.headers)) {
        return {
          status: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            errorCode: "session_expired",
            message: "Session expired. Please log in again.",
          }),
        };
      }
      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    const submissionId = req && req.params ? req.params.submission_id : "";
    const submission = await submissionService.getSubmission(submissionId);
    if (!submission || submission.author_id !== session.user_id) {
      return {
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: wantsJson(req && req.headers)
          ? JSON.stringify({ errorCode: "not_found", message: "Submission not found." })
          : "Not found",
      };
    }

    if (wantsJson(req && req.headers)) {
      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      };
    }

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: renderTemplate(confirmationTemplate, {
        submission_id: submission.submission_id,
        title: submission.title,
        status: submission.status,
      }),
    };
  }

  return {
    handleGetForm,
    handlePost,
    handleGetConfirmation,
  };
}

module.exports = {
  createSubmissionController,
};
