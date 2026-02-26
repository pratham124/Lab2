function createPerfMetrics() {
  const samples = [];

  function start() {
    return Date.now();
  }

  function stop(startedAt) {
    const durationMs = Math.max(0, Date.now() - Number(startedAt || 0));
    samples.push(durationMs);
    return durationMs;
  }

  function getP95() {
    if (samples.length === 0) {
      return 0;
    }
    const sorted = samples.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  return {
    start,
    stop,
    getP95,
    samples,
  };
}

module.exports = {
  createPerfMetrics,
};
