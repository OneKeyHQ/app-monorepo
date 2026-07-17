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

function uniqueStrings(values) {
  return [
    ...new Set(values.filter((value) => typeof value === 'string' && value)),
  ];
}

function resolveSourceGuardPolicies({
  startupGraph,
  defaultInitialForbiddenSources = [],
}) {
  const initialOnlyForbiddenSources = Array.isArray(
    startupGraph?.forbiddenSources,
  )
    ? startupGraph.forbiddenSources
    : defaultInitialForbiddenSources;
  const requestedScriptForbiddenSources = uniqueStrings(
    Array.isArray(startupGraph?.requestedScriptForbiddenSources)
      ? startupGraph.requestedScriptForbiddenSources
      : [],
  );

  // Sources forbidden at runtime must also stay out of the initial entry graph.
  return {
    initialForbiddenSources: uniqueStrings([
      ...initialOnlyForbiddenSources,
      ...requestedScriptForbiddenSources,
    ]),
    requestedScriptForbiddenSources,
  };
}

module.exports = {
  normalizeBudgetConfig,
  resolveSourceGuardPolicies,
};
