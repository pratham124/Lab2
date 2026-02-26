const path = require("path");
const responseService = require("../services/response_service");
const { createMessageService } = require("../services/message_service");

function wantsJson(headers) {
  const accept = (headers && headers.accept) || "";
  const contentType = (headers && headers["content-type"]) || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPaymentController({ paymentService, messageService, authGuard, response } = {}) {
  if (!paymentService) {
    throw new Error("paymentService is required");
  }

  const responses = response || responseService;
  const messages = messageService || createMessageService();
  const guard = authGuard || { requireAttendee: () => ({ ok: true }) };

  const layoutPath = path.join(__dirname, "..", "views", "layout.html");
  const initiatePath = path.join(__dirname, "..", "views", "payment_initiate.html");
  const statusPath = path.join(__dirname, "..", "views", "payment_status.html");

  function renderLayout({ title, styles = "", scripts = "", content } = {}) {
    return responses.renderView({
      templatePath: layoutPath,
      replacements: {
        title,
        styles,
        scripts,
        content,
      },
    });
  }

  function formatAmount(amount, currency = "USD") {
    if (amount === null || typeof amount === "undefined") {
      return "TBD";
    }

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount);
    } catch (_error) {
      return `${amount} ${currency}`;
    }
  }

  function renderInitiatePage({ registration, statusResponse, message }) {
    const fee = formatAmount(registration.fee_amount, "USD");
    const statusLabel = statusResponse ? statusResponse.status_label : "Unpaid";
    const statusMessage = statusResponse ? statusResponse.message || "" : "";
    const reason = statusResponse && statusResponse.reason_code ? statusResponse.reason_code : "";
    const noteBlock = statusMessage
      ? `<p class="payment-status">${escapeHtml(statusMessage)}</p>`
      : "";

    const content = responses.renderView({
      templatePath: initiatePath,
      replacements: {
        registrationId: escapeHtml(registration.registration_id),
        feeAmount: escapeHtml(fee),
        statusLabel: escapeHtml(statusLabel),
        statusMessage: noteBlock,
        reasonCode: escapeHtml(reason),
        message: message ? escapeHtml(message) : "",
      },
    });

    return renderLayout({
      title: "Pay Registration Fee",
      content,
      styles: "",
      scripts: "",
    });
  }

  function renderStatusPage({ registration, statusResponse, records = [] } = {}) {
    const recordItems = records
      .map((record) => {
        return `<li><strong>${escapeHtml(formatAmount(record.amount, record.currency))}</strong> on ${escapeHtml(
          record.created_at
        )} (Ref: ${escapeHtml(record.gateway_reference)})</li>`;
      })
      .join("");

    const recordsBlock = recordItems
      ? `<ul class="payment-records">${recordItems}</ul>`
      : "<p class=\"payment-empty\">No payment records yet.</p>";

    const content = responses.renderView({
      templatePath: statusPath,
      replacements: {
        registrationId: escapeHtml(registration.registration_id),
        statusLabel: escapeHtml(statusResponse.status_label || ""),
        statusMessage: escapeHtml(statusResponse.message || ""),
        reasonCode: escapeHtml(statusResponse.reason_code || ""),
        records: recordsBlock,
      },
    });

    return renderLayout({
      title: "Payment Status",
      content,
    });
  }

  async function handleGetInitiatePage({ headers, params } = {}) {
    const authCheck = guard.requireAttendee(headers || {});
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const registrationId = String((params && params.registration_id) || "").trim();
    const result = paymentService.getRegistrationSummary({ registrationId });
    if (result.type === "not_found") {
      return responses.html(404, "Registration not found.");
    }

    const statusResult = paymentService.getPaymentStatus({ registrationId });
    const statusResponse = messages.buildStatusResponse(statusResult.registration);

    return responses.html(
      200,
      renderInitiatePage({
        registration: result.registration,
        statusResponse,
        message: result.message,
      })
    );
  }

  async function handleInitiate({ headers, params } = {}) {
    const authCheck = guard.requireAttendee(headers || {});
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const registrationId = String((params && params.registration_id) || "").trim();
    const result = paymentService.initiatePayment({
      registrationId,
      actorId: authCheck.actor ? authCheck.actor.id : "",
    });

    if (result.type === "not_found") {
      if (wantsJson(headers)) {
        return responses.json(404, messages.errorForCode("not_found"));
      }
      return responses.html(404, "Registration not found.");
    }

    if (result.type === "service_unavailable") {
      if (wantsJson(headers)) {
        return responses.json(503, messages.errorForCode("service_unavailable"));
      }
      return responses.html(503, "Payment service unavailable.");
    }

    if (result.type === "already_paid") {
      const status = messages.buildStatusResponse(result.registration, {
        reasonCode: "not_eligible_already_paid",
      });
      const latestRecord = result.latestRecord
        ? {
            amount: result.latestRecord.amount,
            currency: result.latestRecord.currency,
            createdAt: result.latestRecord.created_at,
            confirmedAt: result.latestRecord.confirmed_at,
            gatewayReference: result.latestRecord.gateway_reference,
          }
        : null;
      if (wantsJson(headers)) {
        return responses.json(409, {
          status,
          latestRecord,
        });
      }

      const statusPage = renderStatusPage({
        registration: result.registration,
        statusResponse: status,
        records: result.latestRecord ? [result.latestRecord] : [],
      });
      return responses.html(200, statusPage);
    }

    const statusResponse = messages.buildStatusResponse(result.registration);

    if (wantsJson(headers)) {
      return responses.json(200, statusResponse);
    }

    const statusPage = renderStatusPage({
      registration: result.registration,
      statusResponse,
      records: result.payment
        ? [result.payment]
        : result.latestRecord
          ? [result.latestRecord]
          : [],
    });

    return responses.html(200, statusPage);
  }

  async function handleConfirm({ body } = {}) {
    const payload = body || {};
    const result = paymentService.confirmPayment({
      registrationId: payload.registration_id,
      gatewayReference: payload.gateway_reference,
      status: payload.status,
    });

    if (result.type === "validation_error") {
      return responses.json(400, messages.errorForCode("missing_parameters"));
    }
    if (result.type === "not_found") {
      return responses.json(404, messages.errorForCode("not_found"));
    }

    const statusResponse = result.registration
      ? messages.buildStatusResponse(result.registration)
      : null;

    return responses.json(200, {
      outcome: result.type === "duplicate" ? "duplicate_ignored" : "processed",
      status: statusResponse,
    });
  }

  async function handleStatus({ headers, params } = {}) {
    const authCheck = guard.requireAttendee(headers || {});
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const registrationId = String((params && params.registration_id) || "").trim();
    const result = paymentService.getPaymentStatus({ registrationId });
    if (result.type === "not_found") {
      return responses.json(404, messages.errorForCode("not_found"));
    }

    const statusResponse = messages.buildStatusResponse(result.registration);
    if (wantsJson(headers)) {
      return responses.json(200, statusResponse);
    }

    const statusPage = renderStatusPage({
      registration: result.registration,
      statusResponse,
      records: result.latestRecord ? [result.latestRecord] : [],
    });

    return responses.html(200, statusPage);
  }

  async function handleRecords({ headers, params } = {}) {
    const authCheck = guard.requireAttendee(headers || {});
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const registrationId = String((params && params.registration_id) || "").trim();
    const result = paymentService.getPaymentRecords({ registrationId });
    if (result.type === "not_found") {
      return responses.json(404, messages.errorForCode("not_found"));
    }

    return responses.json(200, {
      registrationId,
      records: (result.records || []).map((record) => ({
        amount: record.amount,
        currency: record.currency,
        createdAt: record.created_at,
        confirmedAt: record.confirmed_at,
        gatewayReference: record.gateway_reference,
      })),
    });
  }

  return {
    handleGetInitiatePage,
    handleInitiate,
    handleConfirm,
    handleStatus,
    handleRecords,
  };
}

module.exports = {
  createPaymentController,
};
