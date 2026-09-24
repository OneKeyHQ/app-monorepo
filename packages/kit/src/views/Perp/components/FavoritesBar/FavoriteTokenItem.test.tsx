/** @jest-environment jsdom */

import { createContext } from 'react';
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { FavoriteTokenItem } from './FavoriteTokenItem';

const mockMarketContext = createContext<{
  coin: string;
  activeCtx?: {
    coin: string;
    ctx: { markPrice: string; change24hPercent: number };
  };
}>({ coin: '@1' });
const mockSpotPrices = {
  '@1': { markPx: '128.97', prevDayPx: '100' },
  '@2': { markPx: '120.02', prevDayPx: '100' },
};

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  NumberSizeableText: ({ children }: { children?: ReactNode }) => (
    <span data-testid="change">{children}</span>
  ),
  Skeleton: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return [{ mode: 'spot', coin: useContext(mockMarketContext).coin }];
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  usePerpsCtxByCoin: () => undefined,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetAtom: () => [undefined],
  usePerpsActiveAssetCtxAtom: () => [undefined],
  useSpotAssetCtxsMapAtom: () => [mockSpotPrices],
  useSpotActiveAssetCtxAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return [useContext(mockMarketContext).activeCtx];
  },
}));

const previousCtx = {
  coin: '@1',
  ctx: { markPrice: '128.97', change24hPercent: 28.97 },
};
const currentCtx = {
  coin: '@2',
  ctx: { markPrice: '119.67', change24hPercent: 19.67 },
};
const previousState = { coin: '@1', activeCtx: previousCtx };
const item = (
  <FavoriteTokenItem
    displayName="TREAD/USDC"
    coinName="@2"
    imageTokenName="TREAD"
    assetId={2}
    dexIndex={0}
    mode="spot"
    displayMode="percent"
    onPress={jest.fn()}
  />
);

describe('spot favorite percentage during instrument changes', () => {
  it('keeps its own cached percentage until matching active data arrives', () => {
    const { getByTestId, rerender } = render(
      <mockMarketContext.Provider value={previousState}>
        {item}
      </mockMarketContext.Provider>,
    );
    const percentage = () => Number(getByTestId('change').textContent);
    expect(percentage()).toBeCloseTo(20.02);

    const transitions = [
      // UI selection changes before the background active context catches up.
      { value: { coin: '@2', activeCtx: previousCtx }, expected: 20.02 },
      { value: { coin: '@2' }, expected: 20.02 },
      { value: { coin: '@2', activeCtx: currentCtx }, expected: 19.67 },
      { value: previousState, expected: 20.02 },
    ];
    for (const { value, expected } of transitions) {
      rerender(
        <mockMarketContext.Provider value={value}>
          {item}
        </mockMarketContext.Provider>,
      );
      expect(percentage()).toBeCloseTo(expected);
    }
  });
});
