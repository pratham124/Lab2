function createSubmissionRepository({ store } = {}) {
  const backingStore = store || {
    submissions: [],
    drafts: [],
  };

  if (!Array.isArray(backingStore.submissions)) {
    backingStore.submissions = [];
  }
  if (!Array.isArray(backingStore.drafts)) {
    backingStore.drafts = [];
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
  };
}

module.exports = {
  createSubmissionRepository,
};
