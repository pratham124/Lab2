function normalizeTicketIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function createAttendeeAccount(input = {}) {
  return {
    attendee_id: String(input.attendee_id || input.attendeeId || "").trim(),
    name: String(input.name || "").trim(),
    email: String(input.email || "").trim(),
    registration_status: String(input.registration_status || input.registrationStatus || "")
      .trim()
      .toLowerCase(),
    ticket_ids: normalizeTicketIds(input.ticket_ids || input.ticketIds || input.tickets),
  };
}

module.exports = {
  createAttendeeAccount,
};
