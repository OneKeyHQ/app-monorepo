function normalizeBudgetConfig(raw, defaultBudgets) {
  if (raw?.defaults || raw?.scenarios || raw?.startupGraph) {
    return {
      ...raw,
      defaults: {
        ...defaultBudgets,
        ...raw.defaults,
      },
      scenarios: raw.scenarios || {},
    };
  }

  return {
    defaults: {
      ...defaultBudgets,
      ...raw,
    },
    scenarios: {},
  };
}

module.exports = {
  normalizeBudgetConfig,
};
