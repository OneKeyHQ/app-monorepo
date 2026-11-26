/** @jest-environment jsdom */

import { createElement } from 'react';
import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextSwap,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectTokenNetworkAtom,
  swapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapTestIDs } from '../testIDs';
import { getSwapBalanceActionProps } from '../utils/swapBalanceActionUtils';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from './swapStockChannelUtils';
import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapStockAmountInputState } from './useSwapStockTradeInputs';

import type { IUseSwapStockChannelReturn } from './useSwapStockChannel';
import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

const sourceNetwork = 'evm--1';
const stockNetwork = 'evm--56';
const selectorNetwork = 'evm--42161';
const payToken = {
  contractAddress: '0xusdc',
  decimals: 6,
  networkId: stockNetwork,
  speedSwapDefaultAmount: [],
  symbol: 'USDC',
};
const stockToken: ISwapToken = {
  contractAddress: '0xstock',
  decimals: 18,
  isStock: true,
  networkId: stockNetwork,
  symbol: 'AAPLon',
};
const mockGetNetworkAccount = jest.fn<
  Promise<INetworkAccount>,
  [{ accountId?: string; dbAccount?: { id: string }; networkId: string }]
>();
const mockFetchSwapTokenDetails = jest.fn<Promise<ISwapToken[]>, []>();
const mockAccountSelectors: Record<number, IAccountSelectorActiveAccountInfo> =
  {};

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: null }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getNetworkAccount: (
        params: Parameters<typeof mockGetNetworkAccount>[0],
      ) => mockGetNetworkAccount(params),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: () => Promise.resolve('default'),
    },
    serviceSwap: {
      fetchSwapTokenDetails: () => mockFetchSwapTokenDetails(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: ({ num }: { num: number }) => ({
    activeAccount: mockAccountSelectors[num],
  }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: jest.fn(),
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () =>
  jest.requireActual<
    typeof import('@onekeyhq/kit/src/states/jotai/contexts/swap/atoms')
  >('@onekeyhq/kit/src/states/jotai/contexts/swap/atoms'),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useSettingsAtom: () => [{ swapToAnotherAccountSwitchOn: false }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
}));
jest.mock('./useSwapStockChannel', () => {
  const {
    ESwapStockChannelAsyncStatus: asyncStatus,
    ESwapStockChannelStage: stage,
    ESwapStockTradeSide: tradeSide,
  } = jest.requireActual<typeof import('./swapStockChannelUtils')>(
    './swapStockChannelUtils',
  );
  return {
    ESwapStockChannelAsyncStatus: asyncStatus,
    ESwapStockChannelStage: stage,
    ESwapStockTradeSide: tradeSide,
  };
});
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType',
  () => ({
    ESwapDirection: { BUY: 'buy', SELL: 'sell' },
  }),
);
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const stockChannel: IUseSwapStockChannelReturn = {
  stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
  marketStatusStatus: ESwapStockChannelAsyncStatus.Ready,
  payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
  channelStage: ESwapStockChannelStage.Ready,
  readyForQuote: true,
  tradeSide: ESwapStockTradeSide.Buy,
  stockNetworkId: stockNetwork,
  stockMarketStatus: undefined,
  stockPerpsInfo: undefined,
  activeStockTokenDetail: undefined,
  displayStockTokenDetail: undefined,
  realtimeChartPoint: undefined,
  currentStockToken: stockToken,
  isStockTokenChanging: false,
  hasCurrentLocaleStockMetadata: false,
  payToken,
  fromToken: payToken,
  toToken: stockToken,
  payTokens: [payToken],
  selectablePayTokens: [payToken],
  defaultStockTokenLoading: false,
  payTokenOptionsLoading: false,
  speedConfigReady: true,
  disableNativePayToken: false,
  selectStockSwapToken: jest.fn(),
  selectStockToken: jest.fn(),
  selectPayToken: jest.fn(),
  switchTradeSide: jest.fn(),
  selectRecentTokenPair: jest.fn(),
  syncStockTokenDetail: jest.fn(),
};

