function createSubmissionRepository({ store } = {}) {
  const backingStore = store || {
    submissions: [],
  };

  if (!Array.isArray(backingStore.submissions)) {
    backingStore.submissions = [];
  }

  return {
    async create(submission) {
      backingStore.submissions.push(submission);
      return submission;
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
  };
}

module.exports = {
  createSubmissionRepository,
};
