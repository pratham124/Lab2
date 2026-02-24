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
const { createAccountService } = require("./services/account_service");
const { createAccountController } = require("./controllers/account_controller");
const { createSubmissionRepository } = require("./services/submission_repository");
const { createManuscriptStorage } = require("./services/manuscript_storage");
const { createSubmissionService } = require("./services/submission_service");
const { createSubmissionController } = require("./controllers/submission_controller");
const { createRoutes } = require("./controllers/routes");
const { createManuscriptController } = require("./controllers/manuscript_controller");
const { createManuscriptRoutes } = require("./routes/manuscripts");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || "127.0.0.1";

function createMemoryStore() {
  const users = new Map();
  const attempts = [];

  return {
    findUserByEmailCanonical(emailCanonical) {
      return users.get(emailCanonical) || null;
    },
    findUserById(userId) {
      for (const user of users.values()) {
        if (user.id === userId) {
          return user;
        }
      }
      return null;
    },
    updateUserPassword(userId, updates) {
      for (const [email, user] of users.entries()) {
        if (user.id !== userId) {
          continue;
        }

        const updatedUser = {
          ...user,
          ...updates,
        };
        users.set(email, updatedUser);
        return updatedUser;
      }
      return null;
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
    findUserById(userId) {
      const users = readUsers();
      return users.find((user) => user.id === userId) || null;
    },
    updateUserPassword(userId, updates) {
      const users = readUsers();
      const index = users.findIndex((user) => user.id === userId);
      if (index < 0) {
        return null;
      }

      const updatedUser = {
        ...users[index],
        ...updates,
      };
      users[index] = updatedUser;
      writeUsers(users);
      return updatedUser;
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
      const rawBuffer = Buffer.concat(chunks);
      const raw = rawBuffer.toString("utf8");
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
      if (contentType.includes("multipart/form-data")) {
        try {
          const parsed = parseMultipartForm(rawBuffer, contentType);
          resolve(parsed);
        } catch (error) {
          resolve({ __parse_error: "upload_interrupted" });
        }
        return;
      }
      resolve({});
    });
    req.on("error", () => {
      resolve({ __parse_error: "upload_interrupted" });
    });
  });
}

function parseMultipartForm(rawBuffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  const boundary = boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;
  if (!boundary) {
    return {};
  }

  const delimiter = `--${boundary}`;
  const parts = rawBuffer.toString("latin1").split(delimiter);
  const output = {};

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "--") {
      continue;
    }

    const normalized = trimmed.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const divider = normalized.indexOf("\r\n\r\n");
    if (divider < 0) {
      continue;
    }

    const rawHeaders = normalized.slice(0, divider);
    const contentSection = normalized.slice(divider + 4).replace(/\r\n$/, "");
    const disposition = rawHeaders
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-disposition:"));
    if (!disposition) {
      continue;
    }

    const nameMatch = /name="([^"]+)"/i.exec(disposition);
    if (!nameMatch) {
      continue;
    }

    const fieldName = nameMatch[1];
    const fileNameMatch = /filename="([^"]*)"/i.exec(disposition);
    if (fileNameMatch) {
      const contentBuffer = Buffer.from(contentSection, "latin1");
      output[fieldName] = {
        filename: fileNameMatch[1] || "",
        sizeBytes: contentBuffer.length,
        contentBuffer,
      };
      continue;
    }

    output[fieldName] = Buffer.from(contentSection, "latin1").toString("utf8");
  }

  return output;
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
  submissionRepository: submissionRepositoryOverride,
  manuscriptStorage: manuscriptStorageOverride,
  submissionService: submissionServiceOverride,
  submissionController: submissionControllerOverride,
  manuscriptController: manuscriptControllerOverride,
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
    async findById(userId) {
      const memoryUser =
        typeof appStore.findUserById === "function" ? appStore.findUserById(userId) : null;
      if (memoryUser) {
        return memoryUser;
      }

      if (fileUserStore && typeof fileUserStore.findById === "function") {
        return fileUserStore.findById(userId);
      }

      return null;
    },
    async updatePassword(userId, updates) {
      const memoryResult =
        typeof appStore.updateUserPassword === "function"
          ? appStore.updateUserPassword(userId, updates)
          : null;
      if (memoryResult) {
        return memoryResult;
      }

      if (fileUserStore && typeof fileUserStore.updatePassword === "function") {
        return fileUserStore.updatePassword(userId, updates);
      }

      return null;
    },
  };
  const sessionService = sessionServiceOverride || createSessionService();
  const authService = authServiceOverride || createAuthService({ userStore });
  const authController =
    authControllerOverride || createAuthController({ authService, sessionService });
  const accountService = createAccountService({ userStore });
  const accountController = createAccountController({ accountService, sessionService });
  const submissionRepository =
    submissionRepositoryOverride ||
    createSubmissionRepository({
      store: {
        submissions: [],
      },
    });
  const manuscriptStorage = manuscriptStorageOverride || createManuscriptStorage();
  const submissionService =
    submissionServiceOverride ||
    createSubmissionService({
      submissionRepository,
      manuscriptStorage,
    });
  const submissionController =
    submissionControllerOverride ||
    createSubmissionController({
      submissionService,
      sessionService,
    });
  const routes = createRoutes({ submissionController });
  const manuscriptController =
    manuscriptControllerOverride ||
    createManuscriptController({
      submissionRepository,
      manuscriptStorage,
      sessionService,
    });
  const manuscriptRoutes = createManuscriptRoutes({ manuscriptController });

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

    if (
      req.method === "GET" &&
      (url.pathname === "/account/settings" || url.pathname === "/account/settings.html")
    ) {
      const result = await accountController.handleGetSettings({ headers: req.headers });
      send(res, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/account/password") {
      const body = await parseBody(req);
      const result = await accountController.handlePostChangePassword({
        headers: req.headers,
        body,
      });
      send(res, result);
      return;
    }

    if (routes.isSubmissionGetForm(req, url)) {
      const result = await routes.handleSubmissionGetForm(req);
      send(res, result);
      return;
    }

    if (routes.isSubmissionPost(req, url)) {
      const body = await parseBody(req);
      const result = await routes.handleSubmissionPost(req, body);
      send(res, result);
      return;
    }

    if (routes.isSubmissionConfirmation(req, url)) {
      const result = await routes.handleSubmissionConfirmation(req, url);
      send(res, result);
      return;
    }

    if (manuscriptRoutes.isUploadFormRoute(req, url)) {
      const result = await manuscriptRoutes.handleUploadForm(req, url);
      send(res, result);
      return;
    }

    if (manuscriptRoutes.isUploadRoute(req, url)) {
      const body = await parseBody(req);
      const result = await manuscriptRoutes.handleUpload(req, url, body);
      send(res, result);
      return;
    }

    if (manuscriptRoutes.isMetadataRoute(req, url)) {
      const result = await manuscriptRoutes.handleMetadata(req, url);
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

    if (req.method === "GET" && url.pathname === "/css/submission.css") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "css", "submission.css"),
        "text/css"
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/submission.js") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "js", "submission.js"),
        "application/javascript"
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/manuscript_upload.js") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "js", "manuscript_upload.js"),
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
    parseMultipartForm,
    resolvePort,
  },
};
