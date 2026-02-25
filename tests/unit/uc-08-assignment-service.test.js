const test = require("node:test");
const assert = require("node:assert/strict");

const { createAssignmentService, __test } = require("../../src/services/assignment_service");

function createFakeDataAccess(overrides = {}) {
  const reviewers = new Map([
    ["R1", { id: "R1", eligibilityStatus: true, currentAssignmentCount: 1 }],
    ["R2", { id: "R2", eligibilityStatus: true, currentAssignmentCount: 1 }],
    ["R3", { id: "R3", eligibilityStatus: true, currentAssignmentCount: 1 }],
    ["R4", { id: "R4", eligibilityStatus: true, currentAssignmentCount: 5 }],
    ["R0", { id: "R0", eligibilityStatus: false, currentAssignmentCount: 0 }],
  ]);

  const base = {
    getPaperById(paperId) {
      return paperId === "P1" ? { id: "P1", status: "submitted" } : null;
    },
    getAssignmentsByPaperId() {
      return [];
    },
    listEligibleReviewers() {
      return [
        { id: "R1", eligibilityStatus: true },
        { id: "R2", eligibilityStatus: true },
        { id: "R3", eligibilityStatus: true },
      ];
    },
    getReviewerById(reviewerId) {
      return reviewers.get(reviewerId) || null;
    },
    createAssignments({ paperId, reviewerIds }) {
      return reviewerIds.map((reviewerId, idx) => ({
        id: `A${idx + 1}`,
        paperId,
        reviewerId,
      }));
    },
  };

  return {
    ...base,
    ...overrides,
  };
}

test("UC-08 assignment service throws when dataAccess is missing", () => {
  assert.throws(() => createAssignmentService(), /dataAccess is required/);
});

test("UC-08 assignment service helper functions normalize ids and deduplicate", () => {
  assert.deepEqual(__test.normalizeReviewerIds([" R1 ", "", null, "R2"]), ["R1", "R2"]);
  assert.deepEqual(__test.normalizeReviewerIds("R1, R2, ,R3"), ["R1", "R2", "R3"]);
  assert.deepEqual(__test.normalizeReviewerIds(undefined), []);
  assert.deepEqual(__test.unique(["R1", "R2", "R1", "R3"]), ["R1", "R2", "R3"]);
});

