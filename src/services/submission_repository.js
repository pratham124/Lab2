function createSubmissionRepository({ store } = {}) {
  const backingStore = store || {
    submissions: [],
    drafts: [],
    notifications: [],
  };

  if (!Array.isArray(backingStore.submissions)) {
    backingStore.submissions = [];
  }
  if (!Array.isArray(backingStore.drafts)) {
    backingStore.drafts = [];
  }
  if (!Array.isArray(backingStore.notifications)) {
    backingStore.notifications = [];
  }

  return {
    async create(submission) {
      backingStore.submissions.push(submission);
      return submission;
    },

    async upsert(submission) {
      const index = backingStore.submissions.findIndex(
        (entry) => entry.submission_id === submission.submission_id
      );
      if (index < 0) {
        backingStore.submissions.push(submission);
        return submission;
      }

      backingStore.submissions[index] = {
        ...backingStore.submissions[index],
        ...submission,
      };
      return backingStore.submissions[index];
    },

    async findById(submissionId) {
      return backingStore.submissions.find((entry) => entry.submission_id === submissionId) || null;
    },

    async findByAuthorId(authorId) {
      return backingStore.submissions.filter((entry) => entry.author_id === authorId);
    },

    async findDuplicate({ author_id, title, content_hash, submission_window_id }) {
      return (
        backingStore.submissions.find((entry) => {
          if (entry.submission_window_id !== submission_window_id) {
            return false;
          }

          const sameAuthorAndTitle =
            entry.author_id === author_id &&
            String(entry.title || "").trim().toLowerCase() === String(title || "").trim().toLowerCase();
          const sameHash =
            content_hash && entry.manuscript && entry.manuscript.content_hash === content_hash;

          return sameAuthorAndTitle || Boolean(sameHash);
        }) || null
      );
    },

    async findDraftBySubmissionId(submissionId) {
      return backingStore.drafts.find((entry) => entry.submission_id === submissionId) || null;
    },

    async upsertDraft(draft) {
      const index = backingStore.drafts.findIndex(
        (entry) => entry.submission_id === draft.submission_id
      );
      if (index < 0) {
        backingStore.drafts.push(draft);
        return draft;
      }

      backingStore.drafts[index] = {
        ...backingStore.drafts[index],
        ...draft,
      };
      return backingStore.drafts[index];
    },

    async upsertDecision({ submission_id, decision }) {
      const index = backingStore.submissions.findIndex(
        (entry) => entry.submission_id === submission_id
      );
      if (index < 0) {
        return null;
      }

      const next = {
        ...backingStore.submissions[index],
        final_decision: {
          ...(backingStore.submissions[index].final_decision || {}),
          ...decision,
        },
      };
      backingStore.submissions[index] = next;
      return next.final_decision;
    },

    async findDecisionBySubmissionId(submissionId) {
      const submission = backingStore.submissions.find((entry) => entry.submission_id === submissionId);
      return submission ? submission.final_decision || null : null;
    },

    async recordNotification(notification) {
      backingStore.notifications.push(notification);
      return notification;
    },

    async findNotificationsBySubmissionId(submissionId) {
      return backingStore.notifications.filter((entry) => entry.paper_id === submissionId);
    },
  };
}

module.exports = {
  createSubmissionRepository,
};
