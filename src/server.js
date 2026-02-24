const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createRegistrationService } = require("./services/registration_service");
const { createRegistrationAttemptLogger } = require("./services/registration_attempt_logger");
const { createUserRepository } = require("./services/user_repository");
const { createRegistrationController } = require("./controllers/registration_controller");
const { createUserStore } = require("./services/user-store");
const { createSessionService } = require("./services/session-service");
const { createAuthService } = require("./services/auth-service");
const { createAuthController } = require("./controllers/auth-controller");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || "127.0.0.1";

function createMemoryStore() {
  const users = new Map();
  const attempts = [];

  return {
    findUserByEmailCanonical(emailCanonical) {
      return users.get(emailCanonical) || null;
    },
    createUserAccount(userAccount) {
      if (users.has(userAccount.email)) {
        const error = new Error("Email already exists");
        error.code = "DUPLICATE_EMAIL";
        throw error;
      }

      const salt = userAccount.salt || crypto.randomBytes(16).toString("hex");
      const passwordHash =
        userAccount.password_hash ||
        (typeof userAccount.credential === "string"
          ? crypto.scryptSync(userAccount.credential, salt, 64).toString("hex")
          : null);

      const normalizedUser = {
        ...userAccount,
        id: userAccount.id || `user_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        status: userAccount.status || "active",
        created_at: userAccount.created_at || new Date().toISOString(),
        salt,
        password_hash: passwordHash,
      };

      users.set(normalizedUser.email, normalizedUser);
      return normalizedUser;
    },
    recordRegistrationAttempt(attempt) {
      attempts.push(attempt);
    },
    recordRegistrationFailure(attempt) {
      attempts.push(attempt);
    },
  };
}

function createRegistrationFileStore({ usersFilePath } = {}) {
  const filePath = usersFilePath || path.join(__dirname, "..", "data", "users.json");
  const attempts = [];

  function ensureUsersFile() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "[]", "utf8");
    }
  }

  function readUsers() {
    ensureUsersFile();
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  function writeUsers(users) {
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), "utf8");
  }

  return {
    findUserByEmailCanonical(emailCanonical) {
      const users = readUsers();
      return users.find((user) => user.email === emailCanonical) || null;
    },
    createUserAccount(userAccount) {
      const users = readUsers();
      if (users.some((user) => user.email === userAccount.email)) {
        const error = new Error("Email already exists");
        error.code = "DUPLICATE_EMAIL";
        throw error;
      }

      const salt = userAccount.salt || crypto.randomBytes(16).toString("hex");
      const passwordHash =
        userAccount.password_hash ||
        (typeof userAccount.credential === "string"
          ? crypto.scryptSync(userAccount.credential, salt, 64).toString("hex")
          : null);
      const normalizedUser = {
        ...userAccount,
        id: userAccount.id || `user_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        status: userAccount.status || "active",
        created_at: userAccount.created_at || new Date().toISOString(),
        salt,
        password_hash: passwordHash,
      };
      delete normalizedUser.credential;

      users.push(normalizedUser);
      writeUsers(users);
      return normalizedUser;
    },
    recordRegistrationAttempt(attempt) {
      attempts.push(attempt);
    },
    recordRegistrationFailure(attempt) {
      attempts.push(attempt);
    },
  };
}

function send(res, { status, headers, body }) {
  res.writeHead(status, headers || {});
  res.end(body || "");
}

function serveStatic(res, filePath, contentType) {
  try {
    const content = fs.readFileSync(filePath);
    send(res, { status: 200, headers: { "Content-Type": contentType }, body: content });
  } catch (error) {
    send(res, { status: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" });
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const headers = req.headers || {};
      const contentType = headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(raw || "{}"));
        } catch (error) {
          resolve({});
        }
        return;
      }
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(raw);
        resolve(Object.fromEntries(params.entries()));
        return;
      }
      resolve({});
    });
  });
}

function resolvePort(address, fallbackPort) {
  return address && typeof address === "object" ? address.port : fallbackPort;
}

function createAppServer({
  store,
  userStore: userStoreOverride,
  sessionService: sessionServiceOverride,
  authService: authServiceOverride,
  authController: authControllerOverride,
} = {}) {
  const appStore = store || createMemoryStore();
  const userRepository = createUserRepository({ store: appStore });
  const attemptLogger = createRegistrationAttemptLogger({ store: appStore });
  const registrationService = createRegistrationService({
    userRepository,
    attemptLogger,
  });
  const registrationController = createRegistrationController({ registrationService });

  const fileUserStore = userStoreOverride || createUserStore();
  const userStore = {
    async findByEmail(emailCanonical) {
      const memoryUser =
        typeof appStore.findUserByEmailCanonical === "function"
          ? appStore.findUserByEmailCanonical(emailCanonical)
          : null;

      if (memoryUser) {
        return memoryUser;
      }

      if (fileUserStore && typeof fileUserStore.findByEmail === "function") {
        return fileUserStore.findByEmail(emailCanonical);
      }

      return null;
    },
  };
  const sessionService = sessionServiceOverride || createSessionService();
  const authService = authServiceOverride || createAuthService({ userStore });
  const authController =
    authControllerOverride || createAuthController({ authService, sessionService });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/register") {
      const result = await registrationController.handleGet();
      send(res, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/register") {
      const body = await parseBody(req);
      const result = await registrationController.handlePost({
        headers: req.headers,
        body,
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && (url.pathname === "/login" || url.pathname === "/login.html")) {
      const result = await authController.handleGetLogin({ headers: req.headers });
      send(res, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/login") {
      const body = await parseBody(req);
      const result = await authController.handlePostLogin({
        headers: req.headers,
        body,
      });
      send(res, result);
      return;
    }

    if (
      req.method === "GET" &&
      (url.pathname === "/dashboard" || url.pathname === "/dashboard.html")
    ) {
      const result = await authController.handleGetDashboard({ headers: req.headers });
      send(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/session") {
      const result = await authController.handleGetSession({ headers: req.headers });
      send(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/css/register.css") {
      serveStatic(res, path.join(__dirname, "..", "public", "css", "register.css"), "text/css");
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/register.js") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "js", "register.js"),
        "application/javascript"
      );
      return;
    }

    send(res, { status: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" });
  });

  return { server, store: appStore };
}

function startServer({ port = PORT, host = HOST, logger = console, store } = {}) {
  const { server } = createAppServer({ store: store || createRegistrationFileStore() });
  server.listen(port, host, () => {
    const resolvedPort = resolvePort(server.address(), port);
    logger.log(`CMS dev server running on http://${host}:${resolvedPort}`);
  });
  return server;
}

if (require.main === module) {
  const server = startServer();
  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = {
  createAppServer,
  createRegistrationFileStore,
  startServer,
  __test: {
    send,
    parseBody,
    resolvePort,
  },
};
