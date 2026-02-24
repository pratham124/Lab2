const ALLOWED_DRAFT_FIELDS = ["title", "abstract", "keywords", "affiliation", "contact_email"];

function toTrimmedString(value) {
  return String(value || "").trim();
}

function normalizeDraftData(data = {}) {
  const source = data && typeof data === "object" ? data : {};
  return ALLOWED_DRAFT_FIELDS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      acc[key] = toTrimmedString(source[key]);
    }
    return acc;
  }, {});
}

function validateProvidedDraftFields(data = {}) {
  const errors = {};
  const email = data.contact_email;

  if (typeof data.title === "string" && data.title.length > 300) {
    errors.title = "Title must be 300 characters or fewer.";
  }

  if (typeof data.abstract === "string" && data.abstract.length > 5000) {
    errors.abstract = "Abstract must be 5000 characters or fewer.";
  }

  if (typeof data.keywords === "string" && data.keywords.length > 500) {
    errors.keywords = "Keywords must be 500 characters or fewer.";
  }

  if (typeof data.affiliation === "string" && data.affiliation.length > 200) {
    errors.affiliation = "Affiliation must be 200 characters or fewer.";
  }

  if (typeof email === "string" && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contact_email = "Contact email must be valid.";
  }

  return errors;
}

module.exports = {
  ALLOWED_DRAFT_FIELDS,
  normalizeDraftData,
  validateProvidedDraftFields,
};
