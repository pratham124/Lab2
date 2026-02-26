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
const { createAuthService: createActorAuthService } = require("./services/auth_service");
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
const { createDraftService } = require("./services/draft_service");
const { createDraftController } = require("./controllers/draft_controller");
const { createLoggingService } = require("./services/logging_service");
const { createDatastoreService } = require("./services/datastore_service");
const { createPaymentService } = require("./services/payment_service");
const { createMessageService } = require("./services/message_service");
const { createAuditService } = require("./services/audit_service");
const { createPaymentController } = require("./controllers/payment_controller");
const { createAuthGuard } = require("./controllers/auth_guard");
const { createDecisionService } = require("./services/decision-service");
const { createDecisionController } = require("./controllers/decision-controller");
const { createNotificationService } = require("./services/notification-service");
const { createDataAccess } = require("./services/data_access");
const { createAssignmentService } = require("./services/assignment_service");
const {
  createNotificationService: createReviewerNotificationService,
} = require("./services/notification_service");
const { createAssignmentController } = require("./controllers/assignment_controller");
const { createReviewerSelectionController } = require("./controllers/reviewer_selection_controller");
const { createReviewerAssignmentController } = require("./controllers/reviewer_assignment_controller");
const { createWorkloadLoggingController } = require("./controllers/logging");
const {
  createAssignmentRuleValidationService,
} = require("./services/assignment_rule_validation_service");
const { createAssignmentRulesController } = require("./controllers/assignment_rules_controller");
const { createRouter } = require("./controllers/router");
const { createReviewInvitationsController } = require("./controllers/review_invitations_controller");
const { createInvitationStatusService } = require("./services/invitation_status_service");
const { createReviewInvitationService } = require("./services/review_invitation_service");
const {
  createReviewInvitationActionService,
} = require("./services/review_invitation_action_service");
const { createInvitationCreationService } = require("./services/invitation_creation_service");
const { createSecurityLogService } = require("./services/security_log_service");
const { createAuthorizationService } = require("./services/authorization_service");
const { createAssignedPapersController } = require("./controllers/assigned_papers_controller");
const { createReviewController } = require("./controllers/review_controller");
const { createReviewModel } = require("./models/review_model");
const { createReviewService } = require("./controllers/review_service");
const { createCompletedReviewsController } = require("./controllers/completed_reviews_controller");
const { createErrorLog } = require("./controllers/error_log");
const { createStorageAdapter } = require("./services/storage_adapter");
const { createScheduleGenerator } = require("./services/schedule_generator");
const { createScheduleService } = require("./services/schedule_service");
const { createScheduleController } = require("./controllers/schedule_controller");
const { createScheduleEditController } = require("./controllers/schedule_edit_controller");
const { createPresentationDetailsService } = require("./services/presentation_details_service");
const { createAuditLogService } = require("./services/audit_log_service");
const { createAuthorSubmissionsController } = require("./controllers/author_submissions_controller");
const {
  createAuthorPresentationDetailsController,
} = require("./controllers/author_presentation_details_controller");
const { createAdminScheduleController } = require("./controllers/admin_schedule_controller");
const { createPricingService } = require("./services/pricing-service");
const {
  createRegistrationPricesController,
} = require("./controllers/registration-prices-controller");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || "127.0.0.1";

