const fs = require("fs");
const path = require("path");
const { json } = require("./controller_utils");
const { UNAVAILABLE_MESSAGE, RETRIEVAL_ERROR_MESSAGE } = require("../services/pricing-service");

function loadPageTemplate() {
  const templatePath = path.join(__dirname, "..", "views", "registration-prices.html");
  return fs.readFileSync(templatePath, "utf8");
}

function createRegistrationPricesController({ pricingService } = {}) {
  if (!pricingService || typeof pricingService.getCurrentPricing !== "function") {
    throw new Error("pricingService with getCurrentPricing is required");
  }

  const template = loadPageTemplate();

  async function handleGetPage() {
    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: template,
    };
  }

  async function handleGetApi() {
    const pricing = await pricingService.getCurrentPricing();

    if (pricing.status === "error") {
      return json(503, {
        message: pricing.message || RETRIEVAL_ERROR_MESSAGE,
      });
    }

    if (pricing.status === "unavailable") {
      return json(200, {
        status: "unavailable",
        message: pricing.message || UNAVAILABLE_MESSAGE,
        categories: [],
      });
    }

    return json(200, {
      status: "ok",
      categories: Array.isArray(pricing.categories) ? pricing.categories : [],
    });
  }

  return {
    handleGetPage,
    handleGetApi,
  };
}

module.exports = {
  createRegistrationPricesController,
};
