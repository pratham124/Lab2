function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return Math.floor(n);
}

function paginate(items, { page = 1, pageSize = 20 } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePage = toPositiveInt(page, 1);
  const safePageSize = toPositiveInt(pageSize, 20);
  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    items: safeItems.slice(start, end),
    page: currentPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
  };
}

module.exports = {
  paginate,
};
