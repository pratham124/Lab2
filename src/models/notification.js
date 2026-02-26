function createNotification({
  id,
  invitationId,
  authorId,
  paperId,
  type = "review_invitation",
  channel = "email",
  status,
  deliveryStatus = "pending",
  sentAt = null,
  failureReason = null,
  retryCount = 0,
  lastAttemptAt = null,
  payload = null,
} = {}) {
  const normalizedStatus = String(status || deliveryStatus || "pending").trim();
  return {
    id: String(id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`).trim(),
    invitationId: String(invitationId || "").trim(),
    authorId: String(authorId || "").trim(),
    paperId: String(paperId || "").trim(),
    type: String(type || "review_invitation").trim(),
    channel: String(channel || "email").trim(),
    status: normalizedStatus,
    deliveryStatus: normalizedStatus,
    sentAt,
    failureReason,
    retryCount: Number(retryCount || 0),
    lastAttemptAt,
    payload,
  };
}

module.exports = {
  createNotification,
};
