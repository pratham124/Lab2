function createNotification({
  id,
  invitationId,
  channel = "email",
  deliveryStatus = "pending",
  sentAt = null,
  failureReason = null,
  payload = null,
} = {}) {
  return {
    id: String(id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`).trim(),
    invitationId: String(invitationId || "").trim(),
    channel: String(channel || "email").trim(),
    deliveryStatus: String(deliveryStatus || "pending").trim(),
    sentAt,
    failureReason,
    payload,
  };
}

module.exports = {
  createNotification,
};
