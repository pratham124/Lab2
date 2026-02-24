function generateId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createUserAccount({ email, credential }) {
  return {
    id: generateId(),
    email,
    credential,
    status: "active",
    created_at: new Date().toISOString(),
  };
}

module.exports = {
  createUserAccount,
};
