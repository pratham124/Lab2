const NOT_AVAILABLE_LABEL = "Not available";

function toFiniteAmount(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function toActive(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() !== "false";
  }
  return true;
}

function mapRegistrationPrice(input = {}, index = 0) {
  const name = String(input.name || input.category_name || "").trim();
  return {
    name,
    amount: toFiniteAmount(input.amount),
    active: toActive(input.active),
    order: Number.isInteger(input.order) ? input.order : index,
  };
}

function mapRegistrationPrices(input = []) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry, index) => mapRegistrationPrice(entry, index))
    .filter((entry) => Boolean(entry.name))
    .sort((a, b) => a.order - b.order);
}

function formatDisplayAmount(amount, { locale = "en-US", currency = "USD" } = {}) {
  if (amount === null || typeof amount === "undefined") {
    return NOT_AVAILABLE_LABEL;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch (_error) {
    return String(amount);
  }
}

module.exports = {
  NOT_AVAILABLE_LABEL,
  mapRegistrationPrice,
  mapRegistrationPrices,
  formatDisplayAmount,
};
