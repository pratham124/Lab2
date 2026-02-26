const { createSchedule, createScheduleItem } = require("../models/schedule");
const { createFinalSchedule } = require("../models/final_schedule");
const { validateScheduleItemUpdate, findItem } = require("./schedule_validation");
const { createErrorPayload } = require("./error_payload");
const { createNextConcurrencyToken } = require("./concurrency");
const { createPerfMetrics } = require("./perf_metrics");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
  return String(value || "").trim();
}

function createScheduleService({ storageAdapter, scheduleGenerator, perfMetrics } = {}) {
  if (!storageAdapter) {
    throw new Error("storageAdapter is required");
  }
  if (!scheduleGenerator) {
    throw new Error("scheduleGenerator is required");
  }
  const metrics = perfMetrics || createPerfMetrics();
  const idempotentSaves = new Map();

  function buildEditableSchedule(rawSchedule) {
    const source = rawSchedule || {};
    return createSchedule({
      id: source.id,
      conferenceId: source.conferenceId,
      name: source.name,
      status: source.status,
      version: source.version,
      lastUpdatedAt: source.lastUpdatedAt || source.createdAt,
      items: source.items,
      sessions: source.sessions,
    });
  }

  function saveEditableSchedule({ conferenceId, schedule }) {
    const normalized = createSchedule({
      ...schedule,
      conferenceId,
      sessions: schedule.sessions,
      items: schedule.items,
    });
    return storageAdapter.saveSchedule({ conferenceId, schedule: normalized });
  }

  function getSchedule({ conferenceId } = {}) {
    const schedule = storageAdapter.getSchedule({ conferenceId });
    if (!schedule) {
      return { type: "not_found" };
    }
    return { type: "success", schedule };
  }

  function hasSchedule({ conferenceId } = {}) {
    return Boolean(storageAdapter.getSchedule({ conferenceId }));
  }

  function getCurrentSchedule({ conferenceId } = {}) {
    const schedule = storageAdapter.getSchedule({ conferenceId });
    if (!schedule) {
      return { type: "not_found" };
    }
    return {
      type: "success",
      schedule: buildEditableSchedule(schedule),
    };
  }

  function getScheduleItem({ conferenceId, itemId } = {}) {
    const current = getCurrentSchedule({ conferenceId });
    if (current.type !== "success") {
      return { type: "not_found_schedule" };
    }
    const item = findItem(current.schedule, itemId);
    if (!item) {
      return { type: "not_found_item" };
    }
    return {
      type: "success",
      item,
    };
  }

  function createIdempotencyKey({ conferenceId, itemId, actorId, update } = {}) {
    return JSON.stringify({
      conferenceId: normalize(conferenceId),
      itemId: normalize(itemId),
      actorId: normalize(actorId),
      sessionId: normalize(update && update.sessionId),
      roomId: normalize(update && update.roomId),
      timeSlotId: normalize(update && update.timeSlotId),
      lastUpdatedAt: normalize(update && update.lastUpdatedAt),
    });
  }

  function updateScheduleItem({ conferenceId, itemId, update, actorId } = {}) {
    const current = getCurrentSchedule({ conferenceId });
    if (current.type !== "success") {
      return {
        type: "save_failed",
        payload: createErrorPayload({
          errorCode: "SAVE_FAILED",
          summary: "Schedule save failed due to an internal error.",
          affectedItemId: itemId,
          recommendedAction: "Retry the save or refresh the schedule.",
        }),
      };
    }

    const idempotencyKey = createIdempotencyKey({ conferenceId, itemId, actorId, update });
    if (idempotentSaves.has(idempotencyKey)) {
      return clone(idempotentSaves.get(idempotencyKey));
    }

    const validation = validateScheduleItemUpdate({
      schedule: current.schedule,
      itemId,
      update,
    });

    if (validation.type !== "ok") {
      return validation;
    }

    const startedAt = metrics.start();
    const updatedSchedule = clone(current.schedule);
    updatedSchedule.items = updatedSchedule.items.map((entry) => {
      if (normalize(entry.id) !== normalize(itemId)) {
        return entry;
      }
      return createScheduleItem({
        ...entry,
        sessionId: update.sessionId,
        roomId: update.roomId,
        timeSlotId: update.timeSlotId,
      });
    });
    updatedSchedule.status = "edited";
    updatedSchedule.lastUpdatedAt = createNextConcurrencyToken();
    updatedSchedule.version = updatedSchedule.lastUpdatedAt;

    try {
      const saved = saveEditableSchedule({
        conferenceId,
        schedule: updatedSchedule,
      });
      metrics.stop(startedAt);

      const response = {
        type: "success",
        item: findItem(updatedSchedule, itemId),
        schedule: buildEditableSchedule(saved),
        validateAndSaveMs: metrics.samples[metrics.samples.length - 1] || 0,
        p95ValidateAndSaveMs: metrics.getP95(),
      };
      idempotentSaves.set(idempotencyKey, clone(response));
      return response;
    } catch (error) {
      return {
        type: "save_failed",
        payload: createErrorPayload({
          errorCode: "SAVE_FAILED",
          summary: "Schedule save failed due to an internal error.",
          affectedItemId: itemId,
          recommendedAction: "Retry the save or refresh the schedule.",
        }),
      };
    }
  }

  function generateSchedule({ conferenceId, confirmReplace, createdByAdminId } = {}) {
    const existing = storageAdapter.getSchedule({ conferenceId });
    if (existing && confirmReplace !== true) {
      return {
        type: "confirm_replace_required",
        message: "A schedule already exists. Set confirmReplace=true to replace it.",
      };
    }

    const acceptedPapers = storageAdapter.listAcceptedPapers({ conferenceId });
    const parameters = storageAdapter.getSchedulingParameters({ conferenceId });

    const generated = scheduleGenerator.generate({
      conferenceId,
      acceptedPapers,
      parameters,
      createdByAdminId,
    });

    if (generated.type !== "success") {
      return generated;
    }

    try {
      const saved = storageAdapter.saveSchedule({ conferenceId, schedule: generated.schedule });
      return {
        type: "success",
        schedule: saved,
      };
    } catch (error) {
      return {
        type: "save_failed",
        message: "Schedule could not be saved.",
      };
    }
  }

  function isSchedulePublished({ conferenceId } = {}) {
    const schedule = storageAdapter.getSchedule({ conferenceId });
    return Boolean(schedule && String(schedule.status || "").trim().toLowerCase() === "published");
  }

  function ensurePublished({ conferenceId } = {}) {
    if (!isSchedulePublished({ conferenceId })) {
      return {
        type: "not_published",
        message: "Final schedule is not published yet.",
      };
    }
    return { type: "published" };
  }

  function canAccessPublishedSchedule({ conferenceId } = {}) {
    return isSchedulePublished({ conferenceId });
  }

  function publishSchedule({ conferenceId, conferenceTimezone = "UTC", publishedBy } = {}) {
    const existing = storageAdapter.getSchedule({ conferenceId });
    if (!existing) {
      return {
        type: "not_found",
        message: "No final schedule exists to publish.",
      };
    }

    const normalizedStatus = String(existing.status || "").trim().toLowerCase();
    if (normalizedStatus === "published") {
      return {
        type: "already_published",
        schedule: existing,
      };
    }

    const publishedAt = new Date().toISOString();
    const published = createFinalSchedule({
      id: existing.id,
      conferenceId: conferenceId || existing.conferenceId,
      status: "published",
      publishedAt,
      conferenceTimezone,
    });

    const next = {
      ...existing,
      status: published.status,
      publishedAt: published.publishedAt,
      conferenceTimezone: published.conferenceTimezone,
      publishedBy: String(publishedBy || "").trim(),
    };
    const saved = storageAdapter.saveSchedule({ conferenceId, schedule: next });
    return {
      type: "success",
      schedule: saved,
      publishedAt,
    };
  }

  return {
    hasSchedule,
    getSchedule,
    getCurrentSchedule,
    getScheduleItem,
    updateScheduleItem,
    generateSchedule,
    isSchedulePublished,
    ensurePublished,
    canAccessPublishedSchedule,
    publishSchedule,
  };
}

module.exports = {
  createScheduleService,
};
