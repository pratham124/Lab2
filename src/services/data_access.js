const { createPaper } = require("../models/paper");
const { createReviewer } = require("../models/reviewer");
const { createAssignment } = require("../models/assignment");
const { createReviewInvitation: buildReviewInvitation } = require("../models/review_invitation");
const { createNotification } = require("../models/notification");
const { createPresentationDetails } = require("../models/presentation_details");
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
  const manuscripts = Array.isArray(seed.manuscripts) ? seed.manuscripts : [];
  const presentationDetails = Array.isArray(seed.presentationDetails) ? seed.presentationDetails : [];
  const registrationPrices = Array.isArray(seed.registrationPrices) ? seed.registrationPrices : [];
  const conferenceTimezone = String(seed.conferenceTimezone || "UTC").trim() || "UTC";

  return {
    papers,
    reviewers,
    assignments,
    reviewInvitations,
    notifications,
    manuscripts,
    presentationDetails,
    registrationPrices,
    conferenceTimezone,
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
  const manuscripts = new Map(
    normalized.manuscripts.map((manuscript) => {
      const paperId = String(manuscript.paperId || "").trim();
      return [
        paperId,
        {
          manuscriptId: String(manuscript.manuscriptId || "").trim(),
          paperId,
          availability:
            String(manuscript.availability || "available").trim().toLowerCase() || "available",
          content: String(manuscript.content || "").trim(),
          version: String(manuscript.version || "").trim(),
        },
      ];
    })
  );
  const presentationDetailsByPaperId = new Map(
    normalized.presentationDetails.map((details) => {
      const model = createPresentationDetails({
        ...details,
        timezone: details.timezone || normalized.conferenceTimezone,
      });
      return [model.paperId, model];
    })
  );
  const registrationPrices = normalized.registrationPrices.map((entry) => ({
    name: String(entry.name || entry.category_name || "").trim(),
    category_name: String(entry.category_name || entry.name || "").trim(),
    amount:
      entry.amount === null || typeof entry.amount === "undefined"
        ? null
        : Number.isFinite(Number(entry.amount))
          ? Number(entry.amount)
          : null,
    active: typeof entry.active === "boolean" ? entry.active : true,
    order: Number.isInteger(entry.order) ? entry.order : null,
  }));
  const conferenceTimezone = normalized.conferenceTimezone;
  const assignmentViolationAuditLogs = [];

  function listSubmittedPapers() {
    return Array.from(papers.values()).filter((paper) => paper.status === "submitted");
  }

  function getPaperById(paperId) {
    return papers.get(String(paperId || "").trim()) || null;
  }

  function listPapersByAuthorId(authorId) {
    const normalizedAuthorId = String(authorId || "").trim();
    if (!normalizedAuthorId) {
      return [];
    }

    return Array.from(papers.values()).filter((paper) => {
      if (String(paper.authorId || "").trim() === normalizedAuthorId) {
        return true;
      }
      if (Array.isArray(paper.authorIds)) {
        return paper.authorIds.includes(normalizedAuthorId);
      }
      return false;
    });
  }

  function listAcceptedPapersByAuthorId(authorId) {
    return listPapersByAuthorId(authorId).filter(
      (paper) => String(paper.status || "").trim().toLowerCase() === "accepted"
    );
  }

  function isPaperOwnedByAuthor({ authorId, paperId } = {}) {
    const normalizedAuthorId = String(authorId || "").trim();
    const paper = getPaperById(paperId);
    if (!paper || !normalizedAuthorId) {
      return false;
    }
    if (String(paper.authorId || "").trim() === normalizedAuthorId) {
      return true;
    }
    return Array.isArray(paper.authorIds) && paper.authorIds.includes(normalizedAuthorId);
  }

  function listAcceptedPapers() {
    return Array.from(papers.values()).filter(
      (paper) => String(paper.status || "").trim().toLowerCase() === "accepted"
    );
  }

  function listAcceptedAuthors() {
    const ids = new Set();
    for (const paper of listAcceptedPapers()) {
      const primary = String(paper.authorId || "").trim();
      if (primary) {
        ids.add(primary);
      }
      if (Array.isArray(paper.authorIds)) {
        for (const authorId of paper.authorIds) {
          const normalizedAuthorId = String(authorId || "").trim();
          if (normalizedAuthorId) {
            ids.add(normalizedAuthorId);
          }
        }
      }
    }
    return Array.from(ids.values());
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

  function listAssignmentsByReviewerId(reviewerId) {
    const normalizedReviewerId = String(reviewerId || "").trim();
    return assignments.filter((assignment) => assignment.reviewerId === normalizedReviewerId);
  }

  function isPaperAssignedToReviewer({ reviewerId, paperId } = {}) {
    const normalizedReviewerId = String(reviewerId || "").trim();
    const normalizedPaperId = String(paperId || "").trim();
    if (!normalizedReviewerId || !normalizedPaperId) {
      return false;
    }
    return assignments.some(
      (assignment) =>
        assignment.reviewerId === normalizedReviewerId && assignment.paperId === normalizedPaperId
    );
  }

  function getManuscriptByPaperId(paperId) {
    const normalizedPaperId = String(paperId || "").trim();
    return manuscripts.get(normalizedPaperId) || null;
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

  function listRegistrationPrices() {
    return registrationPrices.map((entry) => ({ ...entry }));
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

  function listNotificationRecordsByType(type) {
    const normalizedType = String(type || "").trim();
    return notifications.filter((entry) => String(entry.type || "").trim() === normalizedType);
  }

  function getPresentationDetailsByPaperId(paperId) {
    const normalizedPaperId = String(paperId || "").trim();
    const existing = presentationDetailsByPaperId.get(normalizedPaperId);
    if (!existing) {
      return null;
    }
    return {
      ...existing,
      timezone: String(existing.timezone || conferenceTimezone).trim() || "UTC",
    };
  }

  function savePresentationDetails(input = {}) {
    const details = createPresentationDetails({
      ...input,
      timezone: input.timezone || conferenceTimezone,
    });
    presentationDetailsByPaperId.set(details.paperId, details);
    return details;
  }

  function getConferenceTimezone() {
    return conferenceTimezone;
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
    listPapersByAuthorId,
    listAcceptedPapersByAuthorId,
    isPaperOwnedByAuthor,
    listAcceptedPapers,
    listAcceptedAuthors,
    getPaperByConferenceAndId,
    listEligibleReviewers,
    listReviewersByConferenceId,
    getReviewerById,
    getAssignmentsByPaperId,
    listAssignmentsByReviewerId,
    isPaperAssignedToReviewer,
    getManuscriptByPaperId,
    listAssignmentsByConference,
    listRegistrationPrices,
    createSingleAssignment,
    createAssignments,
    createReviewInvitation,
    getReviewInvitationById,
    listReviewInvitationsByReviewer,
    updateReviewInvitationStatus,
    createNotificationRecord,
    listNotificationRecords,
    listNotificationRecordsByType,
    getPresentationDetailsByPaperId,
    savePresentationDetails,
    getConferenceTimezone,
    addAssignmentViolationAuditLog,
    listAssignmentViolationAuditLogs,
  };
}

module.exports = {
  createDataAccess,
};
