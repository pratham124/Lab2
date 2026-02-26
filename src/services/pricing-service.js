const {
  mapRegistrationPrices,
  formatDisplayAmount,
} = require("../models/registration-price");

const UNAVAILABLE_MESSAGE = "Pricing is not available.";
const RETRIEVAL_ERROR_MESSAGE = "Unable to retrieve pricing. Please try again shortly.";

function createPricingService({ loadPricingData, dataAccess, logger, formatOptions } = {}) {
  async function load() {
    if (typeof loadPricingData === "function") {
      return loadPricingData();
    }

    if (dataAccess && typeof dataAccess.listRegistrationPrices === "function") {
      return dataAccess.listRegistrationPrices();
    }

    return [];
  }

  async function getCurrentPricing() {
    try {
      const raw = await Promise.resolve(load());
      const mapped = mapRegistrationPrices(raw);
      const active = mapped.filter((entry) => entry.active);
      const hasActiveWithAmount = active.some((entry) => typeof entry.amount === "number");

      if (active.length === 0 || !hasActiveWithAmount) {
        return {
          status: "unavailable",
          message: UNAVAILABLE_MESSAGE,
          categories: [],
        };
      }

      return {
        status: "ok",
        categories: active.map((entry) => ({
          name: entry.name,
          active: true,
          amount: entry.amount,
          display_amount: formatDisplayAmount(entry.amount, formatOptions),
        })),
      };
    } catch (error) {
      if (logger && typeof logger.error === "function") {
        logger.error("pricing_retrieval_failed", error);
      }

      return {
        status: "error",
        message: RETRIEVAL_ERROR_MESSAGE,
      };
    }
  }

  return {
    getCurrentPricing,
  };
}

module.exports = {
  createPricingService,
  UNAVAILABLE_MESSAGE,
  RETRIEVAL_ERROR_MESSAGE,
};