function createAccount(id: string, networkId: string, address: string) {
  const account: INetworkAccount = {
    id,
    name: id,
    type: undefined,
    path: '',
    coinType: '60',
    impl: 'evm',
    pub: '',
    address,
    addressDetail: {
      isValid: true,
      networkId,
      address,
      baseAddress: address,
      normalizedAddress: address,
      displayAddress: address,
      allowEmptyAddress: false,
    },
  };
  return account;
}

function createActiveAccount(account: INetworkAccount) {
  const activeAccount: IAccountSelectorActiveAccountInfo = {
    ready: true,
    account,
    indexedAccount: undefined,
    dbAccount: account,
    accountName: account.name,
    wallet: undefined,
    device: undefined,
    network: {
      id: account.addressDetail.networkId,
    } as IAccountSelectorActiveAccountInfo['network'],
    vaultSettings: undefined,
    deriveType: 'default',
    deriveInfoItems: [],
  };
  return activeAccount;
}

function renderStockPay() {
  const store = createStore();
  store.set(swapSelectFromTokenAtom(), payToken);
  store.set(swapSelectToTokenAtom(), stockToken);
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
  store.set(swapSelectTokenNetworkAtom(), {
    networkId: selectorNetwork,
    name: 'Arbitrum',
    symbol: 'ETH',
  });
  return renderHook(
    () => {
      const quote = useSwapAddressInfo(ESwapDirectionType.FROM);
      const review = useSwapAddressInfo(ESwapDirectionType.FROM);
      const selector = useSwapAddressInfo(ESwapDirectionType.FROM, {
        networkScope: 'selector',
      });
      const balance = useSwapStockAmountInputState({
        stockChannel,
        fromAddressInfo: quote,
      });
      const action = getSwapBalanceActionProps({
        isLoadedZero: balance.isBalanceLoadedZero,
        isUnavailable: balance.balanceRetryAvailable,
        refreshing: balance.balanceRefreshing,
        onRefresh: balance.onBalanceRefreshPress,
        onMax: balance.balanceActionsReady
          ? balance.onBalanceMaxPress
          : undefined,
      });
      return { action, balance, quote, review, selector };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(ProviderJotaiContextSwap, { store }, children),
    },
  );
}

async function expectFailedAccountLookup(
  result: ReturnType<typeof renderStockPay>['result'],
) {
  await waitFor(() => {
    expect(result.current.action.testID).toBe(SwapTestIDs.balanceRefreshButton);
    expect(result.current.action.actionLoading).toBe(false);
    expect(result.current.balance.displayBalance).toBe('--');
    expect(result.current.quote.address).toBeUndefined();
    expect(result.current.review.address).toBeUndefined();
  });
}

