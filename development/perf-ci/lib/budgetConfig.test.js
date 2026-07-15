const { normalizeBudgetConfig } = require('./budgetConfig');

describe('normalizeBudgetConfig', () => {
  const defaults = { scriptCount: 10, resourceCount: 20 };

  it('preserves startup graph guards in structured budget files', () => {
    const startupGraph = {
      forbiddenSources: ['packages/kit/src/views/Onboardingv2/pages/'],
      moduleCount: 100,
    };

    expect(
      normalizeBudgetConfig(
        {
          defaults: { scriptCount: 8 },
          startupGraph,
          scenarios: { root: { resourceCount: 15 } },
        },
        defaults,
      ),
    ).toEqual({
      defaults: { scriptCount: 8, resourceCount: 20 },
      startupGraph,
      scenarios: { root: { resourceCount: 15 } },
    });
  });

  it('keeps legacy flat budget files compatible', () => {
    expect(normalizeBudgetConfig({ scriptCount: 8 }, defaults)).toEqual({
      defaults: { scriptCount: 8, resourceCount: 20 },
      scenarios: {},
    });
  });
});
