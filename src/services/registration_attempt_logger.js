function createRegistrationAttemptLogger({ store } = {}) {
  const attempts = [];

  function record(attempt, isFailure = false) {
    if (store) {
      if (isFailure && typeof store.recordRegistrationFailure === "function") {
        store.recordRegistrationFailure(attempt);
        return;
      }
      if (typeof store.recordRegistrationAttempt === "function") {
        store.recordRegistrationAttempt(attempt);
        return;
      }
    }

    attempts.push(attempt);
  }

  return {
    logAttempt(attempt) {
      record(attempt, false);
    },
    logFailure(attempt) {
      record(attempt, true);
    },
    getAttempts() {
      return attempts.slice();
    },
  };
}

module.exports = {
  createRegistrationAttemptLogger,
};
