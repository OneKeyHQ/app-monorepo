const {
  SCENARIOS,
  TARGETS,
  parseScenarios,
  parseTarget,
} = require('./run-web-resize-perf');

describe('run-web-resize-perf configuration', () => {
  const originalTarget = process.env.PERF_WEB_RESIZE_TARGET;
  const originalScenarios = process.env.PERF_WEB_RESIZE_SCENARIOS;

  afterEach(() => {
    if (originalTarget === undefined) {
      delete process.env.PERF_WEB_RESIZE_TARGET;
    } else {
      process.env.PERF_WEB_RESIZE_TARGET = originalTarget;
    }
    if (originalScenarios === undefined) {
      delete process.env.PERF_WEB_RESIZE_SCENARIOS;
    } else {
      process.env.PERF_WEB_RESIZE_SCENARIOS = originalScenarios;
    }
  });

  test('uses the Market list as the default resize target', () => {
    delete process.env.PERF_WEB_RESIZE_TARGET;

    expect(parseTarget()).toEqual(TARGETS['market-list']);
    expect(parseScenarios(TARGETS['market-list'].defaultScenarioNames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'market-control-lg' }),
        expect.objectContaining({ name: 'market-cross-lg' }),
      ]),
    );
  });

  test('defines column-count assertions for both Market breakpoints', () => {
    const byName = new Map(
      SCENARIOS.map((scenario) => [scenario.name, scenario]),
    );

    expect(
      byName.get('market-cross-lg').expectedVisibleMarketColumnCounts,
    ).toEqual([8, 9]);
    expect(
      byName.get('market-cross-xl').expectedVisibleMarketColumnCounts,
    ).toEqual([9, 11]);
  });

  test('keeps the previous Home target available explicitly', () => {
    process.env.PERF_WEB_RESIZE_TARGET = 'home';
    delete process.env.PERF_WEB_RESIZE_SCENARIOS;

    const target = parseTarget();
    expect(target).toEqual(TARGETS.home);
    expect(
      parseScenarios(target.defaultScenarioNames).map(({ name }) => name),
    ).toEqual(['control-gt-md', 'cross-md']);
  });
});
