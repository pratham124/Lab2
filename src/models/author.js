function createAuthor({ author_id, name, affiliation, contact_email } = {}) {
  return {
    author_id: author_id || `author_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: name || "",
    affiliation: affiliation || "",
    contact_email: contact_email || "",
  };
}

module.exports = {
  createAuthor,
};
