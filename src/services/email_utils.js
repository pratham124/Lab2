const RFC5322_EMAIL_REGEX =
  /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*)@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isBlank(value) {
  return !value || value.trim() === "";
}

function isValidEmailFormat(email) {
  return RFC5322_EMAIL_REGEX.test(email);
}

module.exports = {
  normalizeEmail,
  isBlank,
  isValidEmailFormat,
};
