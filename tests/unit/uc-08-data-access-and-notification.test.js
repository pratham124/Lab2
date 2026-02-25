const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");
const { createNotificationService } = require("../../src/services/notification_service");

test("UC-08 data_access handles empty/default seeds and lookup normalization", () => {
  const empty = createDataAccess();
  assert.deepEqual(empty.listSubmittedPapers(), []);
  assert.equal(empty.getPaperById("P1"), null);
  assert.equal(empty.getReviewerById("R1"), null);

  const access = createDataAccess({
    seed: {
      papers: [
        { id: "P1", title: "Paper", status: "submitted" },
        { id: "P2", title: "Paper 2", status: "assigned" },
      ],
      reviewers: [{ id: "R1", name: "Rev 1", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [{ id: "A1", paperId: "P1", reviewerId: "R1" }],
    },
  });

  assert.equal(access.listSubmittedPapers().length, 1);
  assert.equal(access.getPaperById(" P1 ").id, "P1");
  assert.equal(access.getReviewerById(" R1 ").id, "R1");
  assert.equal(access.getAssignmentsByPaperId(" P1 ").length, 1);
});

test("UC-08 data_access createAssignments covers invalid_paper, already_assigned, ineligible_reviewer branches", () => {
  const invalidPaper = createDataAccess({
    seed: {
      papers: [],
      reviewers: [],
    },
  });
  assert.throws(() => invalidPaper.createAssignments({ paperId: "P404", reviewerIds: ["R1"] }), (error) => {
    assert.equal(error.code, "invalid_paper");
    return true;
  });

  const alreadyAssignedByRecord = createDataAccess({
    seed: {
      papers: [{ id: "P1", status: "submitted" }],
      reviewers: [{ id: "R1", name: "Rev", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [{ id: "A1", paperId: "P1", reviewerId: "R1" }],
    },
  });
  assert.throws(() => alreadyAssignedByRecord.createAssignments({ paperId: "P1", reviewerIds: ["R1"] }), (error) => {
    assert.equal(error.code, "already_assigned");
    return true;
  });

  const alreadyAssignedByStatus = createDataAccess({
    seed: {
      papers: [{ id: "P1", status: "assigned" }],
      reviewers: [{ id: "R1", name: "Rev", eligibilityStatus: true, currentAssignmentCount: 0 }],
    },
  });
  assert.throws(() => alreadyAssignedByStatus.createAssignments({ paperId: "P1", reviewerIds: ["R1"] }), (error) => {
    assert.equal(error.code, "already_assigned");
    return true;
  });

  const ineligible = createDataAccess({
    seed: {
      papers: [{ id: "P1", status: "submitted" }],
      reviewers: [],
    },
  });
  assert.throws(() => ineligible.createAssignments({ paperId: "P1", reviewerIds: ["R404"] }), (error) => {
    assert.equal(error.code, "ineligible_reviewer");
    return true;
  });
});

test("UC-08 data_access createAssignments success updates reviewer workload and paper status", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P1", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [
        { id: "R1", name: "Rev1", eligibilityStatus: true, currentAssignmentCount: 1 },
        { id: "R2", name: "Rev2", eligibilityStatus: true, currentAssignmentCount: 4 },
      ],
    },
  });

  const created = access.createAssignments({ paperId: "P1", reviewerIds: ["R1", "R2"] });
  assert.equal(created.length, 2);
  assert.equal(access.getAssignmentsByPaperId("P1").length, 2);
  assert.equal(access.getReviewerById("R1").currentAssignmentCount, 2);
  assert.equal(access.getReviewerById("R2").currentAssignmentCount, 5);
  assert.equal(access.getPaperById("P1").status, "assigned");
  assert.equal(access.getPaperById("P1").assignedReviewerCount, 2);
});

test("UC-08 data_access normalization and default reviewerIds branches", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P1", status: "submitted", assignedReviewerCount: 99 }],
      reviewers: [{ id: "R1", name: "Rev1", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [{ id: "A1", paperId: "P1", reviewerId: "R1" }],
    },
  });

  assert.equal(access.getPaperById(undefined), null);
  assert.equal(access.getReviewerById(undefined), null);
  assert.deepEqual(access.getAssignmentsByPaperId(undefined), []);

  assert.throws(() => access.createAssignments(), (error) => {
    assert.equal(error.code, "invalid_paper");
    return true;
  });

  const noReviewerIdsAccess = createDataAccess({
    seed: {
      papers: [{ id: "P2", status: "submitted", assignedReviewerCount: 5 }],
      reviewers: [{ id: "R2", name: "Rev2", eligibilityStatus: true, currentAssignmentCount: 3 }],
    },
  });
  const created = noReviewerIdsAccess.createAssignments({ paperId: "P2" });
  assert.deepEqual(created, []);
  assert.equal(noReviewerIdsAccess.getPaperById("P2").status, "assigned");
  assert.equal(noReviewerIdsAccess.getPaperById("P2").assignedReviewerCount, 0);
});

