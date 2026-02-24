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

function isJsonRequest(headers) {
  const accept = (headers && headers.accept) || "";
  const contentType = (headers && headers["content-type"]) || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function createDraftController({ draftService, sessionService }) {
  const idempotencyLedger = new Map();

  function getSession(req) {
    const cookies = parseCookies((req && req.headers) || {});
    return sessionService.validate(cookies.cms_session || "");
  }

  function asJson(status, payload) {
    return {
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  }

  async function handleGetDraft(req) {
    const session = getSession(req);
    if (!session) {
      return asJson(401, {
        errorCode: "session_expired",
        message: "Session expired. Please log in again.",
      });
    }

    const submissionId = String((req && req.params && req.params.submission_id) || "").trim();
    const result = await draftService.getDraft({
      submission_id: submissionId,
      author_id: session.user_id,
    });

    if (result.type === "success") {
      return asJson(200, {
        draftId: result.draft.draft_id,
        submissionId: result.draft.submission_id,
        authorId: result.draft.author_id,
        savedAt: result.draft.saved_at,
        data: result.draft.data,
      });
    }

    if (result.type === "forbidden") {
      return asJson(403, {
        errorCode: "access_denied",
        message: result.message,
      });
    }

    if (result.type === "validation_error") {
      return asJson(400, {
        errorCode: "validation_error",
        message: result.message,
      });
    }

    return asJson(404, {
      errorCode: "draft_not_found",
      message: "Draft not found.",
    });
  }

  async function handlePutDraft(req) {
    const session = getSession(req);
    if (!session) {
      if (isJsonRequest(req && req.headers)) {
        return asJson(401, {
          errorCode: "session_expired",
          message: "Session expired. Please log in again.",
        });
      }

      return {
        status: 302,
        headers: { Location: "/login.html" },
        body: "",
      };
    }

    const submissionId = String((req && req.params && req.params.submission_id) || "").trim();
    const body = (req && req.body) || {};
    const tokenFromHeader = (req && req.headers && req.headers["x-idempotency-key"]) || "";
    const tokenFromBody = body.idempotency_key || "";
    const idempotencyKey = String(tokenFromHeader || tokenFromBody).trim();

    const ledgerKey = `${session.user_id}:${submissionId}:${idempotencyKey}`;
    if (idempotencyKey && idempotencyLedger.has(ledgerKey)) {
      return idempotencyLedger.get(ledgerKey);
    }

    const result = await draftService.saveDraft({
      submission_id: submissionId,
      author_id: session.user_id,
      data: body.data,
      expected_saved_at: body.expectedSavedAt,
    });

    if (result.type === "validation_error") {
      return asJson(400, {
        errorCode: "validation_error",
        message: result.message,
        fieldErrors: result.fieldErrors || {},
      });
    }

    if (result.type === "forbidden") {
      return asJson(403, {
        errorCode: "access_denied",
        message: result.message,
      });
    }

    if (result.type === "system_error") {
      return asJson(500, {
        errorCode: "save_failure",
        message: result.message,
      });
    }

    const response = asJson(200, {
      draftId: result.draft.draft_id,
      submissionId: result.draft.submission_id,
      authorId: result.draft.author_id,
      savedAt: result.draft.saved_at,
      data: result.draft.data,
      message: result.conflictDetected
        ? "Draft saved. A newer draft existed; latest save has been kept."
        : "Draft saved successfully.",
      conflictPolicy: "last_write_wins",
      conflictDetected: Boolean(result.conflictDetected),
    });

    if (idempotencyKey) {
      idempotencyLedger.set(ledgerKey, response);
    }

    return response;
  }

  return {
    handleGetDraft,
    handlePutDraft,
  };
}

module.exports = {
  createDraftController,
};
