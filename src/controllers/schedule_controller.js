const path = require("path");
const { createAuthService } = require("../services/auth_service");
const responseService = require("../services/response_service");

function wantsJson(headers) {
  const accept = (headers && headers.accept) || "";
  const contentType = (headers && headers["content-type"]) || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function createScheduleController({ scheduleService, sessionService, authService, response } = {}) {
  if (!scheduleService) {
    throw new Error("scheduleService is required");
  }

  const auth = authService || createAuthService({ sessionService });
  const responses = response || responseService;

  function renderSchedule(templateName, schedule, { conferenceId = "", message = "" } = {}) {
    const templatePath = path.join(__dirname, "..", "views", templateName);
    const serialized = JSON.stringify(schedule || {}, null, 2);
    return responses.renderView({
      templatePath,
      replacements: {
        conferenceId,
        message,
        scheduleJson: serialized,
      },
    });
  }

  function mapGenerateFailure(result) {
    if (result.type === "missing_parameters") {
      return responses.json(400, {
        errorCode: "missing_parameters",
        message: "Required scheduling parameters are missing.",
        missing: result.missing,
      });
    }

    if (result.type === "confirm_replace_required") {
      return responses.json(409, {
        errorCode: "confirm_replace_required",
        message: result.message,
      });
    }

    if (result.type === "unsatisfiable_constraints") {
      return responses.json(409, {
        errorCode: "unsatisfiable_constraints",
        message: result.message,
      });
    }

    if (result.type === "save_failed") {
      return responses.json(500, {
        errorCode: "save_failed",
        message: result.message,
      });
    }

    return responses.json(500, {
      errorCode: "generation_failed",
      message: "Schedule generation failed.",
    });
  }

  async function handleGenerate({ headers, params, body } = {}) {
    const adminCheck = auth.requireAdmin(headers || {});
    if (!adminCheck.ok) {
      if (adminCheck.status === 403) {
        return responses.accessDenied();
      }
      return responses.json(adminCheck.status, {
        errorCode: adminCheck.errorCode,
        message: adminCheck.message,
      });
    }

    const conferenceId = String((params && params.conference_id) || "").trim();
    if (!conferenceId) {
      return responses.json(400, {
        errorCode: "missing_parameters",
        message: "conferenceId is required.",
      });
    }

    const result = scheduleService.generateSchedule({
      conferenceId,
      confirmReplace: body && body.confirmReplace === true,
      createdByAdminId: adminCheck.actor.id,
    });

    if (result.type !== "success") {
      return mapGenerateFailure(result);
    }

    if (wantsJson(headers)) {
      return responses.json(200, {
        conferenceId,
        status: result.schedule.status,
        sessions: result.schedule.sessions,
      });
    }

    return responses.html(
      200,
      renderSchedule("schedule_result.html", result.schedule, {
        conferenceId,
        message: "Schedule generated and stored successfully.",
      })
    );
  }

  async function handleGetSchedule({ headers, params } = {}) {
    const adminCheck = auth.requireAdmin(headers || {});
    if (!adminCheck.ok) {
      if (adminCheck.status === 403) {
        return responses.accessDenied();
      }
      return responses.json(adminCheck.status, {
        errorCode: adminCheck.errorCode,
        message: adminCheck.message,
      });
    }

    const conferenceId = String((params && params.conference_id) || "").trim();
    if (!conferenceId) {
      return responses.json(400, {
        errorCode: "missing_parameters",
        message: "conferenceId is required.",
      });
    }

    const result = scheduleService.getSchedule({ conferenceId });
    if (result.type === "not_found") {
      return responses.json(404, {
        errorCode: "schedule_not_found",
        message: "No schedule exists for this conference.",
      });
    }

    if (wantsJson(headers)) {
      return responses.json(200, {
        conferenceId,
        schedule: result.schedule,
      });
    }

    return responses.html(
      200,
      renderSchedule("schedule_view.html", result.schedule, {
        conferenceId,
        message: "Stored schedule loaded successfully.",
      })
    );
  }

  return {
    handleGenerate,
    handleGetSchedule,
  };
}

module.exports = {
  createScheduleController,
};
