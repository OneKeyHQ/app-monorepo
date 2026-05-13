import {
  calculateSpotHoldingPnl,
  formatSpotHoldingPnlText,
  isSpotHoldingStableCoin,
} from './utils';

describe('calculateSpotHoldingPnl', () => {
  it('preserves sub-cent pnl precision for small spot holdings', () => {
    const result = calculateSpotHoldingPnl({
      total: '514.452756',
      entryNtl: '0.05144527',
      midPrice: '0.0000903',
      isStable: false,
    });

    expect(result.pnl).toBe('-0.0049901861332');
    expect(result.pnlPercent).toBeCloseTo(-9.699_990_170_524_91, 12);
  });

  it('formats sub-cent non-zero pnl like Hyperliquid', () => {
    expect(formatSpotHoldingPnlText('-0.002796', -0.632)).toBe(
      '-$0.00 (-0.6%)',
    );
    expect(formatSpotHoldingPnlText('-0.008434', -2.31)).toBe('-$0.01 (-2.3%)');
  });

  it('treats USDH as stable and suppresses its spot holdings pnl', () => {
    expect(isSpotHoldingStableCoin('USDH')).toBe(true);
    expect(
      calculateSpotHoldingPnl({
        total: '0.00405586',
        entryNtl: '0.0040556572',
        midPrice: '1',
        isStable: isSpotHoldingStableCoin('USDH'),
      }),
    ).toEqual({});
  });
});