describe('Stocks pay balance recovery', () => {
  let recoveredAccount: INetworkAccount;
  beforeEach(() => {
    const sourceAccount = createAccount(
      'hd-test--0',
      sourceNetwork,
      '0x0000000000000000000000000000000000000001',
    );
    recoveredAccount = createAccount(
      'hd-test--0',
      stockNetwork,
      sourceAccount.address,
    );
    mockAccountSelectors[0] = createActiveAccount(sourceAccount);
    mockGetNetworkAccount
      .mockReset()
      .mockRejectedValue(new Error('Network account unavailable'));
    mockFetchSwapTokenDetails.mockReset();
  });

  it('recovers the payer for both quote and Review after the balance row retries', async () => {
    const { result } = renderStockPay();
    await expectFailedAccountLookup(result);
    const selectorLookups = mockGetNetworkAccount.mock.calls.filter(
      ([{ networkId }]) => networkId === selectorNetwork,
    ).length;

    mockGetNetworkAccount.mockResolvedValue(recoveredAccount);
    mockFetchSwapTokenDetails.mockResolvedValue([
      { ...payToken, balanceParsed: '12.5' },
    ]);
    act(() => result.current.action.onPress?.());

    await waitFor(() => {
      expect(result.current.balance.displayBalance).toBe('12.5');
      expect(result.current.quote.address).toBe(recoveredAccount.address);
      expect(result.current.review.address).toBe(recoveredAccount.address);
      expect(result.current.action.testID).toBe(SwapTestIDs.maxButton);
    });
    expect(result.current.selector.address).toBeUndefined();
    expect(
      mockGetNetworkAccount.mock.calls.filter(
        ([{ networkId }]) => networkId === selectorNetwork,
      ),
    ).toHaveLength(selectorLookups);
  });

  it('keeps the recovered payer when the original lookup fails after the retry', async () => {
    const firstSenderLookup = Promise.withResolvers<INetworkAccount>();
    const getSender = jest
      .fn<Promise<INetworkAccount>, []>()
      .mockReturnValueOnce(firstSenderLookup.promise)
      .mockResolvedValue(recoveredAccount);
    const getBalanceAccount = jest
      .fn<Promise<INetworkAccount>, []>()
      .mockRejectedValueOnce(new Error('Balance account unavailable'))
      .mockResolvedValue(recoveredAccount);
    mockGetNetworkAccount.mockImplementation(({ dbAccount, networkId }) => {
      if (networkId !== stockNetwork) {
        return Promise.reject(new Error('Unrelated account unavailable'));
      }
      return dbAccount ? getSender() : getBalanceAccount();
    });
    const { result } = renderStockPay();
    await expectFailedAccountLookup(result);
    expect(result.current.quote.isRecipientValidationReady).toBe(false);
    expect(getSender).toHaveBeenCalledTimes(1);

    mockFetchSwapTokenDetails.mockResolvedValue([
      { ...payToken, balanceParsed: '12.5' },
    ]);
    act(() => result.current.action.onPress?.());
    await waitFor(() => {
      expect(result.current.quote.address).toBe(recoveredAccount.address);
      expect(result.current.review.address).toBe(recoveredAccount.address);
      expect(result.current.balance.displayBalance).toBe('12.5');
    });
    expect(getSender).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstSenderLookup.reject(new Error('Original sender lookup timed out'));
      await firstSenderLookup.promise.catch(() => undefined);
    });
    expect(result.current.quote.address).toBe(recoveredAccount.address);
    expect(result.current.review.address).toBe(recoveredAccount.address);
    expect(result.current.action.testID).toBe(SwapTestIDs.maxButton);
  });

  it('keeps retry available after the account returns but balance details are unavailable', async () => {
    const { result } = renderStockPay();
    await expectFailedAccountLookup(result);

    mockGetNetworkAccount.mockResolvedValue(recoveredAccount);
    mockFetchSwapTokenDetails.mockResolvedValue([]);
    act(() => result.current.action.onPress?.());

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1);
      expect(result.current.balance.balanceRefreshing).toBe(false);
      expect(result.current.balance.displayBalance).toBe('--');
      expect(result.current.action.testID).toBe(
        SwapTestIDs.balanceRefreshButton,
      );
    });
    expect(result.current.balance.balanceActionsReady).toBe(false);

    const secondDetails = Promise.withResolvers<ISwapToken[]>();
    mockFetchSwapTokenDetails.mockReturnValue(secondDetails.promise);
    act(() => result.current.action.onPress?.());
    await waitFor(() => {
      expect(result.current.action.testID).toBe(
        SwapTestIDs.balanceRefreshButton,
      );
      expect(result.current.action.actionLoading).toBe(true);
      expect(result.current.balance.balanceActionsReady).toBe(false);
    });
    await act(async () => {
      secondDetails.resolve([{ ...payToken, balanceParsed: '12.5' }]);
      await secondDetails.promise;
    });
    await waitFor(() => {
      expect(result.current.balance.displayBalance).toBe('12.5');
      expect(result.current.action.testID).toBe(SwapTestIDs.maxButton);
    });
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2);
  });
});