test("UC-08 assignment service validateSelection covers invalid paper and already-assigned branches", () => {
  const missingPaperService = createAssignmentService({
    dataAccess: createFakeDataAccess({
      getPaperById() {
        return null;
      },
    }),
  });
  const missingPaper = missingPaperService.validateSelection({ paperId: "P404", reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(missingPaper.errorCode, "invalid_paper");
  assert.equal(missingPaper.status, 404);

  const assignedByStatusService = createAssignmentService({
    dataAccess: createFakeDataAccess({
      getPaperById() {
        return { id: "P1", status: "assigned" };
      },
    }),
  });
  const assignedByStatus = assignedByStatusService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(assignedByStatus.errorCode, "already_assigned");

  const assignedByRecordsService = createAssignmentService({
    dataAccess: createFakeDataAccess({
      getAssignmentsByPaperId() {
        return [{ id: "A1" }];
      },
    }),
  });
  const assignedByRecords = assignedByRecordsService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(assignedByRecords.errorCode, "already_assigned");
});

test("UC-08 assignment service validateSelection covers eligibility and validation branches", () => {
  const insufficientService = createAssignmentService({
    dataAccess: createFakeDataAccess({
      listEligibleReviewers() {
        return [{ id: "R1" }, { id: "R2" }];
      },
    }),
  });
  const insufficient = insufficientService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R2", "R3"] });
  assert.equal(insufficient.errorCode, "insufficient_eligible_reviewers");
  assert.equal(insufficient.status, 409);

  const badCountService = createAssignmentService({ dataAccess: createFakeDataAccess() });
  const badCount = badCountService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R2"] });
  assert.equal(badCount.errorCode, "invalid_reviewer_count");
  assert.equal(badCount.providedCount, 2);

  const duplicateService = createAssignmentService({ dataAccess: createFakeDataAccess() });
  const duplicate = duplicateService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R1", "R2"] });
  assert.equal(duplicate.errorCode, "duplicate_reviewers");

  const ineligibleService = createAssignmentService({ dataAccess: createFakeDataAccess() });
  const ineligible = ineligibleService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R0", "R2"] });
  assert.equal(ineligible.errorCode, "ineligible_reviewer");

  const workloadService = createAssignmentService({ dataAccess: createFakeDataAccess() });
  const workload = workloadService.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R2", "R4"] });
  assert.equal(workload.errorCode, "reviewer_workload_exceeded");
  assert.equal(workload.reviewerId, "R4");

  const successService = createAssignmentService({ dataAccess: createFakeDataAccess() });
  const success = successService.validateSelection({ paperId: "P1", reviewerIds: "R1, R2, R3" });
  assert.equal(success.type, "ok");
  assert.equal(success.reviewerIds.length, 3);
});

test("UC-08 assignment service validateSelection normalizes falsy paperId and reviewer workload count fallback", () => {
  const service = createAssignmentService({
    dataAccess: createFakeDataAccess({
      getPaperById(paperId) {
        return paperId === "" ? null : { id: "P1", status: "submitted" };
      },
      listEligibleReviewers() {
        return [
          { id: "R1", eligibilityStatus: true },
          { id: "R2", eligibilityStatus: true },
          { id: "R5", eligibilityStatus: true },
        ];
      },
      getReviewerById(reviewerId) {
        if (reviewerId === "R5") {
          return { id: "R5", eligibilityStatus: true };
        }
        if (reviewerId === "R1" || reviewerId === "R2") {
          return { id: reviewerId, eligibilityStatus: true, currentAssignmentCount: 1 };
        }
        return null;
      },
    }),
  });

  const invalidPaper = service.validateSelection({ reviewerIds: ["R1", "R2", "R5"] });
  assert.equal(invalidPaper.errorCode, "invalid_paper");

  const ok = service.validateSelection({ paperId: "P1", reviewerIds: ["R1", "R2", "R5"] });
  assert.equal(ok.type, "ok");
  assert.deepEqual(ok.reviewerIds, ["R1", "R2", "R5"]);
});

test("UC-08 assignment service assignReviewers covers createAssignments known error codes", async () => {
  const alreadyAssignedService = createAssignmentService({
    dataAccess: createFakeDataAccess({
      createAssignments() {
        const error = new Error("already_assigned");
        error.code = "already_assigned";
        throw error;
      },
    }),
  });
  const alreadyAssigned = await alreadyAssignedService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(alreadyAssigned.errorCode, "already_assigned");

  const invalidPaperService = createAssignmentService({
    dataAccess: createFakeDataAccess({
      createAssignments() {
        const error = new Error("invalid_paper");
        error.code = "invalid_paper";
        throw error;
      },
    }),
  });
  const invalidPaper = await invalidPaperService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(invalidPaper.errorCode, "invalid_paper");
  assert.equal(invalidPaper.status, 404);
});

test("UC-08 assignment service assignReviewers returns validation failure without saving", async () => {
  const service = createAssignmentService({
    dataAccess: createFakeDataAccess({
      createAssignments() {
        throw new Error("createAssignments should not be called for invalid input");
      },
    }),
  });

  const result = await service.assignReviewers({
    paperId: "P404",
    reviewerIds: ["R1", "R2", "R3"],
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.errorCode, "invalid_paper");
});

test("UC-08 assignment service assignReviewers logs unknown save errors and returns system_error", async () => {
  const logs = [];
  const service = createAssignmentService({
    dataAccess: createFakeDataAccess({
      createAssignments() {
        throw new Error("DB_DOWN");
      },
    }),
    failureLogger: {
      log(entry) {
        logs.push(entry);
      },
    },
  });

  const result = await service.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.errorCode, "assignment_save_failed");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, "reviewer_assignment_save_failure");
  assert.equal(logs[0].paper_id, "P1");
});

test("UC-08 assignment service assignReviewers logs UNKNOWN_ERROR when save failure has no message", async () => {
  const logs = [];
  const service = createAssignmentService({
    dataAccess: createFakeDataAccess({
      createAssignments() {
        throw { code: "db_unknown" };
      },
    }),
    failureLogger: {
      log(entry) {
        logs.push(entry);
      },
    },
  });

  const result = await service.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });

  assert.equal(result.type, "system_error");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].error_code, "UNKNOWN_ERROR");
});

test("UC-08 assignment service assignReviewers covers notification partial failure and success/default notifier", async () => {
  const partialService = createAssignmentService({
    dataAccess: createFakeDataAccess(),
    notificationService: {
      async sendReviewerInvitations() {
        return {
          type: "partial_failure",
          warningCode: "invitation_partial_failure",
          warningMessage: "warn",
          failures: [{ reviewerId: "R2", reason: "smtp_down" }],
        };
      },
    },
  });

  const partial = await partialService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(partial.type, "success");
  assert.equal(partial.warningCode, "invitation_partial_failure");
  assert.equal(partial.invitationFailures.length, 1);

  const successService = createAssignmentService({ dataAccess: createFakeDataAccess() });
  const success = await successService.assignReviewers({
    paperId: "P1",
    reviewerIds: ["R1", "R2", "R3"],
  });
  assert.equal(success.type, "success");
  assert.equal(success.warningCode, undefined);
});
