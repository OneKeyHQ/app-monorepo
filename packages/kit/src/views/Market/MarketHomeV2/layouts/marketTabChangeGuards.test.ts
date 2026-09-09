import { shouldIgnoreProgrammaticSettlingTab } from './marketTabChangeGuards';

describe('shouldIgnoreProgrammaticSettlingTab', () => {
  const createParams = () => ({
    expectedTabName: undefined,
    incomingTabName: 'Favorites',
    lastProgrammaticAcceptedTabName: 'Perps',
    programmaticAcceptedElapsedMs: 80,
    programmaticSettleGuardMs: 500,
    isRecentPagerDrag: false,
    wasDraggedAfterExpectedTab: false,
  });

  it('ignores a delayed stale callback after a programmatic tab settles', () => {
    expect(shouldIgnoreProgrammaticSettlingTab(createParams())).toBe(true);
  });

  it.each([
    ['a recent user drag', { isRecentPagerDrag: true }],
    ['a drag after the expected target', { wasDraggedAfterExpectedTab: true }],
    [
      'the programmatic marker was cleared by drag start',
      { lastProgrammaticAcceptedTabName: undefined },
    ],
    ['a new expected target exists', { expectedTabName: 'Favorites' }],
    ['the incoming tab is the accepted tab', { incomingTabName: 'Perps' }],
    ['the settle guard elapsed', { programmaticAcceptedElapsedMs: 500 }],
  ])('allows the callback when %s', (_reason, overrides) => {
    expect(
      shouldIgnoreProgrammaticSettlingTab({
        ...createParams(),
        ...overrides,
      }),
    ).toBe(false);
  });
});
