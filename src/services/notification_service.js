const fs = require("fs");
const path = require("path");
const { createNotificationAttempt } = require("../models/notification_attempt");
const { NOTIFICATION_STATUS } = require("./notification_status");

function loadTemplate() {
  try {
    return fs.readFileSync(
      path.join(__dirname, "..", "views", "templates", "review-invitation-notification.txt"),
      "utf8"
    );
  } catch (_error) {
    return "You have a new review invitation for {{paper_title}}. Respond by {{response_due_at}}.";
  }
}

function renderTemplate(template, values) {
  return template
    .replaceAll("{{paper_title}}", String(values && values.paper_title))
    .replaceAll("{{response_due_at}}", String(values && values.response_due_at));
}

function createNotificationService({ inviter, logger, dataAccess } = {}) {
  const invitationSender =
    inviter && typeof inviter.sendInvitation === "function"
      ? inviter
      : {
          async sendInvitation() {},
        };

  const sink =
    logger && typeof logger.warn === "function"
      ? logger
      : {
          warn() {},
        };
  const template = loadTemplate();

  async function sendReviewerInvitations({ paper, reviewers, assignments } = {}) {
    const failures = [];

    for (const reviewer of reviewers || []) {
      try {
        await invitationSender.sendInvitation({
          paper,
          reviewer,
          assignments,
        });
      } catch (error) {
        const reason = error && error.message ? error.message : "invitation_failed";
        failures.push({ reviewerId: reviewer.id, reason });
        sink.warn(
          JSON.stringify({
            event: "reviewer_invitation_failed",
            paper_id: paper && paper.id,
            reviewer_id: reviewer.id,
            reason,
            at: new Date().toISOString(),
          })
        );
      }
    }

    if (failures.length > 0) {
      return {
        type: "partial_failure",
        warningCode: "invitation_partial_failure",
        warningMessage:
          "Assignments were saved, but one or more reviewer invitations failed and were logged for retry.",
        failures,
      };
    }

    return {
      type: "sent",
      failures: [],
    };
  }

  async function sendInvitationNotification({ invitation, reviewer, paper } = {}) {
    const payload = {
      paper_title: paper && paper.title ? paper.title : "Untitled paper",
      response_due_at: invitation && invitation.responseDueAt ? invitation.responseDueAt : "N/A",
    };

    try {
      await invitationSender.sendInvitation({
        paper,
        reviewer,
        invitation,
        subject: `Review invitation for ${payload.paper_title}`,
        body: renderTemplate(template, payload),
      });

      if (dataAccess && typeof dataAccess.createNotificationRecord === "function") {
        dataAccess.createNotificationRecord({
          invitationId: invitation && invitation.id,
          channel: "email",
          deliveryStatus: "sent",
          sentAt: new Date().toISOString(),
          payload,
        });
      }

      return { type: "sent" };
    } catch (error) {
      const reason = error && error.message ? error.message : "notification_failed";
      if (dataAccess && typeof dataAccess.createNotificationRecord === "function") {
        dataAccess.createNotificationRecord({
          invitationId: invitation && invitation.id,
          channel: "email",
          deliveryStatus: "failed",
          sentAt: new Date().toISOString(),
          failureReason: reason,
          payload,
        });
      }

      sink.warn(
        JSON.stringify({
          event: "review_invitation_notification_failed",
          invitation_id: invitation && invitation.id,
          reviewer_id: reviewer && reviewer.id,
          reason,
          at: new Date().toISOString(),
        })
      );
      return { type: "failed", reason };
    }
  }

  return {
    sendReviewerInvitations,
    sendInvitationNotification,
  };
}

function createDecisionNotificationService({ repository, notifier } = {}) {
  if (!repository) {
    throw new Error("repository is required");
  }

  const sender =
    notifier && typeof notifier.sendDecisionNotification === "function"
      ? notifier
      : {
          async sendDecisionNotification() {},
        };

  async function sendToRecipients({ paper, decision, recipients }) {
    const failedAuthors = [];

    for (const author of recipients) {
      const authorId = String((author && author.id) || "").trim();
      const authorEmail = String((author && author.email) || "").trim();
      let status = "delivered";
      let errorReason = null;

      if (!authorId || !authorEmail) {
        status = "failed";
        errorReason = "missing_recipient_email";
      } else {
        try {
          await sender.sendDecisionNotification({
            paper,
            decision,
            author,
          });
        } catch (error) {
          status = "failed";
          errorReason = error && error.message ? error.message : "notification_failed";
        }
      }

      if (status === "failed") {
        failedAuthors.push(authorId);
      }

      await repository.recordNotificationAttempt(
        createNotificationAttempt({
          paperId: decision.paperId,
          decisionId: decision.id,
          authorId,
          status,
          errorReason,
        })
      );
    }

    if (failedAuthors.length === 0) {
      return {
        notificationStatus: NOTIFICATION_STATUS.SENT,
        failedAuthors: [],
      };
    }

    if (failedAuthors.length === recipients.length) {
      return {
        notificationStatus: NOTIFICATION_STATUS.FAILED,
        failedAuthors,
      };
    }

    return {
      notificationStatus: NOTIFICATION_STATUS.PARTIAL,
      failedAuthors,
    };
  }

  async function sendDecisionNotifications({ paper, decision, authors } = {}) {
    return sendToRecipients({
      paper,
      decision,
      recipients: Array.isArray(authors) ? authors : [],
    });
  }

  async function resendFailedDecisionNotifications({ paper, decision, authors } = {}) {
    const failedAuthorIds = await repository.listLatestFailedAuthorIdsByDecisionId(decision.id);
    if (failedAuthorIds.length === 0) {
      return {
        type: "not_found",
      };
    }

    const targets = (Array.isArray(authors) ? authors : []).filter((author) =>
      failedAuthorIds.includes(String(author && author.id))
    );

    return sendToRecipients({
      paper,
      decision,
      recipients: targets,
    });
  }

  return {
    sendDecisionNotifications,
    resendFailedDecisionNotifications,
  };
}

module.exports = {
  createNotificationService,
  createDecisionNotificationService,
};
