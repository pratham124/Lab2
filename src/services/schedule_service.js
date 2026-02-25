function createScheduleService({ storageAdapter, scheduleGenerator } = {}) {
  if (!storageAdapter) {
    throw new Error("storageAdapter is required");
  }
  if (!scheduleGenerator) {
    throw new Error("scheduleGenerator is required");
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

  return {
    hasSchedule,
    getSchedule,
    generateSchedule,
  };
}

module.exports = {
  createScheduleService,
};