function createMemoryStore() {
  const users = new Map();
  const attempts = [];
  const reviews = [];

  return {
    reviews,
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
  const reviews = [];

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
    reviews,
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
  draftService: draftServiceOverride,
  draftController: draftControllerOverride,
  datastoreService: datastoreServiceOverride,
  paymentService: paymentServiceOverride,
  paymentController: paymentControllerOverride,
  messageService: messageServiceOverride,
  auditService: auditServiceOverride,
  authGuard: authGuardOverride,
  loggingService: loggingServiceOverride,
  decisionService: decisionServiceOverride,
  decisionController: decisionControllerOverride,
  notificationService: notificationServiceOverride,
  assignmentDataAccess: assignmentDataAccessOverride,
  assignmentService: assignmentServiceOverride,
  assignmentController: assignmentControllerOverride,
  assignmentRuleValidationService: assignmentRuleValidationServiceOverride,
  assignmentRulesController: assignmentRulesControllerOverride,
  reviewerSelectionController: reviewerSelectionControllerOverride,
  reviewerAssignmentController: reviewerAssignmentControllerOverride,
  manuscriptController: manuscriptControllerOverride,
  reviewInvitationsController: reviewInvitationsControllerOverride,
  reviewController: reviewControllerOverride,
  reviewService: reviewServiceOverride,
  completedReviewsController: completedReviewsControllerOverride,
  scheduleController: scheduleControllerOverride,
  scheduleEditController: scheduleEditControllerOverride,
  authorSubmissionsController: authorSubmissionsControllerOverride,
  authorPresentationDetailsController: authorPresentationDetailsControllerOverride,
  adminScheduleController: adminScheduleControllerOverride,
  pricingService: pricingServiceOverride,
  registrationPricesController: registrationPricesControllerOverride,
  errorLog: errorLogOverride,
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
      store: appStore,
    });
  const manuscriptStorage = manuscriptStorageOverride || createManuscriptStorage();
  const submissionService =
    submissionServiceOverride ||
    createSubmissionService({
      submissionRepository,
      manuscriptStorage,
    });
  const loggingService = loggingServiceOverride || createLoggingService();
  const messageService = messageServiceOverride || createMessageService();
  const auditService = auditServiceOverride || createAuditService({ logger: loggingService });
  const datastoreService =
    datastoreServiceOverride ||
    createDatastoreService({
      store: appStore,
      logger: loggingService,
    });
  const draftService =
    draftServiceOverride ||
    createDraftService({
      submissionRepository,
      loggingService,
    });
  const submissionController =
    submissionControllerOverride ||
    createSubmissionController({
      submissionService,
      sessionService,
      draftService,
    });
  const draftController =
    draftControllerOverride ||
    createDraftController({
      draftService,
      sessionService,
    });
  const notificationService =
    notificationServiceOverride ||
    createNotificationService({
      submissionRepository,
    });
  const decisionService =
    decisionServiceOverride ||
    createDecisionService({
      submissionRepository,
      notificationService,
    });
  const decisionController =
    decisionControllerOverride ||
    createDecisionController({
      decisionService,
      sessionService,
    });
  const reviewerDataAccess =
    assignmentDataAccessOverride ||
    createDataAccess({
      seed: {
        papers: [
          {
            id: "P1",
            conferenceId: "C1",
            title: "Sample Submitted Paper",
            abstract: "Sample abstract for invited reviewers.",
            status: "submitted",
            authorId: "author_1",
            assignedReviewerCount: 0,
            assignedEditorId: "editor_1",
          },
          {
            id: "P18A",
            conferenceId: "C1",
            title: "Accepted Paper A",
            status: "accepted",
            authorId: "author_1",
            authorIds: ["author_1"],
          },
          {
            id: "P18B",
            conferenceId: "C1",
            title: "Accepted Paper B",
            status: "accepted",
            authorId: "author_2",
            authorIds: ["author_2"],
          },
          {
            id: "P18C",
            conferenceId: "C1",
            title: "Accepted Paper C",
            status: "accepted",
            authorId: "author_2",
            authorIds: ["author_2"],
          },
        ],
        reviewers: [
          {
            id: "R1",
            name: "Reviewer One",
            email: "reviewer1@example.com",
            currentAssignmentCount: 1,
            eligibilityStatus: true,
          },
          {
            id: "R2",
            name: "Reviewer Two",
            email: "reviewer2@example.com",
            currentAssignmentCount: 2,
            eligibilityStatus: true,
          },
          {
            id: "R3",
            name: "Reviewer Three",
            email: "reviewer3@example.com",
            currentAssignmentCount: 3,
            eligibilityStatus: true,
          },
          {
            id: "R4",
            name: "Reviewer Four",
            email: "reviewer4@example.com",
            currentAssignmentCount: 4,
            eligibilityStatus: true,
          },
          {
            id: "R5",
            name: "Reviewer Five",
            email: "reviewer5@example.com",
            currentAssignmentCount: 5,
            eligibilityStatus: true,
          },
        ],
        assignments: [
          {
            id: "A100",
            conferenceId: "C1",
            paperId: "P1",
            reviewerId: "R1",
            assignedAt: new Date().toISOString(),
          },
        ],
        reviewInvitations: [
          {
            id: "INV_P1_R1",
            reviewerId: "R1",
            paperId: "P1",
            status: "accepted",
            respondedAt: new Date().toISOString(),
          },
        ],
        manuscripts: [
          {
            manuscriptId: "M100",
            paperId: "P1",
            availability: "available",
            content: "Sample manuscript content for review. View-only access.",
            version: "v1",
          },
        ],
        presentationDetails: [
          {
            paperId: "P18A",
            date: "2026-04-10",
            time: "10:00",
            session: "S1",
            location: "Room R1",
            timezone: "UTC",
          },
          {
            paperId: "P18B",
            date: "2026-04-10",
            time: "11:00",
            session: "S2",
            location: "Room R2",
            timezone: "UTC",
          },
          {
            paperId: "P18C",
            date: "2026-04-11",
            time: "09:00",
            session: "S3",
            location: "Room R1",
            timezone: "UTC",
          },
        ],
        conferenceTimezone: "UTC",
        registrationPrices: [
          { name: "Regular", amount: 200, active: true, order: 1 },
          { name: "Student", amount: 100, active: true, order: 2 },
          { name: "Workshop", amount: null, active: true, order: 3 },
          { name: "VIP", amount: 500, active: false, order: 4 },
        ],
      },
    });
  const reviewerNotificationService = createReviewerNotificationService({
    dataAccess: reviewerDataAccess,
    logger: console,
  });
  const securityLogService = createSecurityLogService({ logger: console });
  const authorizationService = createAuthorizationService({
    securityLogService,
    dataAccess: reviewerDataAccess,
  });
  const invitationStatusService = createInvitationStatusService();
  const invitationCreationService = createInvitationCreationService({
    dataAccess: reviewerDataAccess,
    notificationService: reviewerNotificationService,
    failureLogger: console,
  });
  const assignmentService =
    assignmentServiceOverride ||
    createAssignmentService({
      dataAccess: reviewerDataAccess,
      notificationService: reviewerNotificationService,
      invitationCreationService,
      authorizationService,
    });
  const assignmentController =
    assignmentControllerOverride ||
    createAssignmentController({
      assignmentService,
      sessionService,
      dataAccess: reviewerDataAccess,
    });
  const assignmentRuleValidationService =
    assignmentRuleValidationServiceOverride ||
    createAssignmentRuleValidationService({
      dataAccess: reviewerDataAccess,
      failureLogger: console,
    });
  const assignmentRulesController =
    assignmentRulesControllerOverride ||
    createAssignmentRulesController({
      assignmentRuleValidationService,
      sessionService,
    });
  const workloadLoggingController = createWorkloadLoggingController({ logger: console });
  const reviewerSelectionController =
    reviewerSelectionControllerOverride ||
    createReviewerSelectionController({
      sessionService,
      dataAccess: reviewerDataAccess,
    });
  const reviewerAssignmentController =
    reviewerAssignmentControllerOverride ||
    createReviewerAssignmentController({
      sessionService,
      dataAccess: reviewerDataAccess,
      workloadLogger: workloadLoggingController,
    });
  const reviewInvitationService = createReviewInvitationService({
    dataAccess: reviewerDataAccess,
    invitationStatusService,
    authorizationService,
  });
  const reviewInvitationActionService = createReviewInvitationActionService({
    dataAccess: reviewerDataAccess,
    authorizationService,
  });
  const reviewInvitationsController =
    reviewInvitationsControllerOverride ||
    createReviewInvitationsController({
      sessionService,
      reviewInvitationService,
      reviewInvitationActionService,
    });
  const assignedPapersController = createAssignedPapersController({
    sessionService,
    assignmentService,
  });
  const reviewModel = createReviewModel({ store: appStore });
  const reviewService =
    reviewServiceOverride || createReviewService({ reviewModel, dataAccess: reviewerDataAccess });
  const reviewFailureLog = errorLogOverride || createErrorLog({ logger: console });
  const reviewController =
    reviewControllerOverride ||
    createReviewController({
      sessionService,
      reviewModel,
      dataAccess: reviewerDataAccess,
      authorizationService,
    });
  const completedReviewsController =
    completedReviewsControllerOverride ||
    createCompletedReviewsController({
      sessionService,
      dataAccess: reviewerDataAccess,
      reviewService,
      errorLog: reviewFailureLog,
    });
  const storageAdapter = createStorageAdapter({ store: appStore });
  const scheduleGenerator = createScheduleGenerator();
  const scheduleService = createScheduleService({
    storageAdapter,
    scheduleGenerator,
  });
  const scheduleController =
    scheduleControllerOverride ||
    createScheduleController({
      scheduleService,
      sessionService,
    });
  const scheduleEditController =
    scheduleEditControllerOverride ||
    createScheduleEditController({
      scheduleService,
      sessionService,
    });
  const presentationDetailsService = createPresentationDetailsService({
    dataAccess: reviewerDataAccess,
  });
  const auditLogService = createAuditLogService({ logger: console });
  const authorSubmissionsController =
    authorSubmissionsControllerOverride ||
    createAuthorSubmissionsController({
      dataAccess: reviewerDataAccess,
      presentationDetailsService,
      authService: createActorAuthService({ sessionService }),
    });
  const authorPresentationDetailsController =
    authorPresentationDetailsControllerOverride ||
    createAuthorPresentationDetailsController({
      dataAccess: reviewerDataAccess,
      authorizationService,
      scheduleService,
      presentationDetailsService,
      auditLogService,
      authService: createActorAuthService({ sessionService }),
    });
  const adminScheduleController =
    adminScheduleControllerOverride ||
    createAdminScheduleController({
      scheduleService,
      notificationService: reviewerNotificationService,
      auditLogService,
      authService: createActorAuthService({ sessionService }),
      conferenceId: "C1",
      conferenceTimezone: reviewerDataAccess.getConferenceTimezone(),
    });
  const pricingService =
    pricingServiceOverride ||
    createPricingService({
      dataAccess: reviewerDataAccess,
      logger: console,
      formatOptions: { locale: "en-US", currency: "USD" },
    });
  const registrationPricesController =
    registrationPricesControllerOverride ||
    createRegistrationPricesController({
      pricingService,
    });
  const paymentService =
    paymentServiceOverride ||
    createPaymentService({
      datastoreService,
      messageService,
      auditService,
      loggingService,
    });
  const paymentAuthGuard =
    authGuardOverride ||
    createAuthGuard({
      authService: createActorAuthService({ sessionService }),
      messageService,
    });
  const paymentController =
    paymentControllerOverride ||
    createPaymentController({
      paymentService,
      messageService,
      authGuard: paymentAuthGuard,
    });
  const routes = createRoutes({
    submissionController,
    draftController,
    decisionController,
    assignmentController,
    assignmentRulesController,
    reviewerSelectionController,
    reviewerAssignmentController,
    assignedPapersController,
    completedReviewsController,
  });
  const router = createRouter({
    reviewInvitationsController,
  });
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

    if (
      req.method === "GET" &&
      (url.pathname === "/registration-prices" || url.pathname === "/registration-prices.html")
    ) {
      const result = await registrationPricesController.handleGetPage({
        headers: req.headers,
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/registration-prices") {
      const result = await registrationPricesController.handleGetApi({
        headers: req.headers,
      });
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

    const paymentPageMatch = url.pathname.match(/^\/registrations\/([A-Za-z0-9_-]+)\/payment$/);
    if (req.method === "GET" && paymentPageMatch) {
      const result = await paymentController.handleGetInitiatePage({
        headers: req.headers,
        params: { registration_id: paymentPageMatch[1] },
      });
      send(res, result);
      return;
    }

    const paymentInitiateMatch = url.pathname.match(
      /^\/registrations\/([A-Za-z0-9_-]+)\/payment\/initiate$/
    );
    if (req.method === "POST" && paymentInitiateMatch) {
      const body = await parseBody(req);
      const result = await paymentController.handleInitiate({
        headers: req.headers,
        body,
        params: { registration_id: paymentInitiateMatch[1] },
      });
      send(res, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/payments/confirm") {
      const body = await parseBody(req);
      const result = await paymentController.handleConfirm({ body });
      send(res, result);
      return;
    }

    const paymentStatusMatch = url.pathname.match(
      /^\/registrations\/([A-Za-z0-9_-]+)\/payment-status$/
    );
    if (req.method === "GET" && paymentStatusMatch) {
      const result = await paymentController.handleStatus({
        headers: req.headers,
        params: { registration_id: paymentStatusMatch[1] },
      });
      send(res, result);
      return;
    }

    const paymentRecordsMatch = url.pathname.match(
      /^\/registrations\/([A-Za-z0-9_-]+)\/payment-records$/
    );
    if (req.method === "GET" && paymentRecordsMatch) {
      const result = await paymentController.handleRecords({
        headers: req.headers,
        params: { registration_id: paymentRecordsMatch[1] },
      });
      send(res, result);
      return;
    }

    if (req.method === "POST" && /^\/admin\/conferences\/[A-Za-z0-9_-]+\/schedule\/generate$/.test(url.pathname)) {
      const body = await parseBody(req);
      const conferenceId = url.pathname.split("/")[3];
      const result = await scheduleController.handleGenerate({
        headers: req.headers,
        params: { conference_id: conferenceId },
        body,
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && /^\/admin\/conferences\/[A-Za-z0-9_-]+\/schedule$/.test(url.pathname)) {
      const conferenceId = url.pathname.split("/")[3];
      const result = await scheduleController.handleGetSchedule({
        headers: req.headers,
        params: { conference_id: conferenceId },
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && (url.pathname === "/schedule" || url.pathname === "/schedule.html")) {
      const result = await scheduleController.handleGetPublishedPage({
        headers: req.headers,
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/schedule/published") {
      const result = await scheduleController.handleGetPublished({
        headers: req.headers,
        query: {
          conferenceId: url.searchParams.get("conferenceId") || "C1",
          day: url.searchParams.get("day") || "",
          session: url.searchParams.get("session") || "",
        },
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/schedule/current") {
      const conferenceId = String(url.searchParams.get("conferenceId") || "C1").trim();
      const result = await scheduleEditController.handleGetCurrentSchedule({
        headers: req.headers,
        params: { conference_id: conferenceId },
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && /^\/schedule\/items\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
      const itemId = url.pathname.split("/")[3];
      const conferenceId = String(url.searchParams.get("conferenceId") || "C1").trim();
      const result = await scheduleEditController.handleGetScheduleItem({
        headers: req.headers,
        params: { conference_id: conferenceId, item_id: itemId },
      });
      send(res, result);
      return;
    }

    if (req.method === "PUT" && /^\/schedule\/items\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
      const body = await parseBody(req);
      const itemId = url.pathname.split("/")[3];
      const conferenceId = String(url.searchParams.get("conferenceId") || "C1").trim();
      const result = await scheduleEditController.handleUpdateScheduleItem({
        headers: req.headers,
        params: { conference_id: conferenceId, item_id: itemId },
        body,
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/author/submissions") {
      const result = await authorSubmissionsController.handleListSubmissions({
        headers: req.headers,
      });
      send(res, result);
      return;
    }

    if (
      req.method === "GET" &&
      /^\/api\/author\/submissions\/[A-Za-z0-9_-]+\/presentation-details$/.test(url.pathname)
    ) {
      const paperId = url.pathname.split("/")[4];
      const result = await authorPresentationDetailsController.handleGetPresentationDetails({
        headers: req.headers,
        params: { paperId },
      });
      send(res, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/schedule/publish") {
      const result = await adminScheduleController.handlePublish({
        headers: req.headers,
      });
      send(res, result);
      return;
    }

    if (routes.isSubmissionGetForm(req, url)) {
      const query = {};
      for (const [key, value] of url.searchParams.entries()) {
        query[key] = value;
      }
      req.query = query;
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

    if (routes.isDraftGet(req, url)) {
      const result = await routes.handleDraftGet(req, url);
      send(res, result);
      return;
    }

    if (routes.isDraftPut(req, url)) {
      const body = await parseBody(req);
      const result = await routes.handleDraftPut(req, url, body);
      send(res, result);
      return;
    }

    if (routes.isPapersList(req, url)) {
      const result = await routes.handlePapersList(req);
      send(res, result);
      return;
    }

    if (routes.isPaperDecisionGet(req, url)) {
      const result = await routes.handlePaperDecisionGet(req, url);
      send(res, result);
      return;
    }

    if (routes.isAssignReviewersFormGet(req, url)) {
      const result = await routes.handleAssignReviewersFormGet(req, url);
      send(res, result);
      return;
    }

    if (routes.isEligibleReviewersGet(req, url)) {
      const result = await routes.handleEligibleReviewersGet(req, url);
      send(res, result);
      return;
    }

    if (routes.isAssignReviewersPost(req, url)) {
      const body = await parseBody(req);
      const result = await routes.handleAssignReviewersPost(req, url, body);
      send(res, result);
      return;
    }

    if (routes.isAssignmentsGet(req, url)) {
      const result = await routes.handleAssignmentsGet(req, url);
      send(res, result);
      return;
    }

    if (routes.isReviewerAssignmentsPost(req, url)) {
      const body = await parseBody(req);
      const result = await routes.handleReviewerAssignmentsPost(req, url, body);
      send(res, result);
      return;
    }

    if (routes.isViolationAuditLogsGet(req, url)) {
      const result = await routes.handleViolationAuditLogsGet(req);
      send(res, result);
      return;
    }

    if (routes.isConferenceSelectableReviewersGet(req, url)) {
      const result = await routes.handleConferenceSelectableReviewersGet(req, url);
      send(res, result);
      return;
    }

    if (routes.isConferenceAssignmentPost(req, url)) {
      const body = await parseBody(req);
      const result = await routes.handleConferenceAssignmentPost(req, url, body);
      send(res, result);
      return;
    }

    if (routes.isReviewerAssignedPapersList(req, url)) {
      const result = await routes.handleReviewerAssignedPapersList(req);
      send(res, result);
      return;
    }

    if (routes.isReviewerAssignedPaperView(req, url)) {
      const result = await routes.handleReviewerAssignedPaperView(req, url);
      send(res, result);
      return;
    }

    if (routes.isReviewerAssignedPaperDownload(req, url)) {
      const result = await routes.handleReviewerAssignedPaperDownload(req);
      send(res, result);
      return;
    }

    if (
      req.method === "GET" &&
      /^\/papers\/[A-Za-z0-9_-]+\/reviews\/new(?:\\.html)?$/.test(url.pathname)
    ) {
      const paperId = url.pathname.split("/")[2];
      const result = await reviewController.handleGetForm({
        headers: req.headers,
        params: { paper_id: paperId },
      });
      send(res, result);
      return;
    }

    if (req.method === "POST" && /^\/papers\/[A-Za-z0-9_-]+\/reviews$/.test(url.pathname)) {
      const body = await parseBody(req);
      const paperId = url.pathname.split("/")[2];
      const result = await reviewController.handlePost({
        headers: req.headers,
        params: { paper_id: paperId },
        body,
      });
      send(res, result);
      return;
    }

    if (req.method === "GET" && /^\/papers\/[A-Za-z0-9_-]+\/reviews$/.test(url.pathname)) {
      const paperId = url.pathname.split("/")[2];
      const result = await reviewController.handleList({
        headers: req.headers,
        params: { paper_id: paperId },
      });
      send(res, result);
      return;
    }

    if (routes.isCompletedReviewsGet(req, url)) {
      const result = await routes.handleCompletedReviewsGet(req, url);
      send(res, result);
      return;
    }

    if (router.isReviewInvitationsPage(req, url)) {
      const result = await router.handleReviewInvitationsPage(req);
      send(res, result);
      return;
    }

    if (router.isReviewInvitationsList(req, url)) {
      const result = await router.handleReviewInvitationsList(req, url);
      send(res, result);
      return;
    }

    if (router.isReviewInvitationDetail(req, url)) {
      const result = await router.handleReviewInvitationDetail(req, url);
      send(res, result);
      return;
    }

    if (router.isReviewInvitationAction(req, url)) {
      const result = await router.handleReviewInvitationAction(req, url);
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

    if (req.method === "GET" && url.pathname === "/assets/registration-prices.css") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "assets", "registration-prices.css"),
        "text/css"
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/registration-prices.js") {
      serveStatic(
        res,
        path.join(__dirname, "views", "registration-prices.js"),
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

    if (req.method === "GET" && url.pathname === "/js/review_form.js") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "js", "review_form.js"),
        "application/javascript"
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/editor_reviews.js") {
      serveStatic(
        res,
        path.join(__dirname, "..", "public", "js", "editor_reviews.js"),
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

    if (req.method === "GET" && url.pathname === "/css/base.css") {
      serveStatic(res, path.join(__dirname, "views", "styles", "base.css"), "text/css");
      return;
    }

    if (req.method === "GET" && url.pathname === "/css/schedule_view.css") {
      serveStatic(res, path.join(__dirname, "views", "schedule_view.css"), "text/css");
      return;
    }

    if (req.method === "GET" && url.pathname === "/css/review-invitations.css") {
      serveStatic(
        res,
        path.join(__dirname, "views", "styles", "review-invitations.css"),
        "text/css"
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/dom.js") {
      serveStatic(res, path.join(__dirname, "views", "scripts", "dom.js"), "application/javascript");
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/review-invitations.js") {
      serveStatic(
        res,
        path.join(__dirname, "views", "scripts", "review-invitations.js"),
        "application/javascript"
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/http_client.js") {
      serveStatic(res, path.join(__dirname, "services", "http_client.js"), "application/javascript");
      return;
    }

    if (req.method === "GET" && url.pathname === "/js/schedule_view.js") {
      serveStatic(res, path.join(__dirname, "views", "schedule_view.js"), "application/javascript");
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      serveStatic(res, path.join(__dirname, "views", "index.html"), "text/html");
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
