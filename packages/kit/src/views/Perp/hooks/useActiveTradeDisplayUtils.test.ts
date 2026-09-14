import { buildActiveTradeDisplay } from './useActiveTradeDisplayUtils';

describe('buildActiveTradeDisplay', () => {
  it('does not reuse the previous perp asset id while an optimistic coin is pending', () => {
    const display = buildActiveTradeDisplay({
      tradeInstrument: {
        mode: 'perp',
        coin: 'SOL',
        assetId: undefined,
        universe: undefined,
      },
      perpsAsset: {
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
        margin: undefined,
      },
    });

    expect(display.coin).toBe('SOL');
    expect(display.assetId).toBeUndefined();
  });

  it('exposes the HIP-3 DEX label without changing the display name', () => {
    const display = buildActiveTradeDisplay({
      tradeInstrument: {
        mode: 'perp',
        coin: 'xyz:UNITREE',
        assetId: 110_000,
        universe: undefined,
      },
      perpsAsset: {
        coin: 'xyz:UNITREE',
        assetId: 110_000,
        universe: undefined,
        margin: undefined,
      },
    });

    expect(display.displayName).toBe('UNITREE');
    expect(display.dexLabel).toBe('xyz');
  });
});
