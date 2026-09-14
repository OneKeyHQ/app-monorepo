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

  it('case 5: per-stock halt wins over every closed/open combination (OK-58655)', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        isPaused: true,
        hasOpenTime: true,
        hasPerps: true,
      }),
    ).toBe(EStockMarketStatusCase.Halted);
    // A halt is about the stock, not the market schedule — it applies even
    // while the market itself is open.
    expect(
      resolveStockMarketStatusCase({
        isOpen: true,
        isPaused: true,
        hasOpenTime: false,
        hasPerps: false,
      }),
    ).toBe(EStockMarketStatusCase.Halted);
  });

  it('only an explicit isPaused === true yields Halted', () => {
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        isPaused: undefined,
        hasOpenTime: true,
        hasPerps: true,
      }),
    ).toBe(EStockMarketStatusCase.ClosedKnownTimeWithPerps);
    expect(
      resolveStockMarketStatusCase({
        isOpen: false,
        isPaused: false,
        hasOpenTime: false,
        hasPerps: false,
      }),
    ).toBe(EStockMarketStatusCase.ClosedUnknownTimeNoPerps);
  });
});
