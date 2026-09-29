import {
  accumulateDeFiRunOverview,
  getEmptyDeFiRunOverview,
  shouldPublishDeFiRunOverview,
} from './deFiRunOverview';

const ethResponse = {
  totalValue: 120.5,
  totalDebt: 20,
  totalReward: 0.5,
  netWorth: 100.5,
  chains: ['evm--1'],
  protocolCount: 2,
  positionCount: 3,
};

describe('accumulateDeFiRunOverview', () => {
  it('sums values and counts and unions the chains', () => {
    const afterEth = accumulateDeFiRunOverview(
      getEmptyDeFiRunOverview(),
      ethResponse,
    );
    const afterSui = accumulateDeFiRunOverview(afterEth, {
      totalValue: 0.1,
      totalDebt: 0,
      totalReward: 0.2,
      netWorth: 0.1,
      chains: ['sui--mainnet', 'evm--1'],
      protocolCount: 1,
      positionCount: 1,
    });

    expect(afterSui).toEqual({
      totalValue: 120.6,
      totalDebt: 20,
      totalReward: 0.7,
      netWorth: 100.6,
      chains: ['evm--1', 'sui--mainnet'],
      protocolCount: 3,
      positionCount: 4,
    });
  });

  it('does not add the base the atom held before the run', () => {
    // Only the responses of this run are summed; the previous overview
    // (which may still count a network disabled since) is not an input.
    expect(
      accumulateDeFiRunOverview(getEmptyDeFiRunOverview(), ethResponse),
    ).toEqual(ethResponse);
  });
});

describe('shouldPublishDeFiRunOverview', () => {
  it('keeps the leading empty flush off the overview atom', () => {
    // The first throttled flush after a cold start is usually one network's
    // empty response; replacing the header total with its 0 would drop the
    // whole DeFi position until the next flush.
    expect(shouldPublishDeFiRunOverview(getEmptyDeFiRunOverview())).toBe(false);
    expect(
      shouldPublishDeFiRunOverview(
        accumulateDeFiRunOverview(getEmptyDeFiRunOverview(), {
          ...getEmptyDeFiRunOverview(),
          chains: ['evm--1'],
        }),
      ),
    ).toBe(false);
  });

  it('publishes once a position has been merged', () => {
    expect(
      shouldPublishDeFiRunOverview(
        accumulateDeFiRunOverview(getEmptyDeFiRunOverview(), ethResponse),
      ),
    ).toBe(true);
  });

  it('publishes worth whose protocols were filtered out of the list', () => {
    expect(
      shouldPublishDeFiRunOverview({
        ...getEmptyDeFiRunOverview(),
        totalValue: 3.2,
        netWorth: 3.2,
      }),
    ).toBe(true);
    expect(
      shouldPublishDeFiRunOverview({
        ...getEmptyDeFiRunOverview(),
        totalDebt: 1,
      }),
    ).toBe(true);
    expect(
      shouldPublishDeFiRunOverview({
        ...getEmptyDeFiRunOverview(),
        totalReward: 0.01,
      }),
    ).toBe(true);
  });
});
