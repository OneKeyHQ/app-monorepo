/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useVisibleSpotHoldingsCount } from './useVisibleSpotHoldingsCount';

let mockHideSmallSpotHoldings = false;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => [
    { hideSmallSpotHoldings: mockHideSmallSpotHoldings },
  ],
  useSpotAssetCtxsMapAtom: () => [
    { 'HYPE/USDC': { markPx: '40' }, 'BTC/USDC': { markPx: '60000' } },
  ],
}));

jest.mock('./useSpotMetaMaps', () => ({
  useSpotMetaMaps: () => ({
    spotUniverses: [
      { name: 'HYPE/USDC', baseName: 'HYPE', quoteName: 'USDC' },
      { name: 'BTC/USDC', baseName: 'BTC', quoteName: 'USDC' },
    ],
  }),
}));

describe('useVisibleSpotHoldingsCount', () => {
  it('counts all held tokens when low-value holdings are hidden, merging USDC once', () => {
    const balances = [
      { coin: 'USDC', total: '0.5', entryNtl: '0.5' },
      { coin: 'HYPE', total: '0.01', entryNtl: '0.4' },
      { coin: 'BTC', total: '0.0001', entryNtl: '6' },
      { coin: 'PURR', total: '0', entryNtl: '0' },
    ];
    mockHideSmallSpotHoldings = false;
    const { result, rerender } = renderHook(() =>
      useVisibleSpotHoldingsCount({ balances, hasPerpsUsdc: true }),
    );
    expect(result.current).toBe(3);

    mockHideSmallSpotHoldings = true;
    rerender();
    expect(result.current).toBe(3);

    mockHideSmallSpotHoldings = false;
    rerender();
    expect(result.current).toBe(3);
  });
});
