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
const mockPerpContext = createContext<{
  activeCoin?: string;
  marketPrice?: string;
  activeCtx?: {
    coin: string;
    ctx: { markPrice: string; change24hPercent: number };
  };
}>({});
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
  usePerpsCtxByCoin: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return {
      markPx: useContext(mockPerpContext).marketPrice ?? '3120',
      prevDayPx: '3000',
    };
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    const { activeCoin } = useContext(mockPerpContext);
    return [activeCoin ? { coin: activeCoin } : undefined];
  },
  usePerpsActiveAssetCtxAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return [useContext(mockPerpContext).activeCtx];
  },
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
  it('keeps its own market percentage through active context changes', () => {
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
      { value: { coin: '@2', activeCtx: currentCtx }, expected: 20.02 },
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

const stalePerpState = {
  activeCoin: 'ETH',
  activeCtx: {
    coin: 'BTC',
    ctx: { markPrice: '65000', change24hPercent: -3.5 },
  },
};
const currentPerpState = {
  activeCoin: 'ETH',
  activeCtx: {
    coin: 'ETH',
    ctx: { markPrice: '3150', change24hPercent: 5 },
  },
};
const perpItem = (
  <FavoriteTokenItem
    displayName="ETH"
    coinName="ETH"
    imageTokenName="ETH"
    assetId={1}
    dexIndex={0}
    mode="perp"
    displayMode="percent"
    onPress={jest.fn()}
  />
);

describe('perp favorite price during asset changes', () => {
  it('ignores the previous coin context after the active asset is seeded', () => {
    // Background seeds the new active asset before clearing the old context.
    const { getByTestId, rerender } = render(
      <mockPerpContext.Provider value={stalePerpState}>
        {perpItem}
      </mockPerpContext.Provider>,
    );
    const percentage = () => Number(getByTestId('change').textContent);
    expect(percentage()).toBeCloseTo(4);

    rerender(
      <mockPerpContext.Provider value={currentPerpState}>
        {perpItem}
      </mockPerpContext.Provider>,
    );
    expect(percentage()).toBeCloseTo(4);
  });
});

const activeCtx = {
  coin: 'kBONK',
  ctx: { markPrice: '0.003459', change24hPercent: -8 },
};
const initialValue = {
  activeCoin: 'XRP',
  marketPrice: '0.00346',
  activeCtx,
};
const updatedValue = {
  activeCoin: 'kBONK',
  marketPrice: '0.003461',
  activeCtx,
};
const perpSelectionValues = ['kBONK', 'XRP', 'kBONK', 'XRP'].map(
  (activeCoin) => ({ ...initialValue, activeCoin }),
);
const spotSelectionValues = ['@2', '@1', '@2', '@1'].map((coin) => ({
  coin,
  activeCtx: currentCtx,
}));

describe('favorite quotes stay independent of selection', () => {
  it('keeps the same kBONK quote through repeated switches and follows market updates', () => {
    const favorite = (
      <FavoriteTokenItem
        displayName="kBONK"
        coinName="kBONK"
        imageTokenName="kBONK"
        assetId={1}
        dexIndex={0}
        mode="perp"
        onPress={jest.fn()}
      />
    );
    const { getByText, rerender } = render(
      <mockPerpContext.Provider value={initialValue}>
        {favorite}
      </mockPerpContext.Provider>,
    );
    for (const value of perpSelectionValues) {
      rerender(
        <mockPerpContext.Provider value={value}>
          {favorite}
        </mockPerpContext.Provider>,
      );
      expect(getByText('0.00346')).toBeTruthy();
    }
    rerender(
      <mockPerpContext.Provider value={updatedValue}>
        {favorite}
      </mockPerpContext.Provider>,
    );
    expect(getByText('0.003461')).toBeTruthy();
  });

  it('keeps the spot quote when selecting and leaving a coin with different active data', () => {
    const favorite = (
      <FavoriteTokenItem
        displayName="TREAD/USDC"
        coinName="@2"
        imageTokenName="TREAD"
        assetId={2}
        dexIndex={0}
        mode="spot"
        onPress={jest.fn()}
      />
    );
    const { getByText, rerender } = render(
      <mockMarketContext.Provider value={previousState}>
        {favorite}
      </mockMarketContext.Provider>,
    );
    for (const value of spotSelectionValues) {
      rerender(
        <mockMarketContext.Provider value={value}>
          {favorite}
        </mockMarketContext.Provider>,
      );
      expect(getByText('120.02')).toBeTruthy();
    }
  });
});
