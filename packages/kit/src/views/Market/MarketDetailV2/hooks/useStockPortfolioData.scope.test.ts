/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { useStockPortfolioData } from './useStockPortfolioData';

type IHookResult = Awaited<
  ReturnType<typeof import('./useStockPortfolioData').fetchStockPortfolioData>
> & { accountScopeKey: string; requestScopeKey: string };

let mockActiveAccount: {
  account?: { id: string };
  indexedAccount?: { id: string };
  deriveType?: string;
  ready: boolean;
};
let mockStockDetail: {
  portfolioNetworkId?: string;
  stockId?: string;
  tokenVariants: IMarketStockTokenVariant[];
  isTokenVariantPending: boolean;
  isTokenVariantsError: boolean;
};
let mockResult: IHookResult | undefined;
let mockCapturedMethod: (() => Promise<IHookResult | undefined>) | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<IHookResult | undefined>) => {
    mockCapturedMethod = method;
    return { result: mockResult, isLoading: false, run: jest.fn() };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [undefined],
}));
jest.mock('./StockDetailContext', () => ({
  useStockDetail: () => mockStockDetail,
}));

const variant: IMarketStockTokenVariant = {
  tokenId: 'aapl-ondo-ethereum',
  issuer: 'Ondo',
  symbol: 'AAPLon',
  networkId: 'evm--1',
  contractAddress: '0xAAPL',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};

async function runCapturedRequest() {
  let next: IHookResult | undefined;
  await act(async () => {
    next = await mockCapturedMethod?.();
  });
  return next;
}

describe('useStockPortfolioData scope', () => {
  beforeEach(() => {
    mockActiveAccount = { indexedAccount: { id: 'wallet-a' }, ready: true };
    mockStockDetail = {
      stockId: 'AAPL',
      tokenVariants: [variant],
      isTokenVariantPending: false,
      isTokenVariantsError: false,
    };
    mockResult = undefined;
    mockCapturedMethod = undefined;
  });

  it('does not settle on a run made before the variants loaded', async () => {
    mockStockDetail = {
      ...mockStockDetail,
      tokenVariants: [],
      isTokenVariantPending: true,
    };
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    mockResult = await runCapturedRequest();
    rerender();
    expect(result.current.isPortfolioSettled).toBe(false);

    mockStockDetail = {
      ...mockStockDetail,
      tokenVariants: [variant],
      isTokenVariantPending: false,
    };
    rerender();
    // The held result was asked about no variants at all.
    expect(result.current.isPortfolioSettled).toBe(false);

    mockResult = await runCapturedRequest();
    rerender();
    expect(result.current.isPortfolioSettled).toBe(true);
  });

  it('settles when the variant lookup fails with nothing cached, so the page does not wait on it', () => {
    mockStockDetail = {
      ...mockStockDetail,
      tokenVariants: [],
      isTokenVariantsError: true,
    };
    const { result } = renderHook(() => useStockPortfolioData());

    expect(result.current.isPortfolioSettled).toBe(true);
  });

  it('still waits for the holdings of cached variants when a variant refresh fails', async () => {
    mockStockDetail = { ...mockStockDetail, isTokenVariantsError: true };
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    expect(result.current.isPortfolioSettled).toBe(false);

    mockResult = await runCapturedRequest();
    rerender();
    expect(result.current.isPortfolioSettled).toBe(true);
  });

  it('hides holdings from the previous account until the new one is back', async () => {
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    const accountAResult = await runCapturedRequest();
    mockResult = accountAResult && {
      ...accountAResult,
      items: [
        {
          accountAddress: '0xa',
          tokenAddress: '0xAAPL',
          symbol: 'AAPLon',
          amount: '1',
          tokenPrice: '100',
          totalPrice: '100',
          networkId: 'evm--1',
          tokenId: 'aapl-ondo-ethereum',
          issuer: 'Ondo',
        },
      ],
    };
    rerender();
    expect(result.current.portfolioData).toHaveLength(1);
    expect(result.current.isPortfolioSettled).toBe(true);

    mockActiveAccount = { indexedAccount: { id: 'wallet-b' }, ready: true };
    rerender();
    expect(result.current.portfolioData).toEqual([]);
    expect(result.current.isPortfolioSettled).toBe(false);
    expect(result.current.accountScopeKey).not.toBe(
      accountAResult?.accountScopeKey,
    );
  });
});
