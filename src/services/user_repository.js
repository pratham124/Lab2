class DuplicateEmailError extends Error {
  constructor(message) {
    super(message);
    this.name = "DuplicateEmailError";
    this.code = "DUPLICATE_EMAIL";
  }
}

function createUserRepository({ store } = {}) {
  const usersByEmail = new Map();

  async function findByEmailCanonical(emailCanonical) {
    if (store && typeof store.findUserByEmailCanonical === "function") {
      return store.findUserByEmailCanonical(emailCanonical);
    }

    return usersByEmail.get(emailCanonical) || null;
  }

  async function existsByEmailCanonical(emailCanonical) {
    const existing = await findByEmailCanonical(emailCanonical);
    return Boolean(existing);
  }

  async function create(userAccount) {
    if (store && typeof store.createUserAccount === "function") {
      return store.createUserAccount(userAccount);
    }

    if (usersByEmail.has(userAccount.email)) {
      throw new DuplicateEmailError("Email already exists");
    }

    usersByEmail.set(userAccount.email, userAccount);
    return userAccount;
  }

  return {
    findByEmailCanonical,
    existsByEmailCanonical,
    create,
  };
}

module.exports = {
  DuplicateEmailError,
  createUserRepository,
};
