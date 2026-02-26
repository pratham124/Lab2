const { createAuthService } = require("../services/auth_service");
const responseService = require("../services/response_service");
const { createMessageService } = require("../services/message_service");

function createAuthGuard({ authService, response, messageService } = {}) {
  const auth = authService || createAuthService();
  const responses = response || responseService;
  const messages = messageService || createMessageService();

  function requireAttendee(headers = {}) {
    const actor = auth.resolveActor(headers);
    if (!actor) {
      return {
        ok: false,
        response: responses.json(401, messages.errorForCode("auth_required")),
      };
    }

    return { ok: true, actor };
  }

  return {
    requireAttendee,
  };
}

module.exports = {
  createAuthGuard,
};
