const { getSession } = require("./controller_utils");

function createAuthGateController({ sessionService } = {}) {
  function requireAuthenticated(headers = {}) {
    const session = getSession(headers, sessionService);
    if (!session) {
      return { ok: false, status: 401, message: "Not authenticated." };
    }
    return { ok: true, session };
  }

  return {
    requireAuthenticated,
  };
}

module.exports = {
  createAuthGateController,
};
