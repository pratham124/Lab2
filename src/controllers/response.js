function json(status, payload) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function error(status, message, code) {
  const payload = { message };
  if (code) {
    payload.errorCode = code;
  }
  return json(status, payload);
}

module.exports = {
  json,
  error,
};
