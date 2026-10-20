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
let mockSelectedDeriveType:
  | { networkId: string; deriveType: string }
  | undefined;
let mockResult: IHookResult | undefined;
let mockCapturedMethod: (() => Promise<IHookResult | undefined>) | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
let mockNetworkDefaultDeriveType = 'default';

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<IHookResult | undefined>,
    deps: unknown[],
  ) => {
    // The network-default lookup depends on [pickedDeriveType, networkId].
    if (deps.length === 2) {
      const [pickedDeriveType, networkId] = deps as [
        string | undefined,
        string | undefined,
      ];
      return {
        result:
          pickedDeriveType && networkId
            ? {
                networkId,
                networkDefaultDeriveType: mockNetworkDefaultDeriveType,
              }
            : undefined,
        isLoading: false,
        run: jest.fn(),
      };
    }
    mockCapturedMethod = method;
    return { result: mockResult, isLoading: false, run: jest.fn() };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [mockSelectedDeriveType],
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
    mockSelectedDeriveType = undefined;
    mockNetworkDefaultDeriveType = 'default';
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

  it('keeps rows and the tab scope when switching the selected variant chain', async () => {
    mockStockDetail = { ...mockStockDetail, portfolioNetworkId: 'evm--1' };
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    const firstResult = await runCapturedRequest();
    mockResult = firstResult && {
      ...firstResult,
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
    const scopeKey = result.current.accountScopeKey;

    mockStockDetail = { ...mockStockDetail, portfolioNetworkId: 'evm--56' };
    rerender();

    expect(result.current.accountScopeKey).toBe(scopeKey);
    expect(result.current.portfolioData).toHaveLength(1);
  });

  it('hides rows when a variant switch changes the address a chain is queried with', async () => {
    mockSelectedDeriveType = { networkId: 'evm--1', deriveType: 'ledgerLive' };
    mockStockDetail = { ...mockStockDetail, portfolioNetworkId: 'evm--1' };
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    const firstResult = await runCapturedRequest();
    mockResult = firstResult && {
      ...firstResult,
      items: [
        {
          accountAddress: '0xledger',
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

    // evm--1 falls back to its default address once another chain is picked.
    mockStockDetail = { ...mockStockDetail, portfolioNetworkId: 'evm--56' };
    rerender();

    expect(result.current.portfolioData).toEqual([]);
  });

  async function renderWithHeldRow() {
    const view = renderHook(() => useStockPortfolioData());
    const firstResult = await runCapturedRequest();
    mockResult = firstResult && {
      ...firstResult,
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
    view.rerender();
    return view;
  }

  it('keeps rows when a picked address type matches the network default', async () => {
    // Picking ledgerLive and back leaves an explicit default selection.
    mockSelectedDeriveType = { networkId: 'evm--1', deriveType: 'default' };
    mockStockDetail = { ...mockStockDetail, portfolioNetworkId: 'evm--1' };
    const { result, rerender } = await renderWithHeldRow();
    const scopeKey = result.current.accountScopeKey;

    mockStockDetail = { ...mockStockDetail, portfolioNetworkId: 'evm--56' };
    rerender();

    expect(result.current.accountScopeKey).toBe(scopeKey);
    expect(result.current.portfolioData).toHaveLength(1);
  });

  it('ignores fields the request does not use', async () => {
    mockActiveAccount = {
      indexedAccount: { id: 'wallet-a' },
      account: { id: 'evm-account' },
      deriveType: 'default',
      ready: true,
    };
    const { result, rerender } = await renderWithHeldRow();
    const scopeKey = result.current.accountScopeKey;

    // Switching the home network changes the network account and its active
    // derivation, but holdings are queried through the wallet.
    mockActiveAccount = {
      ...mockActiveAccount,
      account: { id: 'sol-account' },
      deriveType: 'ledgerLive',
    };
    rerender();

    expect(result.current.accountScopeKey).toBe(scopeKey);
    expect(result.current.portfolioData).toHaveLength(1);
  });
});
