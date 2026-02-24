const crypto = require("crypto");

function createSessionService({ ttlMs = 1000 * 60 * 60 * 8 } = {}) {
  const sessions = new Map();

  function create(userId) {
    const sessionId = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const session = {
      session_id: sessionId,
      user_id: userId,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttlMs).toISOString(),
      last_active_at: new Date(now).toISOString(),
    };
    sessions.set(sessionId, session);
    return session;
  }

  function validate(sessionId) {
    if (!sessionId) {
      return null;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const now = Date.now();
    if (new Date(session.expires_at).getTime() <= now) {
      sessions.delete(sessionId);
      return null;
    }

    session.last_active_at = new Date(now).toISOString();
    sessions.set(sessionId, session);
    return session;
  }

  function destroy(sessionId) {
    sessions.delete(sessionId);
  }

  return {
    create,
    validate,
    destroy,
  };
}

module.exports = {
  createSessionService,
};
