const responseService = require("../services/response_service");
const { createAuthService } = require("../services/auth_service");

function createAdminScheduleController({
  scheduleService,
  notificationService,
  auditLogService,
  authService,
  response,
  conferenceId = "C1",
  conferenceTimezone = "UTC",
} = {}) {
  if (!scheduleService || !notificationService) {
    throw new Error("missing dependencies");
  }

  const auth = authService || createAuthService();
  const responses = response || responseService;
  const audit =
    auditLogService && typeof auditLogService.logNotificationFailure === "function"
      ? auditLogService
      : { logNotificationFailure() {} };

  async function handlePublish({ headers } = {}) {
    const adminCheck = auth.requireAdmin(headers || {});
    if (!adminCheck.ok) {
      return responses.json(adminCheck.status, {
        errorCode: adminCheck.errorCode,
        message: adminCheck.message,
      });
    }

    const published = scheduleService.publishSchedule({
      conferenceId,
      conferenceTimezone,
      publishedBy: adminCheck.actor.id,
    });

    if (published.type === "already_published") {
      return responses.json(409, {
        errorCode: "already_published",
        message: "Final schedule has already been published.",
      });
    }

    if (published.type !== "success") {
      return responses.json(404, {
        errorCode: "schedule_not_found",
        message: "No final schedule exists to publish.",
      });
    }

    const enqueued = notificationService.enqueueFinalScheduleNotifications({
      conferenceId,
      publishedAt: published.publishedAt,
      conferenceTimezone,
    });

    const queued = Array.isArray(enqueued.notifications) ? enqueued.notifications : [];
    for (const notification of queued) {
      if (notification.channel !== "email") {
        continue;
      }
      const result = await notificationService.dispatchFinalScheduleEmail(notification);
      if (result.type === "failed") {
        audit.logNotificationFailure({
          conferenceId,
          authorId: notification.authorId,
          paperId: notification.paperId,
          reason: notification.failureReason,
        });
      }
    }

    return responses.json(200, {
      publishedAt: published.publishedAt,
      notificationsEnqueuedCount: enqueued.notificationsEnqueuedCount,
    });
  }

  return {
    handlePublish,
  };
}

module.exports = {
  createAdminScheduleController,
};
