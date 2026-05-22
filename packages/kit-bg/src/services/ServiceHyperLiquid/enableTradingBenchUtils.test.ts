import { getPerpsEnableTradingRealCanTrade } from './enableTradingBenchUtils';

describe('getPerpsEnableTradingRealCanTrade', () => {
  it('returns true when all real enable trading gates are satisfied even if canTrade is forced false elsewhere', () => {
    expect(
      getPerpsEnableTradingRealCanTrade({
        accountAddress: '0x123',
        details: {
          activatedOk: true,
          agentOk: true,
          abstractionOk: true,
          builderFeeOk: true,
          internalRebateBoundOk: true,
          referralCodeOk: true,
        },
      }),
    ).toBe(true);
  });

  it('returns false when any real enable trading gate is not satisfied', () => {
    expect(
      getPerpsEnableTradingRealCanTrade({
        accountAddress: '0x123',
        details: {
          activatedOk: true,
          agentOk: false,
          abstractionOk: true,
          builderFeeOk: true,
          internalRebateBoundOk: true,
          referralCodeOk: true,
        },
      }),
    ).toBe(false);
  });
});
