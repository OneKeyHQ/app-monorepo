/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapStockPortfolioData } from './useSwapStockPortfolioData';

let mockStockId = 'AAPL';
let mockCurrency = 'usd';
let mockVariants: IMarketStockTokenVariant[] = [];

jest.mock('../../../components/Currency', () => ({
  useCurrency: () => ({ id: mockCurrency }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [
    {
      currencyMap: {
        usd: { value: '1' },
        eur: { value: '0.5' },
      },
    },
  ],
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({
    useStockDetail: () => ({
      stockId: mockStockId,
      tokenVariants: mockVariants,
    }),
  }),
);

type IPositions = NonNullable<Parameters<typeof useSwapStockPortfolioData>[0]>;
const pnl = {
  isPnlSupported: true,
  totalPnlUsd: '12',
  totalPnlPercent: '6',
  unrealizedPnlUsd: '8',
  unrealizedPnlPercent: '4',
};
const apple = {
  networkId: 'evm--1',
  contractAddress: '0xAABB',
  accountAddress: 'account-a',
  symbol: 'AAPLon',
  decimals: 18,
  balanceParsed: '2',
  fiatValue: '200',
  price: '100',
  currency: 'usd',
  stock: { stockId: 'AAPL', subtitle: '', sourceLogoUri: '' },
} satisfies ISwapToken;
const variant: IMarketStockTokenVariant = {
  tokenId: 'apple-ethereum',
  issuer: 'Ondo',
  networkId: apple.networkId,
  contractAddress: '0xaabb',
  symbol: apple.symbol,
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};
function buildPositions(overrides: Partial<IPositions> = {}): IPositions {
  return {
    hasAccount: true,
    positionTokenList: [apple],
    positionLoading: false,
    resolvedNetworkIds: ['evm--1'],
    pnlMap: new Map([[`${apple.networkId}-${apple.contractAddress}`, pnl]]),
    ...overrides,
  };
}

beforeEach(() => {
  mockStockId = 'AAPL';
  mockCurrency = 'usd';
  mockVariants = [variant];
});

it('projects the same balance and complete PnL, including positions beyond the first six', () => {
  const others = Array.from({ length: 6 }, (_, i) => ({
    ...apple,
    contractAddress: `other-${i}`,
    stock: { ...apple.stock, stockId: 'MSFT' },
  }));
  const positions = buildPositions({ positionTokenList: [...others, apple] });
  const { result } = renderHook(() => useSwapStockPortfolioData(positions));
  expect(result.current.positionListData).toHaveLength(1);
  expect(result.current.positionListData[0]).toMatchObject({
    amount: apple.balanceParsed,
    totalPrice: apple.fiatValue,
    currency: apple.currency,
    tokenId: variant.tokenId,
    issuer: variant.issuer,
  });
  expect(result.current.positionListData[0].pnl).toBe(
    positions.pnlMap.get('evm--1-0xAABB'),
  );
});

it('publishes changed holdings immediately while PnL is still pending, then shares its result', () => {
  const initial = buildPositions({ pnlMap: new Map() });
  const { result, rerender } = renderHook(
    ({ positions }) => useSwapStockPortfolioData(positions),
    { initialProps: { positions: initial } },
  );
  rerender({
    positions: {
      ...initial,
      positionTokenList: [{ ...apple, balanceParsed: '3' }],
    },
  });
  expect(result.current.positionListData[0].amount).toBe('3');
  expect(result.current.positionListData[0].pnl).toBeUndefined();
  rerender({
    positions: buildPositions({
      positionTokenList: [{ ...apple, balanceParsed: '3' }],
    }),
  });
  expect(result.current.positionListData[0].pnl).toBe(pnl);
  rerender({ positions: buildPositions({ positionTokenList: [] }) });
  expect(result.current.positionListData).toEqual([]);
});

it('switches stocks by filtering the shared list without retaining the old company', () => {
  const other: ISwapToken = {
    ...apple,
    symbol: 'MSFTon',
    contractAddress: '0xCCDD',
    stock: { ...apple.stock, stockId: 'MSFT' },
  };
  const positions = buildPositions({ positionTokenList: [apple, other] });
  const { result, rerender } = renderHook(() =>
    useSwapStockPortfolioData(positions),
  );
  mockStockId = 'MSFT';
  mockVariants = [];
  rerender();
  expect(result.current.positionListData.map((item) => item.symbol)).toEqual([
    'MSFTon',
  ]);
});

it('projects two holdings directly to one preview holding before the trade identity commits', () => {
  const google: ISwapToken = {
    ...apple,
    symbol: 'GOOGLon',
    contractAddress: '0xCCDD',
    stock: { ...apple.stock, stockId: 'GOOGL' },
  };
  const positions = buildPositions({
    positionTokenList: [
      apple,
      { ...apple, symbol: 'AAPLB', contractAddress: '0xEEFF' },
      google,
    ],
  });
  const initialScope: { stockId?: string } = { stockId: 'AAPL' };
  const { result, rerender } = renderHook(
    ({ stockId }: { stockId?: string }) =>
      useSwapStockPortfolioData(positions, {
        stockId,
        tokenVariants: stockId === mockStockId ? mockVariants : [],
      }),
    { initialProps: initialScope },
  );
  expect(result.current.positionListData.map((item) => item.symbol)).toEqual([
    'AAPLon',
    'AAPLB',
  ]);
  // The old variants are still in StockDetailContext during token resolution.
  rerender({ stockId: 'GOOGL' });
  expect(mockStockId).toBe('AAPL');
  expect(result.current.positionListData.map((item) => item.symbol)).toEqual([
    'GOOGLon',
  ]);
  expect(result.current.resolvedVariantKeys).toEqual([]);
  rerender({ stockId: 'MSFT' });
  expect(result.current.positionListData).toEqual([]);
  rerender({ stockId: 'AAPL' });
  expect(result.current.positionListData).toHaveLength(2);
  rerender({ stockId: undefined });
  expect(result.current.positionListData).toEqual([]);
});

it('classifies legacy holdings using only the display company variants', () => {
  const legacyApple = { ...apple, stock: undefined };
  const legacyGoogle = {
    ...legacyApple,
    symbol: 'GOOGLB',
    contractAddress: '0xCCDD',
  };
  const googleVariants = [
    { ...variant, contractAddress: legacyGoogle.contractAddress },
  ];
  const positions = buildPositions({
    positionTokenList: [legacyApple, legacyGoogle],
  });
  const { result } = renderHook(() =>
    useSwapStockPortfolioData(positions, {
      stockId: 'GOOGL',
      tokenVariants: googleVariants,
    }),
  );
  expect(result.current.positionListData.map((item) => item.symbol)).toEqual([
    'GOOGLB',
  ]);
  expect(result.current.positionListData[0].tokenId).toBe(variant.tokenId);
});

it('accepts an exact variant or underlying ticker when stock metadata omits its stock ID', () => {
  const withoutId = { ...apple, stock: undefined };
  const ticker = {
    ...apple,
    contractAddress: 'another-issuer',
    stock: { subtitle: '', sourceLogoUri: '', underlyingAssetTicker: ' aapl ' },
  };
  const positions = buildPositions({ positionTokenList: [withoutId, ticker] });
  const { result } = renderHook(() => useSwapStockPortfolioData(positions));
  expect(result.current.positionListData).toHaveLength(2);
});

it('keeps dust in selector balances and applies the same USD floor to a non-USD position', () => {
  mockCurrency = 'eur';
  const positions = buildPositions({
    positionTokenList: [
      { ...apple, fiatValue: '0.006', currency: 'eur' },
      {
        ...apple,
        contractAddress: 'dust',
        fiatValue: '0.004',
        currency: 'eur',
      },
    ],
  });
  const { result } = renderHook(() => useSwapStockPortfolioData(positions));
  expect(result.current.portfolioData).toHaveLength(2);
  expect(result.current.positionListData).toHaveLength(1);
  expect(result.current.positionListData[0]).toMatchObject({
    totalPrice: '0.006',
    currency: 'eur',
  });
});

it('only establishes zero balances on networks that actually completed a holdings lookup', () => {
  mockVariants = [
    variant,
    { ...variant, tokenId: 'apple-bsc', networkId: 'evm--56' },
  ];
  const positions = buildPositions({ positionTokenList: [] });
  const { result, rerender } = renderHook(
    ({ shared }) => useSwapStockPortfolioData(shared),
    { initialProps: { shared: positions } },
  );
  expect(result.current.resolvedVariantKeys).toEqual(['evm--1:0xaabb']);
  rerender({
    shared: { ...positions, hasAccount: false, positionTokenList: [apple] },
  });
  expect(result.current.resolvedVariantKeys).toEqual([]);
  expect(result.current.portfolioData).toEqual([]);
});