test("UC-08 data_access listEligibleReviewers filters by eligibilityStatus", () => {
  const access = createDataAccess({
    seed: {
      papers: [],
      reviewers: [
        { id: "R1", name: "Rev1", eligibilityStatus: true, currentAssignmentCount: 0 },
        { id: "R2", name: "Rev2", eligibilityStatus: false, currentAssignmentCount: 0 },
      ],
    },
  });

  const eligible = access.listEligibleReviewers();
  assert.deepEqual(
    eligible.map((reviewer) => reviewer.id),
    ["R1"]
  );
});

test("UC-09 data_access createSingleAssignment normalizes identifiers and applies conference fallback", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P1", title: "Paper", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R1", name: "Rev1", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });

  const created = access.createSingleAssignment({
    conferenceId: " C1 ",
    paperId: " P1 ",
    reviewerId: " R1 ",
  });

  assert.equal(created.paperId, "P1");
  assert.equal(created.reviewerId, "R1");
  assert.equal(created.conferenceId, "C1");
});

test("UC-09 data_access createSingleAssignment derives effective conference from paper or request", () => {
  const byPaperConference = createDataAccess({
    seed: {
      papers: [{ id: "P1", conferenceId: "C_PAPER", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R1", name: "Rev1", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });
  const createdByPaper = byPaperConference.createSingleAssignment({
    conferenceId: "C_PAPER",
    paperId: "P1",
    reviewerId: "R1",
  });
  assert.equal(createdByPaper.conferenceId, "C_PAPER");

  const byRequestConference = createDataAccess({
    seed: {
      papers: [{ id: "P2", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R2", name: "Rev2", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });
  const createdByRequest = byRequestConference.createSingleAssignment({
    conferenceId: "C_REQUEST",
    paperId: "P2",
    reviewerId: "R2",
  });
  assert.equal(createdByRequest.conferenceId, "C_REQUEST");
});

test("UC-09 data_access createSingleAssignment executes id normalization before invalid_paper", () => {
  const access = createDataAccess({
    seed: {
      papers: [{ id: "P_OK", conferenceId: "C1", status: "submitted", assignedReviewerCount: 0 }],
      reviewers: [{ id: "R_OK", name: "Rev", eligibilityStatus: true, currentAssignmentCount: 0 }],
      assignments: [],
    },
  });

  assert.throws(
    () =>
      access.createSingleAssignment({
        conferenceId: "C1",
        paperId: undefined,
        reviewerId: undefined,
      }),
    (error) => {
      assert.equal(error.code, "invalid_paper");
      return true;
    }
  );
});

test("UC-08 notification_service covers default sender/sink and success path", async () => {
  const defaultService = createNotificationService();
  const emptyResult = await defaultService.sendReviewerInvitations({});
  assert.equal(emptyResult.type, "sent");
  assert.deepEqual(emptyResult.failures, []);

  const calls = [];
  const service = createNotificationService({
    inviter: {
      async sendInvitation({ reviewer }) {
        calls.push(reviewer.id);
      },
    },
  });

  const result = await service.sendReviewerInvitations({
    paper: { id: "P1" },
    reviewers: [{ id: "R1" }, { id: "R2" }],
    assignments: [{ id: "A1" }],
  });

  assert.equal(result.type, "sent");
  assert.deepEqual(calls, ["R1", "R2"]);
});

test("UC-08 notification_service covers failure branch with message and fallback reason", async () => {
  const warnings = [];
  const service = createNotificationService({
    inviter: {
      async sendInvitation({ reviewer }) {
        if (reviewer.id === "R1") {
          throw new Error("SMTP_DOWN");
        }
        if (reviewer.id === "R2") {
          throw {};
        }
      },
    },
    logger: {
      warn(message) {
        warnings.push(message);
      },
    },
  });

  const result = await service.sendReviewerInvitations({
    paper: { id: "P1" },
    reviewers: [{ id: "R1" }, { id: "R2" }],
    assignments: [{ id: "A1" }],
  });

  assert.equal(result.type, "partial_failure");
  assert.equal(result.warningCode, "invitation_partial_failure");
  assert.equal(result.failures.length, 2);
  assert.equal(result.failures[0].reason, "SMTP_DOWN");
  assert.equal(result.failures[1].reason, "invitation_failed");
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].includes("reviewer_invitation_failed"), true);
});

test("UC-08 notification_service executes fallback sender and fallback logger functions", async () => {
  const defaultService = createNotificationService();
  const sent = await defaultService.sendReviewerInvitations({
    paper: { id: "P1" },
    reviewers: [{ id: "R1" }],
    assignments: [],
  });
  assert.equal(sent.type, "sent");
  assert.deepEqual(sent.failures, []);

  const failingWithoutLogger = createNotificationService({
    inviter: {
      async sendInvitation() {
        throw new Error("FAIL_NO_LOGGER");
      },
    },
  });
  const partial = await failingWithoutLogger.sendReviewerInvitations({
    paper: { id: "P1" },
    reviewers: [{ id: "R1" }],
    assignments: [],
  });
  assert.equal(partial.type, "partial_failure");
  assert.equal(partial.failures.length, 1);
  assert.equal(partial.failures[0].reason, "FAIL_NO_LOGGER");
});
