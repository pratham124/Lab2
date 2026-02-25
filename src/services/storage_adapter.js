const { createAcceptedPaper } = require("../models/accepted_paper");
const { createSchedulingParameters } = require("../models/scheduling_parameters");

function defaultAcceptedPapers() {
  return [
    createAcceptedPaper({ id: "P1", conferenceId: "C1", title: "Paper 1", status: "accepted" }),
    createAcceptedPaper({ id: "P2", conferenceId: "C1", title: "Paper 2", status: "accepted" }),
    createAcceptedPaper({ id: "P3", conferenceId: "C1", title: "Paper 3", status: "accepted" }),
    createAcceptedPaper({ id: "P4", conferenceId: "C1", title: "Paper 4", status: "accepted" }),
    createAcceptedPaper({ id: "P5", conferenceId: "C1", title: "Paper 5", status: "accepted" }),
  ];
}

function defaultParameters() {
  return createSchedulingParameters({
    conferenceId: "C1",
    conferenceDates: ["2026-04-10", "2026-04-11"],
    sessionLengthMinutes: 60,
    dailyTimeWindow: { start: "09:00", end: "12:00" },
    availableRoomIds: ["R1", "R2"],
  });
}

function createStorageAdapter({ store } = {}) {
  const state = store || {};

  if (!(state.acceptedPapersByConference instanceof Map)) {
    state.acceptedPapersByConference = new Map([["C1", defaultAcceptedPapers()]]);
  }

  if (!(state.schedulingParametersByConference instanceof Map)) {
    state.schedulingParametersByConference = new Map([["C1", defaultParameters()]]);
  }

  if (!(state.scheduleByConference instanceof Map)) {
    state.scheduleByConference = new Map();
  }

  function listAcceptedPapers({ conferenceId } = {}) {
    const key = String(conferenceId || "").trim();
    const papers = state.acceptedPapersByConference.get(key) || [];
    return papers.filter((paper) => String(paper.status || "").trim().toLowerCase() === "accepted");
  }

  function getSchedulingParameters({ conferenceId } = {}) {
    const key = String(conferenceId || "").trim();
    return state.schedulingParametersByConference.get(key) || null;
  }

  function getSchedule({ conferenceId } = {}) {
    const key = String(conferenceId || "").trim();
    return state.scheduleByConference.get(key) || null;
  }

  function saveSchedule({ conferenceId, schedule } = {}) {
    if (state.failScheduleSave === true) {
      const error = new Error("schedule_save_failed");
      error.code = "schedule_save_failed";
      throw error;
    }
    const key = String(conferenceId || "").trim();
    state.scheduleByConference.set(key, schedule);
    return schedule;
  }

  return {
    listAcceptedPapers,
    getSchedulingParameters,
    getSchedule,
    saveSchedule,
  };
}

module.exports = {
  createStorageAdapter,
};
