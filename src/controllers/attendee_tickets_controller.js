const path = require("path");
const responseService = require("../services/response_service");
const { wantsJson } = require("./controller_utils");
const { buildErrorResponse } = require("./error_responses");
const { createAuthGuard } = require("./auth_guard");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createAttendeeTicketsController({
  confirmationTicketService,
  authGuard,
  response,
  errorResponseBuilder,
} = {}) {
  if (!confirmationTicketService) {
    throw new Error("confirmationTicketService is required");
  }

  const guard = authGuard || createAuthGuard();
  const responses = response || responseService;
  const buildError = errorResponseBuilder || buildErrorResponse;
  const layoutPath = path.join(__dirname, "..", "views", "layout.html");
  const listPath = path.join(__dirname, "..", "views", "attendee_tickets.html");
  const accessDeniedPath = path.join(__dirname, "..", "views", "access_denied.html");
  const errorPath = path.join(__dirname, "..", "views", "error_generic.html");

  function renderLayout({ title, content } = {}) {
    return responses.renderView({
      templatePath: layoutPath,
      replacements: {
        title: escapeHtml(title || "My Tickets"),
        styles: "",
        scripts: "",
        content,
      },
    });
  }

  function renderListView({ tickets, retentionNotice } = {}) {
    const items = tickets
      .map((ticket) => {
        const amount = ticket.amount === null || typeof ticket.amount === "undefined"
          ? "TBD"
          : `$${Number(ticket.amount).toFixed(2)}`;
        return `<li class="ticket-item">
  <div class="ticket-meta">
    <strong>Invoice:</strong> ${escapeHtml(ticket.invoice_number || "")}
  </div>
  <div class="ticket-meta">
    <strong>Payment Ref:</strong> ${escapeHtml(ticket.payment_reference || "")}
  </div>
  <div class="ticket-meta">
    <strong>Amount:</strong> ${escapeHtml(amount)}
  </div>
  <div class="ticket-meta">
    <strong>Issued:</strong> ${escapeHtml(ticket.issued_at || "")}
  </div>
  <a href="/me/tickets/${escapeHtml(ticket.ticket_id)}">View ticket</a>
</li>`;
      })
      .join("\n");

    return responses.renderView({
      templatePath: listPath,
      replacements: {
        tickets: items || "",
        emptyState: items ? "" : "<p class=\"empty-state\">No tickets available.</p>",
        retentionNotice: retentionNotice ? `<p class=\"notice\">${escapeHtml(retentionNotice)}</p>` : "",
      },
    });
  }

  function renderAccessDenied() {
    return responses.renderView({
      templatePath: accessDeniedPath,
      replacements: {
        message: "Access denied.",
      },
    });
  }

  function renderErrorView({ title, message, nextStep, supportContact, backLink } = {}) {
    return responses.renderView({
      templatePath: errorPath,
      replacements: {
        title: escapeHtml(title || "Ticket Error"),
        message: escapeHtml(message || "Unable to load ticket."),
        nextStep: escapeHtml(nextStep || "Please try again later."),
        supportContact: escapeHtml(supportContact || ""),
        backLink: escapeHtml(backLink || "/"),
      },
    });
  }

  function serializeTicket(ticket, deliveryAttempts) {
    if (!ticket) {
      return null;
    }
    return {
      ticketId: ticket.ticket_id,
      attendeeId: ticket.attendee_id,
      paymentReference: ticket.payment_reference,
      invoiceNumber: ticket.invoice_number,
      amount: ticket.amount,
      registrationStatus: ticket.registration_status,
      issuedAt: ticket.issued_at,
      retentionExpiresAt: ticket.retention_expires_at,
      deliveryAttempts: deliveryAttempts || [],
    };
  }

  async function handleList({ headers } = {}) {
    const authCheck = guard.requireAttendee(headers || {});
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const attendeeId = authCheck.actor ? authCheck.actor.id : "";
    const activeTickets = confirmationTicketService.listTicketsForAttendee({
      attendeeId,
    });
    const allTickets = confirmationTicketService.listTicketsForAttendee({
      attendeeId,
      includeExpired: true,
    });
    const safeActiveTickets = activeTickets.filter(Boolean);
    const safeAllTickets = allTickets.filter(Boolean);
    const expiredCount = Math.max(safeAllTickets.length - safeActiveTickets.length, 0);
    const retentionNotice =
      expiredCount > 0
        ? "Some tickets are no longer available because the retention period ended."
        : "";

    if (wantsJson(headers || {})) {
      const payload = activeTickets.map((ticket) =>
        serializeTicket(
          ticket,
          ticket ? confirmationTicketService.listDeliveryAttempts(ticket.ticket_id) : []
        )
      );
      return responses.json(200, {
        tickets: payload,
        expiredCount,
      });
    }

    return responses.html(
      200,
      renderLayout({
        title: retentionNotice ? "My Tickets" : undefined,
        content: renderListView({
          tickets: safeActiveTickets,
          retentionNotice,
        }),
      })
    );
  }

  async function handleGet({ headers, params } = {}) {
    const authCheck = guard.requireAttendee(headers || {});
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const attendeeId = authCheck.actor ? authCheck.actor.id : "";
    const ticketId = String((params && params.ticket_id) || "").trim();

    const result = confirmationTicketService.getTicketForAttendee({ attendeeId, ticketId });

    if (result.type === "forbidden") {
      const errorPayload = buildError("access_denied");
      if (wantsJson(headers || {})) {
        return responses.json(403, errorPayload);
      }
      return responses.html(
        403,
        renderLayout({
          title: "Access Denied",
          content: renderAccessDenied(),
        })
      );
    }

    if (result.type === "not_found") {
      const errorPayload = buildError("ticket_not_found");
      if (wantsJson(headers || {})) {
        return responses.json(404, errorPayload);
      }
      return responses.html(
        404,
        renderLayout({
          title: "Ticket Not Found",
          content: renderErrorView({
            title: "Ticket Not Found",
            message: errorPayload.message,
            nextStep: "Please check your ticket list and try again.",
            supportContact: errorPayload.support_contact,
            backLink: "/me/tickets",
          }),
        })
      );
    }

    if (result.type === "expired") {
      const errorPayload = buildError("ticket_retention_expired");
      if (wantsJson(headers || {})) {
        return responses.json(410, errorPayload);
      }
      return responses.html(
        410,
        renderLayout({
          title: "Ticket Expired",
          content: renderErrorView({
            title: "Ticket Expired",
            message: errorPayload.message,
            nextStep: "Contact support if you need additional help.",
            supportContact: errorPayload.support_contact,
            backLink: "/me/tickets",
          }),
        })
      );
    }

    if (result.type !== "success") {
      const errorPayload = buildError("ticket_generation_failed");
      if (wantsJson(headers || {})) {
        return responses.json(500, errorPayload);
      }
      return responses.html(
        500,
        renderLayout({
          title: "Ticket Error",
          content: renderErrorView(),
        })
      );
    }

    const ticketPayload = serializeTicket(
      result.ticket,
      confirmationTicketService.listDeliveryAttempts(result.ticket.ticket_id)
    );

    if (wantsJson(headers || {})) {
      return responses.json(200, ticketPayload);
    }

    return responses.html(
      200,
      renderLayout({
        title: "Ticket Detail",
        content: renderListView({
          tickets: [result.ticket],
        }),
      })
    );
  }

  return {
    handleList,
    handleGet,
  };
}

module.exports = {
  createAttendeeTicketsController,
};
