/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { useSwapProTokenInit } from './useSwapPro';

let mockSwapType: ESwapTabSwitchType = ESwapTabSwitchType.BRIDGE;
const mockFetchDetail = jest
  .fn<Promise<unknown[]>, unknown[]>()
  .mockResolvedValue([]);
const mockToken = {
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'TOKEN',
  decimals: 18,
  isNative: false,
};
const mockSet = jest.fn();
const mockActions = {
  initializeSwapProSelectToken: jest.fn(),
  resetQuoteAction: jest.fn(),
  beginSwapProTokenBalanceRequest: jest.fn(() => 1),
  finishSwapProTokenBalanceRequest: jest.fn(),
  invalidateSwapProTokenBalanceRequest: jest.fn(),
  isSwapProTokenBalanceRequestLatest: jest.fn(() => true),
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      isNative: false,
    },
  };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (...args: unknown[]) => mockFetchDetail(...args),
    },
  },
}));

jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({ current: mockActions }),
  useSwapProSelectTokenAtom: () => [mockToken, mockSet],
  useSwapProTokenSupportLimitAtom: () => [true],
  useSwapProTradeTypeAtom: () => ['market', mockSet],
  useSwapProDirectionAtom: () => ['SELL', mockSet],
  useSwapProSellToTokenAtom: () => [undefined, mockSet],
  useSwapProUseSelectBuyTokenAtom: () => [undefined, mockSet],
  useSwapProInputAmountAtom: () => ['', mockSet],
  useSwapFromTokenAmountAtom: () => [{ value: '', isInput: true }, mockSet],
  useSwapTypeSwitchAtom: () => [mockSwapType, mockSet],
  useSwapProTokenBalanceLoadingAtom: () => [false],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => ({
  useSwapProJumpTokenAtom: () => [{ token: mockToken }, mockSet],
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorStorageInitDoneAtom: () => [true],
  useActiveAccount: () => ({ activeAccount: { ready: false } }),
  useSelectedAccount: () => ({
    selectedAccount: {
      networkId: 'evm--1',
      othersWalletAccountId: 'account-1',
    },
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: { updateSelectedAccountNetwork: mockSet },
  }),
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _method: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) =>
    options?.initResult
      ? {
          result: {
            requestScope: 'evm--1||account-1|default',
            scope: 'evm--1||account-1|default',
            account: {
              id: 'account-1',
              addressDetail: { address: '0xaccount' },
            },
          },
        }
      : { result: undefined },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('../../Market/hooks', () => ({ useMarketBasicConfig: jest.fn() }));
jest.mock(
  '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket',
  () => ({ useTransactionsWebSocket: jest.fn() }),
);
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit',
  () => ({
    useSpeedSwapInit: () => ({ defaultTokens: [], defaultLimitTokens: [] }),
  }),
);
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType',
  () => ({ ESwapDirection: { BUY: 'BUY', SELL: 'SELL' } }),
);

describe('Swap Pro token synchronization ownership', () => {
  beforeEach(() => {
    mockFetchDetail.mockClear();
    Object.assign(platformEnv, { isNative: false });
    mockSwapType = ESwapTabSwitchType.BRIDGE;
  });

  it('does not fetch Pro token details on Desktop regular or limit pages', () => {
    const { rerender } = renderHook(() => useSwapProTokenInit());
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });

  it('starts synchronization when native enters Pro and stops it after leaving', async () => {
    Object.assign(platformEnv, { isNative: true });
    const { rerender } = renderHook(() => useSwapProTokenInit());
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    await waitFor(() => expect(mockFetchDetail).toHaveBeenCalledTimes(1));
    expect(mockFetchDetail).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 'evm--1', accountId: 'account-1' }),
    );
    mockFetchDetail.mockClear();
    mockSwapType = ESwapTabSwitchType.BRIDGE;
    rerender();
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.STOCK;
    rerender();
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    await waitFor(() => expect(mockFetchDetail).toHaveBeenCalledTimes(1));
  });
});
