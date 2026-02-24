function generateId() {
  return `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createRegistrationAttempt({ emailInput, emailCanonical, outcome, reason }) {
  return {
    id: generateId(),
    email_input: emailInput,
    email_canonical: emailCanonical,
    timestamp: new Date().toISOString(),
    outcome,
    reason: reason || null,
  };
}

module.exports = {
  createRegistrationAttempt,
};
