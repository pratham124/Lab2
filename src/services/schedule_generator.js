const { createConferenceSchedule } = require("../models/conference_schedule");
const { createSession } = require("../models/session");
const { createTimeSlot } = require("../models/time_slot");

function parseTimeToMinutes(value) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value).trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function toTimeString(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function collectMissingParameters(parameters = {}) {
  const missing = [];

  if (!Array.isArray(parameters.conferenceDates) || parameters.conferenceDates.length === 0) {
    missing.push("conferenceDates");
  }
  if (!Number.isFinite(Number(parameters.sessionLengthMinutes)) || Number(parameters.sessionLengthMinutes) <= 0) {
    missing.push("sessionLengthMinutes");
  }
  if (!parameters.dailyTimeWindow || !parameters.dailyTimeWindow.start || !parameters.dailyTimeWindow.end) {
    missing.push("dailyTimeWindow");
  }
  if (!Array.isArray(parameters.availableRoomIds) || parameters.availableRoomIds.length === 0) {
    missing.push("availableRoomIds");
  }

  return missing;
}

function buildSlots({ conferenceId, parameters }) {
  const start = parseTimeToMinutes(parameters.dailyTimeWindow.start);
  const end = parseTimeToMinutes(parameters.dailyTimeWindow.end);
  const sessionLength = Number(parameters.sessionLengthMinutes);
  if (start === null || end === null || end <= start || sessionLength <= 0) {
    return null;
  }

  const dates = parameters.conferenceDates.slice().sort();
  const roomIds = parameters.availableRoomIds.slice().map((id) => String(id || "").trim()).sort();
  const slots = [];

  for (const date of dates) {
    for (let at = start; at + sessionLength <= end; at += sessionLength) {
      const timeSlot = createTimeSlot({
        id: `slot_${date}_${toTimeString(at)}_${toTimeString(at + sessionLength)}`,
        conferenceId,
        date,
        startTime: toTimeString(at),
        endTime: toTimeString(at + sessionLength),
      });

      for (const roomId of roomIds) {
        slots.push({ roomId, timeSlot });
      }
    }
  }

  return slots;
}

function createScheduleGenerator() {
  function generate({ conferenceId, acceptedPapers, parameters, createdByAdminId } = {}) {
    const missing = collectMissingParameters(parameters || {});
    if (missing.length > 0) {
      return {
        type: "missing_parameters",
        missing,
      };
    }

    const slots = buildSlots({ conferenceId, parameters });
    if (!slots || slots.length === 0) {
      return {
        type: "unsatisfiable_constraints",
        message: "Scheduling constraints prevent generation.",
      };
    }

    const papers = (Array.isArray(acceptedPapers) ? acceptedPapers : [])
      .filter((paper) => String(paper.status || "").trim().toLowerCase() === "accepted")
      .sort((left, right) => String(left.id || "").localeCompare(String(right.id || "")));

    if (papers.length > slots.length) {
      return {
        type: "unsatisfiable_constraints",
        message: "Scheduling constraints prevent generation.",
      };
    }

    const scheduleId = `schedule_${conferenceId}_${Date.now()}`;
    const sessions = papers.map((paper, index) => {
      const slot = slots[index];
      return createSession({
        id: `session_${index + 1}`,
        scheduleId,
        roomId: slot.roomId,
        timeSlotId: slot.timeSlot.id,
        paperIds: [paper.id],
      });
    });

    const schedule = createConferenceSchedule({
      id: scheduleId,
      conferenceId,
      createdByAdminId,
      status: "generated",
      sessions,
    });

    return {
      type: "success",
      schedule,
    };
  }

  return {
    collectMissingParameters,
    generate,
  };
}

module.exports = {
  createScheduleGenerator,
};
