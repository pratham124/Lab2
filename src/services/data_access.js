const { createPaper } = require("../models/paper");
const { createReviewer } = require("../models/reviewer");
const { createAssignment } = require("../models/assignment");
const { createReviewInvitation: buildReviewInvitation } = require("../models/review_invitation");
const { createNotification } = require("../models/notification");
const {
  MAX_REVIEWER_WORKLOAD,
  countAssignmentsForReviewerConference,
} = require("../models/workload_count");

function normalizeSeed(seed = {}) {
  const papers = Array.isArray(seed.papers) ? seed.papers : [];
  const reviewers = Array.isArray(seed.reviewers) ? seed.reviewers : [];
  const assignments = Array.isArray(seed.assignments) ? seed.assignments : [];
  const reviewInvitations = Array.isArray(seed.reviewInvitations) ? seed.reviewInvitations : [];
  const notifications = Array.isArray(seed.notifications) ? seed.notifications : [];

  return {
    papers,
    reviewers,
    assignments,
    reviewInvitations,
    notifications,
  };
}

function createDataAccess({ seed } = {}) {
  const normalized = normalizeSeed(seed);

  const papers = new Map(
    normalized.papers.map((paper) => {
      const model = createPaper(paper);
      return [model.id, model];
    })
  );

  const reviewers = new Map(
    normalized.reviewers.map((reviewer) => {
      const model = createReviewer(reviewer);
      return [model.id, model];
    })
  );

  const assignments = normalized.assignments.map((assignment) => createAssignment(assignment));
  const reviewInvitations = normalized.reviewInvitations.map((invitation) =>
    buildReviewInvitation(invitation)
  );
  const notifications = normalized.notifications.map((notification) =>
    createNotification(notification)
  );
  const assignmentViolationAuditLogs = [];

  function listSubmittedPapers() {
    return Array.from(papers.values()).filter((paper) => paper.status === "submitted");
  }

  function getPaperById(paperId) {
    return papers.get(String(paperId || "").trim()) || null;
  }

  function listEligibleReviewers() {
    return Array.from(reviewers.values()).filter((reviewer) => reviewer.eligibilityStatus);
  }

  function listReviewersByConferenceId() {
    return Array.from(reviewers.values());
  }

  function getReviewerById(reviewerId) {
    return reviewers.get(String(reviewerId || "").trim()) || null;
  }

  function getPaperByConferenceAndId(conferenceId, paperId) {
    const paper = getPaperById(paperId);
    if (!paper) {
      return null;
    }
    const normalizedConferenceId = String(conferenceId || "").trim();
    const paperConferenceId = String(paper.conferenceId || "").trim();
    if (normalizedConferenceId && paperConferenceId && paperConferenceId !== normalizedConferenceId) {
      return null;
    }
    return paper;
  }

  function getAssignmentsByPaperId(paperId) {
    const normalizedPaperId = String(paperId || "").trim();
    return assignments.filter((assignment) => assignment.paperId === normalizedPaperId);
  }

  function listAssignmentsByConference(conferenceId) {
    const normalizedConferenceId = String(conferenceId || "").trim();
    return assignments.filter((assignment) => {
      const assignmentConferenceId = String(assignment.conferenceId || "").trim();
      if (!normalizedConferenceId) {
        return true;
      }
      if (assignmentConferenceId) {
        return assignmentConferenceId === normalizedConferenceId;
      }
      const paper = getPaperById(assignment.paperId);
      return paper && String(paper.conferenceId || "").trim() === normalizedConferenceId;
    });
  }

  function createSingleAssignment({ conferenceId, paperId, reviewerId } = {}) {
    const normalizedPaperId = String(paperId || "").trim();
    const normalizedReviewerId = String(reviewerId || "").trim();
    const targetPaper = getPaperByConferenceAndId(conferenceId, normalizedPaperId);

    if (!targetPaper) {
      const error = new Error("invalid_paper");
      error.code = "invalid_paper";
      throw error;
    }

    const reviewer = getReviewerById(normalizedReviewerId);
    if (!reviewer || !reviewer.eligibilityStatus) {
      const error = new Error("ineligible_reviewer");
      error.code = "ineligible_reviewer";
      throw error;
    }

    const effectiveConferenceId = String(targetPaper.conferenceId || conferenceId || "").trim();
    const count = countAssignmentsForReviewerConference(listAssignmentsByConference(effectiveConferenceId), {
      reviewerId: normalizedReviewerId,
      conferenceId: effectiveConferenceId,
    });
    if (count >= MAX_REVIEWER_WORKLOAD) {
      const error = new Error("workload_conflict");
      error.code = "workload_conflict";
      throw error;
    }

    const assignment = createAssignment({
      conferenceId: effectiveConferenceId,
      paperId: normalizedPaperId,
      reviewerId: normalizedReviewerId,
      assignedAt: new Date().toISOString(),
    });
    assignments.push(assignment);
    reviewer.currentAssignmentCount += 1;
    targetPaper.assignedReviewerCount += 1;
    targetPaper.status = "assigned";
    return assignment;
  }

  function createAssignments({ paperId, reviewerIds } = {}) {
    const normalizedPaperId = String(paperId || "").trim();
    const targetPaper = getPaperById(normalizedPaperId);

    if (!targetPaper) {
      const error = new Error("invalid_paper");
      error.code = "invalid_paper";
      throw error;
    }

    const existing = getAssignmentsByPaperId(normalizedPaperId);
    if (existing.length > 0 || targetPaper.status === "assigned") {
      const error = new Error("already_assigned");
      error.code = "already_assigned";
      throw error;
    }

    const now = new Date().toISOString();
    const created = [];

    for (const reviewerId of reviewerIds || []) {
      const reviewer = getReviewerById(reviewerId);
      if (!reviewer) {
        const error = new Error("ineligible_reviewer");
        error.code = "ineligible_reviewer";
        throw error;
      }

      const assignment = createAssignment({
        conferenceId: targetPaper.conferenceId || "",
        paperId: normalizedPaperId,
        reviewerId,
        assignedAt: now,
      });

      assignments.push(assignment);
      reviewer.currentAssignmentCount += 1;
      created.push(assignment);
    }

    targetPaper.status = "assigned";
    targetPaper.assignedReviewerCount = created.length;

    return created;
  }

  function createReviewInvitation(input = {}) {
    const invitation = buildReviewInvitation(input);
    reviewInvitations.push(invitation);
    return invitation;
  }

  function getReviewInvitationById(invitationId) {
    const normalizedInvitationId = String(invitationId || "").trim();
    return reviewInvitations.find((item) => item.id === normalizedInvitationId) || null;
  }

  function listReviewInvitationsByReviewer(reviewerId) {
    const normalizedReviewerId = String(reviewerId || "").trim();
    return reviewInvitations.filter((item) => item.reviewerId === normalizedReviewerId);
  }

  function updateReviewInvitationStatus(invitationId, updates = {}) {
    const invitation = getReviewInvitationById(invitationId);
    if (!invitation) {
      return null;
    }
    invitation.status = String(updates.status || invitation.status || "pending").trim();
    invitation.respondedAt = updates.respondedAt || invitation.respondedAt || null;
    return invitation;
  }

  function createNotificationRecord(input = {}) {
    const notification = createNotification(input);
    notifications.push(notification);
    return notification;
  }

  function listNotificationRecords() {
    return notifications.slice();
  }

  function addAssignmentViolationAuditLog(entry = {}) {
    assignmentViolationAuditLogs.push({
      editor_id: String(entry.editor_id || "").trim(),
      paper_id: String(entry.paper_id || "").trim(),
      violated_rule_id: String(entry.violated_rule_id || "").trim(),
      violation_message: String(entry.violation_message || "").trim(),
      timestamp: String(entry.timestamp || "").trim(),
    });
  }

  function listAssignmentViolationAuditLogs() {
    return assignmentViolationAuditLogs.slice();
  }

  return {
    listSubmittedPapers,
    getPaperById,
    getPaperByConferenceAndId,
    listEligibleReviewers,
    listReviewersByConferenceId,
    getReviewerById,
    getAssignmentsByPaperId,
    listAssignmentsByConference,
    createSingleAssignment,
    createAssignments,
    createReviewInvitation,
    getReviewInvitationById,
    listReviewInvitationsByReviewer,
    updateReviewInvitationStatus,
    createNotificationRecord,
    listNotificationRecords,
    addAssignmentViolationAuditLog,
    listAssignmentViolationAuditLogs,
  };
}

module.exports = {
  createDataAccess,
};
