const { createSchedule, createScheduleItem } = require("../models/schedule");
const { createPublishedSchedule, createScheduleEntry } = require("../models/schedule");
const { createErrorMessage } = require("../models/error_message");
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

function parseSlotId(slotId) {
  const normalized = normalize(slotId);
  const match = /^slot_([^_]+)_([0-2]\d:[0-5]\d)_([0-2]\d:[0-5]\d)$/.exec(normalized);
  if (!match) {
    return { day: "", startTime: "", endTime: "" };
  }
  return {
    day: match[1],
    startTime: match[2],
    endTime: match[3],
  };
}

function toPublishedEntries(schedule) {
  const sessions = Array.isArray(schedule && schedule.sessions) ? schedule.sessions : [];
  return sessions.map((session) => {
    const slot = parseSlotId(session && session.timeSlotId);
    const paperIds = Array.isArray(session && session.paperIds) ? session.paperIds : [];
    const title = paperIds.length > 0 ? `Session: ${paperIds.join(", ")}` : "Session";
    return createScheduleEntry({
      id: session && session.id,
      title,
      timeSlot: { startTime: slot.startTime, endTime: slot.endTime },
      location: { name: session && session.roomId },
      day: session && session.day ? session.day : slot.day,
      session: session && session.id,
    });
  });
}

function hasCompleteEntry(entry) {
  return Boolean(
    entry &&
      entry.timeSlot &&
      normalize(entry.timeSlot.startTime) &&
      normalize(entry.timeSlot.endTime) &&
      entry.location &&
      normalize(entry.location.name)
  );
}

function applyPublishedFilters(entries, filters = {}) {
  const normalizedDay = normalize(filters.day).toLowerCase();
  const normalizedSession = normalize(filters.session).toLowerCase();
  return entries.filter((entry) => {
    const dayMatch = !normalizedDay || normalize(entry.day).toLowerCase() === normalizedDay;
    const sessionMatch =
      !normalizedSession || normalize(entry.session).toLowerCase() === normalizedSession;
    return dayMatch && sessionMatch;
  });
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

  function getPublishedSchedule({ conferenceId, day, session } = {}) {
    try {
      const schedule = storageAdapter.getSchedule({ conferenceId: conferenceId || "C1" });
      if (!schedule || String(schedule.status || "").trim().toLowerCase() !== "published") {
        return {
          type: "not_published",
          error: createErrorMessage({
            message: "The conference schedule is not yet published. Please check back later.",
            canRetry: false,
          }),
        };
      }

      const completeOnly = toPublishedEntries(schedule).filter(hasCompleteEntry);
      const entries = applyPublishedFilters(completeOnly, { day, session });
      return {
        type: "success",
        schedule: createPublishedSchedule({
          id: schedule.id,
          status: "published",
          entries,
          publishedAt: schedule.publishedAt,
        }),
      };
    } catch (_error) {
      return {
        type: "retrieval_failed",
        error: createErrorMessage({
          message: "Schedule is temporarily unavailable. Please try again.",
          canRetry: true,
        }),
      };
    }
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
    getPublishedSchedule,
    __test: {
      parseSlotId,
      toPublishedEntries,
      hasCompleteEntry,
      applyPublishedFilters,
    },
  };
}

function createPublishedScheduleClient({ httpClient } = {}) {
  if (!httpClient || typeof httpClient.requestJson !== "function") {
    throw new Error("httpClient.requestJson is required");
  }

  function getPublishedSchedule({ day, session } = {}) {
    const params = new URLSearchParams();
    if (normalize(day)) {
      params.set("day", normalize(day));
    }
    if (normalize(session)) {
      params.set("session", normalize(session));
    }
    const query = params.toString();
    return httpClient.requestJson(`/schedule/published${query ? `?${query}` : ""}`);
  }

  return {
    getPublishedSchedule,
  };
}

module.exports = {
  createScheduleService,
  createPublishedScheduleClient,
};
