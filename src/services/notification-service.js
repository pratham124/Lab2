function createNotificationService({ submissionRepository, notifier } = {}) {
  if (!submissionRepository) {
    throw new Error("submissionRepository is required");
  }

  const emailNotifier =
    notifier && typeof notifier.sendEmail === "function"
      ? notifier
      : {
          async sendEmail() {},
        };

  async function notifyDecisionPublished({ paper_id, submitting_author } = {}) {
    const paperId = String(paper_id || "").trim();
    const recipient = submitting_author || {};
    const recipientAuthorId = String(recipient.id || "").trim();
    const recipientEmail = String(recipient.email || "").trim();

    if (!paperId || !recipientAuthorId || !recipientEmail) {
      return {
        type: "validation_error",
        status: 400,
      };
    }

    const sentAt = new Date().toISOString();
    try {
      await emailNotifier.sendEmail({
        to: recipientEmail,
        subject: "Final paper decision available",
        body: "Your final paper decision is now available in the CMS.",
      });

      const notification = {
        id: `notification_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        paper_id: paperId,
        recipient_author_id: recipientAuthorId,
        channel: "email",
        status: "sent",
        sent_at: sentAt,
        failure_reason: null,
      };

      await submissionRepository.recordNotification(notification);
      return {
        type: "sent",
        status: 200,
        notification,
      };
    } catch (error) {
      const notification = {
        id: `notification_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        paper_id: paperId,
        recipient_author_id: recipientAuthorId,
        channel: "email",
        status: "failed",
        sent_at: sentAt,
        failure_reason: error && error.message ? error.message : "notification_failed",
      };

      await submissionRepository.recordNotification(notification);
      return {
        type: "failed",
        status: 503,
        notification,
      };
    }
  }

  return {
    notifyDecisionPublished,
  };
}

module.exports = {
  createNotificationService,
};
