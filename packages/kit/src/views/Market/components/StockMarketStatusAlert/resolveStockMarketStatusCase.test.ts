import {
  EStockMarketStatusCase,
  resolveStockMarketStatusCase,
} from './resolveStockMarketStatusCase';

describe('resolveStockMarketStatusCase', () => {
  it('returns Open when the market is open', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: true,
        hasOpenTime: true,
        hasPerps: true,
      }),
    ).toBe(EStockMarketStatusCase.Open);
  });

  it('treats unknown isOpen (undefined / unavailable) as not a closed case', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: undefined,
        hasOpenTime: false,
        hasPerps: true,
      }),
    ).toBe(EStockMarketStatusCase.Open);
  });

  it('case 1: closed + known time + has Perps', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        hasOpenTime: true,
        hasPerps: true,
      }),
    ).toBe(EStockMarketStatusCase.ClosedKnownTimeWithPerps);
  });

  it('case 2: closed + known time + no Perps', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        hasOpenTime: true,
        hasPerps: false,
      }),
    ).toBe(EStockMarketStatusCase.ClosedKnownTimeNoPerps);
  });

  it('case 3: closed + unknown time + no Perps', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        hasOpenTime: false,
        hasPerps: false,
      }),
    ).toBe(EStockMarketStatusCase.ClosedUnknownTimeNoPerps);
  });

  it('case 4: closed + unknown time + has Perps', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        hasOpenTime: false,
        hasPerps: true,
      }),
    ).toBe(EStockMarketStatusCase.ClosedUnknownTimeWithPerps);
  });
});
