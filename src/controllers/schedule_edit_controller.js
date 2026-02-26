const responseService = require("../services/response_service");
const { createAuthService } = require("../services/auth_service");
const { hasScheduleEditRole, normalizeRole } = require("../services/authz");
const scheduleEditView = require("../views/schedule_edit_view");

function createScheduleEditController({ scheduleService, sessionService, authService, response, view } = {}) {
  if (!scheduleService) {
    throw new Error("scheduleService is required");
  }

  const auth = authService || createAuthService({ sessionService });
  const responses = response || responseService;
  const viewApi = view || scheduleEditView;

  function toActor(headers = {}) {
    const actor = auth.resolveActor(headers) || {};
    return {
      id: String(actor.id || "").trim(),
      role: normalizeRole(actor.role),
    };
  }

  function unauthorizedPayload() {
    return viewApi.renderError({
      errorCode: "ACCESS_DENIED",
      summary: "Only editors can modify the conference schedule.",
      affectedItemId: "",
      recommendedAction: "Sign in with an editor account.",
    });
  }

  function withNoCacheHeaders(result) {
    return {
      ...result,
      headers: {
        ...(result.headers || {}),
        "Cache-Control": "no-store, max-age=0",
      },
    };
  }

  async function handleGetCurrentSchedule({ headers, params } = {}) {
    const actor = toActor(headers || {});
    const conferenceId = String((params && params.conference_id) || "C1").trim();

    const current = scheduleService.getCurrentSchedule({ conferenceId });
    if (current.type !== "success") {
      return withNoCacheHeaders(
        responses.json(404, {
          errorCode: "SCHEDULE_NOT_FOUND",
          summary: "No current schedule is available.",
          affectedItemId: "",
          recommendedAction: "Generate a schedule before editing.",
        })
      );
    }

    const rendered = viewApi.renderSchedule({
      schedule: current.schedule,
      actor,
      message: "Current schedule loaded.",
    });

    return withNoCacheHeaders(responses.json(200, rendered));
  }

  async function handleGetScheduleItem({ headers, params } = {}) {
    const actor = toActor(headers || {});
    const conferenceId = String((params && params.conference_id) || "C1").trim();
    const itemId = String((params && params.item_id) || "").trim();

    const result = scheduleService.getScheduleItem({ conferenceId, itemId });
    if (result.type !== "success") {
      return withNoCacheHeaders(
        responses.json(404, {
          errorCode: "ITEM_NOT_FOUND",
          summary: "Selected schedule item cannot be edited.",
          affectedItemId: itemId,
          recommendedAction: "Refresh schedule and select another item.",
        })
      );
    }

    const rendered = viewApi.renderScheduleItem({ item: result.item, actor });
    return withNoCacheHeaders(responses.json(200, rendered));
  }

  async function handleUpdateScheduleItem({ headers, params, body } = {}) {
    const actor = toActor(headers || {});
    if (!hasScheduleEditRole({ role: actor.role })) {
      return withNoCacheHeaders(responses.json(403, unauthorizedPayload()));
    }

    const conferenceId = String((params && params.conference_id) || "C1").trim();
    const itemId = String((params && params.item_id) || "").trim();
    const update = {
      sessionId: body && body.sessionId,
      roomId: body && body.roomId,
      timeSlotId: body && body.timeSlotId,
      lastUpdatedAt: body && body.lastUpdatedAt,
    };

    const selection = viewApi.buildEditSelection({
      schedule: { id: conferenceId },
      itemId,
      assignment: update,
    });

    const result = scheduleService.updateScheduleItem({
      conferenceId,
      itemId,
      update: selection.assignment,
      actorId: actor.id,
    });

    if (result.type === "success") {
      const refreshed = scheduleService.getCurrentSchedule({ conferenceId });
      const rendered = viewApi.renderSchedule({
        schedule: refreshed.schedule,
        actor,
        message: "Schedule updated successfully.",
      });
      return withNoCacheHeaders(responses.json(200, rendered));
    }

    if (result.type === "missing_item") {
      return withNoCacheHeaders(responses.json(404, viewApi.renderError(result.payload)));
    }

    if (result.type === "invalid_update") {
      return withNoCacheHeaders(responses.json(400, viewApi.renderError(result.payload)));
    }

    if (result.type === "stale" || result.type === "conflict") {
      return withNoCacheHeaders(responses.json(409, viewApi.renderError(result.payload)));
    }

    return withNoCacheHeaders(responses.json(500, viewApi.renderError(result.payload)));
  }

  return {
    handleGetCurrentSchedule,
    handleGetScheduleItem,
    handleUpdateScheduleItem,
  };
}

module.exports = {
  createScheduleEditController,
};
