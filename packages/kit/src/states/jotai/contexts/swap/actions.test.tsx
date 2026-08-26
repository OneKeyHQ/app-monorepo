/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import {
  SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
  SWAP_PRO_POSITIONS_CACHE_VERSION,
} from '@onekeyhq/kit/src/views/Swap/utils/swapProPositionsCacheUtils';
import { swapProTokenCarryUtils } from '@onekeyhq/kit/src/views/Swap/utils/swapProTokenCarryUtils';
import { getSwapStableTokenKey } from '@onekeyhq/kit/src/views/Swap/utils/swapStableCoinUtils';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import {
  WALLET_NO_IMPORTED,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  swapQuoteIntervalMaxCount,
  swapRefreshInterval,
  swapStockTokenListMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  IFetchQuotesParams,
  ISwapNetwork,
  ISwapQuoteEvent,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapAlertLevel,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapActions } from './actions';
import {
  ProviderJotaiContextSwap,
  swapActiveSelectedFromTokenBalanceAtom,
  swapAlertsAtom,
  swapAllNetworkActionLockAtom,
  swapAllNetworkTokenListMapAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapInputAmountDraftsAtom,
  swapLastNonLimitSelectedTokensAtom,
  swapNetworks,
  swapProDirectionAtom,
  swapProInputAmountAtom,
  swapProPositionsCacheAtom,
  swapProPositionsCurrentOwnerKeyAtom,
  swapProPositionsDataOwnerKeyAtom,
  swapProSelectTokenAtom,
  swapProSupportNetworksTokenListAtom,
  swapProTokenBalanceLoadingAtom,
  swapProUseSelectBuyTokenAtom,
  swapProUserSelectedTokenAtom,
  swapQuoteActionLockAtom,
  swapQuoteAutoRefreshTimerAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteFetchingAtom,
  swapQuoteIntervalCountAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapShouldRefreshQuoteAtom,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedFromTokenBalanceAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
  swapUserSelectedTokensAtom,
  useSwapBalanceDisplayCacheAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapStockSelectedTokenAtom,
} from './atoms';

type IFetchSwapTokenDetailsParams = {
  networkId: string;
  accountAddress?: string;
  accountId?: string;
  contractAddress: string;
  currency?: string;
  direction?: ESwapDirectionType;
};
type ISwapAddressInfo = ReturnType<typeof useSwapAddressInfo>;

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (
    params: IFetchSwapTokenDetailsParams,
  ) => Promise<{ balanceParsed?: string; price?: string; fiatValue?: string }[]>
> = jest.fn();
const mockFetchQuotesEvents: jest.MockedFunction<
  (params: unknown) => Promise<void>
> = jest.fn();
const mockCloseApproving: jest.MockedFunction<() => Promise<void>> = jest.fn();
const mockCancelFetchQuoteEvents: jest.MockedFunction<
  (quoteRequestId?: string) => Promise<void>
> = jest.fn();
const mockCheckAccountNetworkNotSupported: jest.MockedFunction<
  (params: {
    walletId?: string;
    accountId?: string;
    activeNetworkId: string;
  }) => Promise<boolean>
> = jest.fn();
const mockSetSwapNetworksSortRawData: jest.MockedFunction<
  (params: { data: unknown[] }) => Promise<void>
> = jest.fn();
const mockSetSwapProSelectToken: jest.MockedFunction<
  (token: ISwapToken) => Promise<void>
> = jest.fn();
const mockGetSupportSwapAllAccounts: jest.MockedFunction<
  (params: unknown) => Promise<{
    supportAccountsFetchFailed: boolean;
    swapSupportAccounts: {
      apiAddress: string;
      networkId: string;
      accountId: string;
    }[];
  }>
> = jest.fn();
const mockFetchSwapTokens: jest.MockedFunction<
  (params: unknown) => Promise<ISwapToken[]>
> = jest.fn();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokens: (params: unknown) => mockFetchSwapTokens(params),
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
      fetchQuotesEvents: (params: unknown) => mockFetchQuotesEvents(params),
      getSupportSwapAllAccounts: (params: unknown) =>
        mockGetSupportSwapAllAccounts(params),
      closeApproving: () => mockCloseApproving(),
      cancelFetchQuoteEvents: (quoteRequestId?: string) =>
        mockCancelFetchQuoteEvents(quoteRequestId),
    },
    simpleDb: {
      swapProSelectToken: {
        setSwapProSelectToken: (token: ISwapToken) =>
          mockSetSwapProSelectToken(token),
      },
      swapNetworksSort: {
        setRawData: (params: { data: unknown[] }) =>
          mockSetSwapNetworksSortRawData(params),
      },
    },
    serviceAccount: {
      checkAccountNetworkNotSupported: (params: {
        walletId?: string;
        accountId?: string;
        activeNetworkId: string;
      }) => mockCheckAccountNetworkNotSupported(params),
    },
  },
}));

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const bnbToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '',
  symbol: 'BNB',
  decimals: 18,
  isNative: true,
};
const ltcToken: ISwapToken = {
  networkId: 'ltc--0',
  contractAddress: '',
  symbol: 'LTC',
  decimals: 8,
  isNative: true,
};
const trxToken: ISwapToken = {
  networkId: 'tron--0x2b6653dc',
  contractAddress: '',
  symbol: 'TRX',
  decimals: 6,
  isNative: true,
};
const btcToken: ISwapToken = {
  networkId: 'btc--0',
  contractAddress: '',
  symbol: 'BTC',
  decimals: 8,
  isNative: true,
};
const bnbProToken: IToken = {
  ...bnbToken,
  speedSwapDefaultAmount: [0.01, 0.1, 1],
};
const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};
const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
  isNative: false,
};
const uniToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xuni',
  symbol: 'UNI',
  decimals: 18,
  isNative: false,
};
const stockTokenA: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock-a',
  symbol: 'STOCKA',
  decimals: 18,
  isNative: false,
  isStock: true,
};
const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isNative: false,
  isStock: true,
};

const buildStableTokenKeys = (...tokens: ISwapToken[]) =>
  new Set(tokens.map(getSwapStableTokenKey).filter(Boolean));
const carryTargetTokenOptions = {
  carryTargetToken: true,
  tokenCarryUtils: swapProTokenCarryUtils,
};

const buildProSupportedNetworkIds = (...tokens: ISwapToken[]) =>
  new Set(tokens.map((token) => token.networkId));
const evmSwapNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
};
const ltcSwapNetwork: ISwapNetwork = {
  networkId: 'ltc--0',
  name: 'Litecoin',
  symbol: 'LTC',
};
const trxSwapNetwork: ISwapNetwork = {
  networkId: trxToken.networkId,
  name: 'Tron',
  symbol: 'TRX',
};
const btcSwapNetwork: ISwapNetwork = {
  networkId: btcToken.networkId,
  name: 'Bitcoin',
  symbol: 'BTC',
};
const evmAccount: INetworkAccount = {
  id: 'hd-1--m/44/60/0/0/0',
  name: 'Account 1',
  type: undefined,
  path: "m/44'/60'/0'/0/0",
  coinType: '60',
  impl: 'evm',
  pub: '',
  address: '0xabc',
  addressDetail: {
    isValid: true,
    networkId: 'evm--1',
    address: '0xabc',
    baseAddress: '0xabc',
    normalizedAddress: '0xabc',
    displayAddress: '0xabc',
    allowEmptyAddress: false,
  },
};
const activeAccountInfo: IAccountSelectorActiveAccountInfo = {
  ready: true,
  account: evmAccount,
  indexedAccount: undefined,
  dbAccount: undefined,
  accountName: 'Account 1',
  wallet: undefined,
  device: undefined,
  network: undefined,
  vaultSettings: undefined,
  deriveType: undefined,
  deriveInfoItems: [],
};
const externalWallet: IDBWallet = {
  id: WALLET_TYPE_EXTERNAL,
  name: 'External',
  type: WALLET_TYPE_EXTERNAL,
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 0,
};
const fromAddressInfo: ISwapAddressInfo = {
  address: '0xabc',
  networkId: 'evm--1',
  accountInfo: activeAccountInfo,
  activeAccount: activeAccountInfo,
  isAddressInfoReady: true,
};

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    reject: (reason?: unknown) => reject?.(reason),
    resolve: (value: T) => resolve?.(value),
  };
}

function createExternalAddressInfo({
  address,
  isAddressInfoReady,
}: Pick<ISwapAddressInfo, 'address' | 'isAddressInfoReady'>): ISwapAddressInfo {
  return {
    ...fromAddressInfo,
    address,
    networkId: usdtToken.networkId,
    accountInfo: {
      ...activeAccountInfo,
      wallet: externalWallet,
    },
    activeAccount: {
      ...activeAccountInfo,
      wallet: externalWallet,
    },
    isAddressInfoReady,
  };
}

function buildRecipientUnsupportedQuote({
  fromToken,
  toToken,
}: {
  fromToken: ISwapToken;
  toToken: ISwapToken;
}) {
  return {
    quoteId: 'recipient-unsupported-quote',
    fromAmount: '1',
    toAmount: '1',
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    protocol: EProtocolOfExchange.SWAP,
    kind: ESwapQuoteKind.SELL,
    unSupportReceiveAddressDifferent: true,
    info: {
      provider: 'recipient-unsupported-provider',
      providerName: 'Recipient Unsupported Provider',
    },
  } as IFetchQuoteResult;
}

function createWrapperWithStore(
  setup?: (store: ReturnType<typeof createStore>) => void,
) {
  const store = createStore();
  store.set(swapSelectFromTokenAtom(), ethToken);
  store.set(swapNetworks(), [
    {
      networkId: 'evm--1',
      name: 'Ethereum',
      symbol: 'ETH',
      logoURI: '',
      shortcode: 'eth',
      supportSingleSwap: true,
      supportCrossChainSwap: true,
      supportLimit: true,
    },
    {
      networkId: 'evm--56',
      name: 'BNB Smart Chain',
      symbol: 'BNB',
      logoURI: '',
      shortcode: 'bsc',
      supportSingleSwap: true,
      supportCrossChainSwap: true,
      supportStock: true,
    },
  ]);
  setup?.(store);

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  }

  return { store, Wrapper };
}

async function withMutedConsoleError(fn: () => Promise<void>) {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  try {
    await fn();
  } finally {
    consoleErrorSpy.mockRestore();
  }
}

function createWrapper(
  setup?: (store: ReturnType<typeof createStore>) => void,
) {
  return createWrapperWithStore(setup).Wrapper;
}

describe('useSwapActions', () => {
  beforeEach(() => {
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    jest.clearAllMocks();
    mockSetSwapProSelectToken.mockResolvedValue(undefined);
    mockSetSwapNetworksSortRawData.mockResolvedValue(undefined);
    mockCloseApproving.mockResolvedValue(undefined);
    mockCancelFetchQuoteEvents.mockResolvedValue(undefined);
    mockCheckAccountNetworkNotSupported.mockResolvedValue(false);
    mockFetchQuotesEvents.mockResolvedValue(undefined);
    mockFetchSwapTokens.mockResolvedValue([]);
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [],
    });
    jest.spyOn(settingsAtom, 'get').mockResolvedValue({
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapSlippagePercentageCustomValue: 0,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  afterEach(() => {
    platformEnv.isNative = false;
  });

  it('quotes Swap Pro market orders through the standard Swap event endpoint', async () => {
    const { store, Wrapper } = createWrapperWithStore((currentStore) => {
      currentStore.set(swapProSelectTokenAtom(), usdcToken);
      currentStore.set(swapProUseSelectBuyTokenAtom(), bnbProToken);
      currentStore.set(swapProDirectionAtom(), ESwapDirection.BUY);
      currentStore.set(swapProInputAmountAtom(), '1');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteSpeedAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        'account-1',
        '0xabc',
      );
    });

    await waitFor(() => {
      expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          protocol: ESwapTabSwitchType.SWAP,
          fromTokenAmount: '1',
          fromToken: bnbProToken,
          toToken: usdcToken,
        }),
      );
    });
    expect(store.get(swapQuoteActionLockAtom())).toMatchObject({
      type: ESwapTabSwitchType.SWAP,
      fromToken: bnbProToken,
      toToken: usdcToken,
      fromTokenAmount: '1',
    });
  });

  it('uses the complete Stock list limit for child-network balance requests', async () => {
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [
        {
          apiAddress: '0xabc',
          networkId: 'evm--56',
          accountId: 'account-bsc',
        },
      ],
    });
    mockFetchSwapTokens.mockResolvedValue([stockTokenA]);
    const { Wrapper } = createWrapperWithStore((store) => {
      store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapLoadAllNetworkTokenList(
        undefined,
        'account-1',
        false,
        'usd',
      );
    });

    expect(mockFetchSwapTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accountAddress: '0xabc',
        accountId: 'account-bsc',
        accountNetworkId: 'evm--56',
        limit: swapStockTokenListMaxCount,
        networkId: 'evm--56',
        protocol: ESwapTabSwitchType.STOCK,
      }),
    );
  });

  it('queues the latest Stock network generation without duplicating the active generation', async () => {
    const firstAccountsRequest = createDeferred<{
      supportAccountsFetchFailed: boolean;
      swapSupportAccounts: {
        apiAddress: string;
        networkId: string;
        accountId: string;
      }[];
    }>();
    mockGetSupportSwapAllAccounts
      .mockImplementationOnce(() => firstAccountsRequest.promise)
      .mockResolvedValueOnce({
        supportAccountsFetchFailed: false,
        swapSupportAccounts: [
          {
            apiAddress: '0xaaa',
            networkId: 'evm--1',
            accountId: 'account-eth',
          },
          {
            apiAddress: '0xbbb',
            networkId: 'evm--56',
            accountId: 'account-bsc',
          },
        ],
      });
    mockFetchSwapTokens.mockImplementation(async (params) => {
      const { networkId } = params as { networkId: string };
      return networkId === 'evm--1'
        ? [{ ...stockTokenA, networkId }]
        : [appleStockToken];
    });
    const networkA: ISwapNetwork = {
      networkId: 'evm--1',
      name: 'Ethereum',
      symbol: 'ETH',
      supportStock: true,
    };
    const networkB: ISwapNetwork = {
      networkId: 'evm--56',
      name: 'BNB Smart Chain',
      symbol: 'BNB',
      supportStock: true,
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapNetworks(), [networkA]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    let activeRequest: Promise<void> | undefined;
    act(() => {
      activeRequest = result.current.swapLoadAllNetworkTokenList(
        undefined,
        'account-1',
        false,
        'usd',
      );
    });
    await waitFor(() =>
      expect(mockGetSupportSwapAllAccounts).toHaveBeenCalledTimes(1),
    );

    let duplicateRequestSettled = false;
    let duplicateRequest: Promise<void> | undefined;
    act(() => {
      duplicateRequest = result.current
        .swapLoadAllNetworkTokenList(undefined, 'account-1', false, 'usd')
        .then(() => {
          duplicateRequestSettled = true;
        });
    });
    await Promise.resolve();
    expect(duplicateRequestSettled).toBe(false);
    expect(mockGetSupportSwapAllAccounts).toHaveBeenCalledTimes(1);

    act(() => {
      store.set(swapNetworks(), [networkA, networkB]);
    });
    let queuedRequestSettled = false;
    let queuedRequest: Promise<void> | undefined;
    act(() => {
      queuedRequest = result.current
        .swapLoadAllNetworkTokenList(undefined, 'account-1', false, 'usd')
        .then(() => {
          queuedRequestSettled = true;
        });
    });
    await Promise.resolve();
    expect(queuedRequestSettled).toBe(false);
    expect(mockGetSupportSwapAllAccounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstAccountsRequest.resolve({
        supportAccountsFetchFailed: false,
        swapSupportAccounts: [
          {
            apiAddress: '0xaaa',
            networkId: 'evm--1',
            accountId: 'account-eth',
          },
        ],
      });
      await Promise.all([activeRequest, duplicateRequest, queuedRequest]);
    });

    expect(duplicateRequestSettled).toBe(true);
    expect(queuedRequestSettled).toBe(true);
    expect(mockGetSupportSwapAllAccounts).toHaveBeenCalledTimes(2);
    expect(
      mockFetchSwapTokens.mock.calls.filter(
        ([params]) => (params as { networkId: string }).networkId === 'evm--56',
      ),
    ).toHaveLength(1);
    expect(
      Object.values(store.get(swapAllNetworkTokenListMapAtom()))
        .flat()
        .map((token) => token.networkId),
    ).toEqual(expect.arrayContaining(['evm--1', 'evm--56']));
    expect(store.get(swapAllNetworkActionLockAtom())).toEqual({});
  });

  it('pins selected token detail price fetches to USD for rate-difference math', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([
      {
        balanceParsed: '1.23',
        price: '3000',
        fiatValue: '3690',
      },
    ]);

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balanceDisplayCache] = useSwapBalanceDisplayCacheAtom();
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();

        return {
          actions,
          balanceDisplayCache,
          fromToken,
          balance,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountAddress: '0xabc',
      accountId: 'hd-1--m/44/60/0/0/0',
      contractAddress: '',
      direction: ESwapDirectionType.FROM,
      currency: 'usd',
    });
    expect(result.current.fromToken?.price).toBe('3000');
    expect(result.current.fromToken?.currency).toBe('usd');
    expect(result.current.balance).toBe('1.23');
    expect(result.current.balanceDisplayCache.entries[0]).toMatchObject({
      accountAddress: '0xabc',
      balance: '1.23',
      contractAddress: '',
      isNative: true,
      networkId: 'evm--1',
    });
  });

  it('does not persist an error fallback as a display balance', async () => {
    mockFetchSwapTokenDetails.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balanceDisplayCache] = useSwapBalanceDisplayCacheAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        return {
          actions,
          balance,
          balanceDisplayCache,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(result.current.balance).toBe('0.0');
    expect(result.current.balanceDisplayCache.entries).toEqual([]);
  });

  it('does not let the ordinary Swap balance loader run for Stock tokens', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), {
        ...ethToken,
        symbol: 'USDT',
        balanceParsed: '2.2279',
      });
      storeInstance.set(swapSelectedFromTokenBalanceAtom(), '0.01001');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('0.01001');
  });

  it('keeps the latest Stock execution token sync when network sorting resolves out of order', async () => {
    let resolveFirstSort: (() => void) | undefined;
    mockSetSwapNetworksSortRawData
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstSort = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [toToken] = useSwapSelectToTokenAtom();
        const [stockSelectedToken] = useSwapStockSelectedTokenAtom();

        return {
          actions,
          fromToken,
          stockSelectedToken,
          toToken,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      const firstSync = result.current.actions.selectStockExecutionTokens({
        fromToken: usdcToken,
        toToken: stockTokenA,
        syncId: 1,
      });
      await Promise.resolve();

      await result.current.actions.selectStockExecutionTokens({
        fromToken: usdtToken,
        toToken: appleStockToken,
        syncId: 2,
      });

      resolveFirstSort?.();
      await firstSync;
    });

    expect(result.current.fromToken).toMatchObject({
      symbol: 'USDT',
      contractAddress: '0xusdt',
    });
    expect(result.current.toToken).toMatchObject({
      symbol: 'AAPL',
      contractAddress: '0xaapl',
    });
    expect(result.current.stockSelectedToken).toMatchObject({
      symbol: 'AAPL',
      contractAddress: '0xaapl',
    });
  });

  it('does not clear the Stock selected owner on a pay-token-only execution sync', async () => {
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [stockSelectedToken] = useSwapStockSelectedTokenAtom();

        return {
          actions,
          stockSelectedToken,
        };
      },
      {
        wrapper: createWrapper((storeInstance) => {
          storeInstance.set(swapStockSelectedTokenAtom(), stockTokenA);
        }),
      },
    );

    await act(async () => {
      await result.current.actions.selectStockExecutionTokens({
        fromToken: usdcToken,
        syncId: 1,
      });
    });

    expect(result.current.stockSelectedToken).toBe(stockTokenA);
  });

  it('checks warnings for a current-event quote while providers are still fetching', async () => {
    const fromToken = {
      ...ethToken,
      price: '100',
      currency: 'usd',
    };
    const toToken = {
      ...usdcToken,
      price: '100',
      currency: 'usd',
    };
    const quote = {
      eventId: 'event-warning',
      quoteId: 'quote-warning',
      fromAmount: '1',
      toAmount: '1.2',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.SWAP,
      instantRate: '1.2',
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), fromToken);
      storeInstance.set(swapSelectToTokenAtom(), toToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'event-warning',
        count: 2,
      });
      storeInstance.set(swapQuoteCurrentEventProviderKeysAtom(), ['mock-mock']);
      storeInstance.set(swapQuoteCurrentEventReceivedCountAtom(), 1);
      storeInstance.set(swapQuoteEventCompletedAtom(), false);
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.checkSwapWarning(
        fromAddressInfo,
        fromAddressInfo,
        { allowNoConnectWallet: true },
      );
    });

    expect(store.get(swapAlertsAtom())).toMatchObject({
      quoteId: 'quote-warning',
      states: [
        {
          noConnectWallet: true,
        },
      ],
    });
  });

  it('ignores stale Stock quote limits when the current input amount changed', async () => {
    const quote = {
      quoteId: 'stale-stock-limit-quote',
      fromAmount: '2',
      toAmount: '0',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      limit: {
        min: '10',
      },
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('does not write Stock quote min limits as generic red swap alerts', async () => {
    const quote = {
      quoteId: 'current-stock-limit-quote',
      fromAmount: '1',
      toAmount: '0',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      limit: {
        min: '10',
      },
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: 'current-stock-limit-quote',
      states: [],
    });
  });

  it('does not write stale Stock quote limit alerts after the amount changes mid-check', async () => {
    const quote = {
      quoteId: 'async-stale-stock-limit-quote',
      fromAmount: '1',
      toAmount: '0',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      limit: {
        min: '10',
      },
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const settings = {
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapSlippagePercentageCustomValue: 0,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapToAnotherAccountSwitchOn: false,
    };
    let resolveSettings: (value: typeof settings) => void = () => {};
    const settingsGetMock = settingsAtom.get as jest.MockedFunction<
      typeof settingsAtom.get
    >;
    settingsGetMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSettings = resolve;
        }),
    );

    const warningPromise = result.current.checkSwapWarning(
      connectedAddressInfo,
      connectedAddressInfo,
      { allowNoConnectWallet: true },
    );
    store.set(swapFromTokenAmountAtom(), {
      value: '0.0',
      isInput: true,
    });

    await act(async () => {
      resolveSettings(settings);
      await warningPromise;
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('clears stale Stock quote event errors when the current input amount changed', async () => {
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventErrorAtom(), {
        message: 'Min amount/request 10 USDC',
        fromToken: usdcToken,
        toToken: appleStockToken,
        fromTokenAmount: '2',
        isStock: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapQuoteEventErrorAtom())).toBeUndefined();
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('does not write current Stock quote event errors as generic red swap alerts', async () => {
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventErrorAtom(), {
        message: 'Market is closed',
        fromToken: usdcToken,
        toToken: appleStockToken,
        fromTokenAmount: '21',
        isStock: true,
        isMarketOpen: false,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapQuoteEventErrorAtom())).toEqual(
      expect.objectContaining({
        message: 'Market is closed',
        isStock: true,
        isMarketOpen: false,
      }),
    );
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('clears stale Stock quote alerts when quote state is reset', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '0.0',
        isInput: true,
      });
      storeInstance.set(swapAlertsAtom(), {
        quoteId: '',
        states: [
          {
            message: 'Min amount/request 10 USDC',
            alertLevel: undefined,
          },
        ],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.resetQuoteAction();
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('keeps Stock current quote selected when service normalizes amount formatting', () => {
    const quote = {
      quoteId: 'stock-numeric-match-quote',
      fromAmount: '1000',
      toAmount: '10',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const { store } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1000.0',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '',
        isInput: false,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });

    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'stock-numeric-match-quote',
    );
  });

  it('keeps previous Stock provider quotes display-only when amount formatting is normalized', async () => {
    const oldQuote = {
      quoteId: 'old-stock-provider-quote',
      eventId: 'previous-event',
      fromAmount: '1000',
      // Keep the previous quote more attractive so the test proves that it
      // cannot become executable merely because it is retained for display.
      toAmount: '99',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      info: {
        provider: 'old-provider',
        providerName: 'Old Provider',
      },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1000.0',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'normalized-event',
        count: 2,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'normalized-request',
      });
      storeInstance.set(swapQuoteListAtom(), [oldQuote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'new-stock-provider-quote',
            eventId: 'normalized-event',
            info: {
              provider: 'new-provider',
              providerName: 'New Provider',
            },
            fromAmount: '1000',
            fromTokenInfo: usdcToken,
            toAmount: '10.1',
            toTokenInfo: appleStockToken,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '1000.0',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: appleStockToken.networkId,
      toTokenAddress: appleStockToken.contractAddress,
    };
    const tokenPairs = {
      fromToken: usdcToken,
      toToken: appleStockToken,
    };

    await act(async () => {
      result.current.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'normalized-request',
        tokenPairs,
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: 'normalized-event',
          quoteId: 'old-stock-provider-quote',
        }),
        expect.objectContaining({
          eventId: 'normalized-event',
          quoteId: 'new-stock-provider-quote',
        }),
      ]),
    );
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      'new-provider-New Provider',
    ]);
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'new-stock-provider-quote',
    );

    await act(async () => {
      result.current.quoteEventHandler({
        event: {} as ISwapQuoteEvent,
        type: 'done',
        params: quoteParams,
        quoteRequestId: 'normalized-request',
        tokenPairs,
      });
    });

    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'new-stock-provider-quote',
    );
  });

  it('restores Limit defaults after leaving Stock with cleared tokens', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.resetSwapTokenData(ESwapDirectionType.FROM);
      await result.current.actions.resetSwapTokenData(ESwapDirectionType.TO);
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
      }),
    );
  });

  it('does not carry Stock selected tokens through a direct Limit switch', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapStockSelectedFromTokenBalanceAtom(), '999');
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '10',
        isInput: true,
      });
      storeInstance.set(swapSelectedTokensColdStartContextAtom(), {
        accountKey: 'test-account',
        networkId: 'evm--56',
        swapType: ESwapTabSwitchType.STOCK,
        updatedAt: 1,
      });
      storeInstance.set(swapInitialSelectedTokensSyncedAtom(), true);
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'WETH',
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'USDC',
      }),
    );
    expect(store.get(swapSelectedTokensColdStartContextAtom())).toBeUndefined();
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);
    expect(store.get(swapLastNonLimitSelectedTokensAtom())).toBeUndefined();
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).not.toMatchObject({
      contractAddress: usdcToken.contractAddress,
    });
    expect(store.get(swapSelectToTokenAtom())).not.toMatchObject({
      contractAddress: appleStockToken.contractAddress,
    });
  });

  it('restores the previous Swap pair without exposing the Stock balance', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapSelectedFromTokenBalanceAtom(), '0.1724');
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.STOCK,
        'evm--56',
      );
    });

    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('0.1724');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('');

    store.set(swapSelectFromTokenAtom(), usdcToken);
    store.set(swapSelectToTokenAtom(), appleStockToken);
    store.set(swapStockSelectedFromTokenBalanceAtom(), '999');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('999');

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: bnbToken.networkId,
        contractAddress: bnbToken.contractAddress,
        symbol: bnbToken.symbol,
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('0.1724');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('0.1724');

    store.set(swapStockSelectedFromTokenBalanceAtom(), '999');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('0.1724');
  });

  it.each([
    { isNative: false, platform: 'web' },
    { isNative: true, platform: 'native' },
  ])(
    'keeps Swap and Stock input amounts isolated and restores each draft on $platform',
    async ({ isNative }) => {
      platformEnv.isNative = isNative;
      const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
        storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
        storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
        storeInstance.set(swapSelectToTokenAtom(), usdtToken);
        storeInstance.set(swapFromTokenAmountAtom(), {
          value: '1.25',
          isInput: true,
        });
      });
      const { result } = renderHook(() => useSwapActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.swapTypeSwitchAction(ESwapTabSwitchType.STOCK);
      });

      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '',
        isInput: false,
      });

      await act(async () => {
        await result.current.selectStockExecutionTokens({
          fromToken: usdcToken,
          toToken: appleStockToken,
          syncId: 1,
        });
      });
      store.set(swapFromTokenAmountAtom(), {
        value: '20',
        isInput: true,
      });

      await act(async () => {
        await result.current.swapTypeSwitchAction(ESwapTabSwitchType.SWAP);
      });

      expect(store.get(swapSelectFromTokenAtom())).toEqual(bnbToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '1.25',
        isInput: true,
      });

      await act(async () => {
        await result.current.swapTypeSwitchAction(ESwapTabSwitchType.STOCK);
      });

      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '',
        isInput: false,
      });

      await act(async () => {
        await result.current.selectStockExecutionTokens({
          fromToken: usdcToken,
          toToken: appleStockToken,
          syncId: 2,
        });
      });

      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '20',
        isInput: true,
      });
      expect(
        store.get(swapInputAmountDraftsAtom())[ESwapTabSwitchType.STOCK],
      ).toBeUndefined();
    },
  );

  it('does not restore a tab input draft for a different token pair', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '20',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.SWAP);
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.STOCK);
      await result.current.selectStockExecutionTokens({
        fromToken: usdtToken,
        toToken: stockTokenA,
        syncId: 1,
      });
    });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(
      store.get(swapInputAmountDraftsAtom())[ESwapTabSwitchType.STOCK],
    ).toBeUndefined();
  });

  it('keeps Swap and Limit input amounts isolated and restores each draft', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1.25',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--1',
      );
    });

    const limitFromToken = store.get(swapSelectFromTokenAtom());
    const limitToToken = store.get(swapSelectToTokenAtom());
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    store.set(swapFromTokenAmountAtom(), {
      value: '100',
      isInput: true,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1.25',
      isInput: true,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--1',
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(limitFromToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(limitToToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '100',
      isInput: true,
    });
  });

  it('restores the native Swap amount after crossing the Limit owner boundary', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1.25',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--1',
      );
    });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    store.set(swapFromTokenAmountAtom(), {
      value: '100',
      isInput: true,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1.25',
      isInput: true,
    });
    expect(
      store.get(swapInputAmountDraftsAtom())[ESwapTabSwitchType.LIMIT],
    ).toBeUndefined();
  });

  it('carries the ordinary Swap target into native Pro', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapProSelectTokenAtom(), usdcToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: appleStockToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: buildProSupportedNetworkIds(appleStockToken),
        },
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapProSelectTokenAtom())).toEqual(appleStockToken);
    expect(mockSetSwapProSelectToken).toHaveBeenCalledWith(appleStockToken);
  });

  it('invalidates manual carry intent after a programmatic token write', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.selectToTokenByUser(usdtToken);
    });
    expect(store.get(swapUserSelectedTokensAtom())).toEqual({
      fromToken: bnbToken,
      toToken: usdtToken,
    });

    await act(async () => {
      await result.current.selectToToken(uniToken);
    });

    expect(store.get(swapUserSelectedTokensAtom())).toBeUndefined();
  });

  it('publishes manual token intent before network-sort persistence settles', async () => {
    let resolveNetworkSort: (() => void) | undefined;
    mockSetSwapNetworksSortRawData.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveNetworkSort = resolve;
      }),
    );
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let selectionPromise: Promise<void> | undefined;
    act(() => {
      selectionPromise = result.current.selectToTokenByUser(uniToken);
    });

    expect(store.get(swapSelectToTokenAtom())).toEqual(uniToken);
    expect(store.get(swapUserSelectedTokensAtom())).toEqual({
      fromToken: bnbToken,
      toToken: uniToken,
    });

    await act(async () => {
      resolveNetworkSort?.();
      await selectionPromise;
    });
  });

  it('owns Pro user selection independently from metadata backfill', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.selectSwapProToken(bnbToken);
      await result.current.updateSwapProSelectTokenMetadata({
        ...bnbToken,
        isStock: false,
      });
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual({
      ...bnbToken,
      isStock: false,
    });
    expect(store.get(swapProUserSelectedTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapUserSelectedTokensAtom())).toBeUndefined();
  });

  it('clears stale carry intent for programmatic Pro initialization', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapProUserSelectedTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initializeSwapProSelectToken(bnbToken);
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapProUserSelectedTokenAtom())).toBeUndefined();
    expect(store.get(swapUserSelectedTokensAtom())).toBeUndefined();
  });

  it('keeps an armed Swap selection aligned after reversing the pair', () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.alternationToken();
    });

    expect(store.get(swapUserSelectedTokensAtom())).toEqual({
      fromToken: usdtToken,
      toToken: bnbToken,
    });

    store.set(swapUserSelectedTokensAtom(), undefined);
    act(() => {
      result.current.alternationToken();
    });
    expect(store.get(swapUserSelectedTokensAtom())).toBeUndefined();
  });

  it('carries Swap FromToken when ToToken is stable', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: buildProSupportedNetworkIds(bnbToken),
          stableTokenKeys: buildStableTokenKeys(usdtToken),
        },
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(bnbToken);
  });

  it('applies the stable-token fallback when entering Pro from Bridge', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.BRIDGE);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdcToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: buildProSupportedNetworkIds(bnbToken),
          stableTokenKeys: buildStableTokenKeys(usdcToken),
        },
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(bnbToken);
  });

  it('keeps the Pro target when both Swap tokens are stable', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: usdcToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        usdcToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: buildProSupportedNetworkIds(usdcToken),
          stableTokenKeys: buildStableTokenKeys(usdcToken, usdtToken),
        },
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(uniToken);
    expect(mockSetSwapProSelectToken).not.toHaveBeenCalled();
  });

  it('treats missing stable classification as non-stable', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: buildProSupportedNetworkIds(usdtToken),
        },
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(usdtToken);
  });

  it('does not carry a Swap token into an unsupported Pro network', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: bnbToken,
        toToken: usdtToken,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: new Set(),
        },
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(uniToken);
  });

  it('carries a same-network Pro target into the restored Swap pair', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), uniToken);
      storeInstance.set(swapLastNonLimitSelectedTokensAtom(), {
        sourceSwapType: ESwapTabSwitchType.SWAP,
        fromToken: ethToken,
        toToken: usdcToken,
      });
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), uniToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        ethToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(ethToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(uniToken);
  });

  it('keeps a valid Swap pair when the Pro target matches the restored FromToken', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), uniToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapLastNonLimitSelectedTokensAtom(), {
        sourceSwapType: ESwapTabSwitchType.SWAP,
        fromToken: uniToken,
        toToken: usdtToken,
      });
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), uniToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let settledFromToken: ISwapToken | undefined;
    await act(async () => {
      settledFromToken = await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        usdtToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(settledFromToken).toEqual(uniToken);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(uniToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
  });

  it('keeps the restored Swap pair when the Pro target is stable', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapLastNonLimitSelectedTokensAtom(), {
        sourceSwapType: ESwapTabSwitchType.SWAP,
        fromToken: bnbToken,
        toToken: uniToken,
      });
      storeInstance.set(swapProSelectTokenAtom(), usdtToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), usdtToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          stableTokenKeys: buildStableTokenKeys(usdtToken),
        },
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(uniToken);
  });

  it('does not carry a Pro target into a network without single-swap support', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapLastNonLimitSelectedTokensAtom(), {
        sourceSwapType: ESwapTabSwitchType.SWAP,
        fromToken: ethToken,
        toToken: uniToken,
      });
      storeInstance.set(swapProSelectTokenAtom(), bnbToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), bnbToken);
      storeInstance.set(
        swapNetworks(),
        storeInstance.get(swapNetworks()).map((network) =>
          network.networkId === bnbToken.networkId
            ? {
                ...network,
                supportCrossChainSwap: true,
                supportSingleSwap: false,
              }
            : network,
        ),
      );
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        ethToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(ethToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(uniToken);
  });

  it('uses the target network native token for a cross-network Pro target', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapLastNonLimitSelectedTokensAtom(), {
        sourceSwapType: ESwapTabSwitchType.SWAP,
        fromToken: bnbToken,
        toToken: usdtToken,
      });
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), uniToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let settledFromToken: ISwapToken | undefined;
    await act(async () => {
      settledFromToken = await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        uniToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(settledFromToken).toMatchObject(ethToken);
    expect(store.get(swapSelectFromTokenAtom())).toMatchObject(ethToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(uniToken);
  });

  it('does not carry targets during programmatic tab initialization', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapProSelectTokenAtom(), usdcToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(usdcToken);
    expect(mockSetSwapProSelectToken).not.toHaveBeenCalled();
  });

  it('does not carry targets on a plain user tab flip', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapProSelectTokenAtom(), usdcToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        {
          ...carryTargetTokenOptions,
          proSupportedNetworkIds: buildProSupportedNetworkIds(appleStockToken),
        },
      );
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual(usdcToken);
    expect(mockSetSwapProSelectToken).not.toHaveBeenCalled();
  });

  it('restores Swap without carry when Pro had no user token selection', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapLastNonLimitSelectedTokensAtom(), {
        sourceSwapType: ESwapTabSwitchType.SWAP,
        fromToken: bnbToken,
        toToken: usdtToken,
      });
      storeInstance.set(swapProSelectTokenAtom(), uniToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        bnbToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
  });

  it('restores the Bridge pair through its visible Swap category', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.BRIDGE);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), uniToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        bnbToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(store.get(swapLastNonLimitSelectedTokensAtom())).toEqual({
      sourceSwapType: ESwapTabSwitchType.SWAP,
      fromToken: bnbToken,
      toToken: uniToken,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        bnbToken.networkId,
        carryTargetTokenOptions,
      );
    });

    expect(store.get(swapSelectFromTokenAtom())).toEqual(bnbToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(uniToken);
  });

  it('restores the native Stock amount after crossing the Limit owner boundary', async () => {
    platformEnv.isNative = true;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '20',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--1',
      );
    });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.STOCK);
      await result.current.selectStockExecutionTokens({
        fromToken: usdcToken,
        toToken: appleStockToken,
        syncId: 1,
      });
    });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '20',
      isInput: true,
    });
    expect(
      store.get(swapInputAmountDraftsAtom())[ESwapTabSwitchType.LIMIT],
    ).toBeUndefined();
  });

  it('blocks Stock quote before Stock execution tokens own the selected pair', async () => {
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: createWrapper((store) => {
          store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
          store.set(swapSelectFromTokenAtom(), ethToken);
          store.set(swapSelectToTokenAtom(), usdcToken);
          store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });
        }),
      },
    );

    await act(async () => {
      await result.current.actions.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchQuotesEvents).not.toHaveBeenCalled();
  });

  it('runs Stock quote events after Stock execution tokens own the selected pair', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapStockExecutionTokenSyncIdAtom(), 1);
      storeInstance.set(swapStockExecutionTokensAtom(), {
        syncId: 1,
        fromToken: usdcToken,
        toToken: stockTokenA,
      });
      storeInstance.set(swapStockSelectedTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
    expect(store.get(swapSelectFromTokenAtom())).toBe(usdcToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(stockTokenA);
    expect(store.get(swapStockExecutionTokenSyncIdAtom())).toBe(1);
    expect(store.get(swapStockExecutionTokensAtom())).toEqual({
      syncId: 1,
      fromToken: usdcToken,
      toToken: stockTokenA,
    });
    expect(store.get(swapStockSelectedTokenAtom())).toBe(stockTokenA);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });

    await act(async () => {
      await result.current.actions.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    });

    expect(store.get(swapQuoteActionLockAtom())).toEqual(
      expect.objectContaining({
        accountId: evmAccount.id,
        actionLock: true,
        address: '0xabc',
        fromToken: usdcToken,
        fromTokenAmount: '1',
        kind: ESwapQuoteKind.SELL,
        quoteRequestId: expect.any(String),
        toToken: stockTokenA,
        toTokenAmount: '',
        type: ESwapTabSwitchType.STOCK,
      }),
    );
    const quoteRequestId = store.get(swapQuoteActionLockAtom()).quoteRequestId;

    await waitFor(() =>
      expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: evmAccount.id,
          autoSlippage: true,
          fromToken: usdcToken,
          fromTokenAmount: '1',
          incognito: false,
          protocol: ESwapTabSwitchType.STOCK,
          quoteRequestId,
          slippagePercentage: 0.5,
          toToken: stockTokenA,
          userAddress: '0xabc',
        }),
      ),
    );
  });

  it('lets a new automatic quote request take over an unfinished session', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        true,
        ESwapQuoteKind.SELL,
      );
    });
    await waitFor(() => expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1));
    const firstQuoteRequestId = store.get(
      swapQuoteActionLockAtom(),
    ).quoteRequestId;

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        true,
        ESwapQuoteKind.SELL,
      );
    });
    await waitFor(() => expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(2));

    expect(firstQuoteRequestId).toEqual(expect.any(String));
    expect(store.get(swapQuoteActionLockAtom()).quoteRequestId).not.toBe(
      firstQuoteRequestId,
    );
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      firstQuoteRequestId,
    );
  });

  it('rearms automatic quote refresh and preserves its Market source', async () => {
    jest.useFakeTimers();
    try {
      const approvedBlockNumber = 123_456;
      const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
        storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
        storeInstance.set(swapSelectFromTokenAtom(), ethToken);
        storeInstance.set(swapSelectToTokenAtom(), bnbToken);
        storeInstance.set(swapFromTokenAmountAtom(), {
          value: '1',
          isInput: true,
        });
      });
      const { result } = renderHook(() => useSwapActions().current, {
        wrapper: Wrapper,
      });
      const quoteParams: IFetchQuotesParams = {
        source: ESwapQuoteSource.MARKET,
        autoSlippage: true,
        blockNumber: approvedBlockNumber,
        fromNetworkId: ethToken.networkId,
        fromTokenAddress: ethToken.contractAddress,
        fromTokenAmount: '1',
        protocol: EProtocolOfExchange.SWAP,
        slippagePercentage: 0.5,
        toNetworkId: bnbToken.networkId,
        toTokenAddress: bnbToken.contractAddress,
      };

      await act(async () => {
        await result.current.quoteAction(
          { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
          '0xabc',
          evmAccount.id,
          approvedBlockNumber,
          undefined,
          ESwapQuoteKind.SELL,
          undefined,
          undefined,
          undefined,
          {
            fromToken: ethToken,
            toToken: bnbToken,
            fromTokenAmount: '1',
            type: ESwapTabSwitchType.SWAP,
            source: ESwapQuoteSource.MARKET,
            manualRefresh: true,
          },
        );
        await Promise.resolve();
      });
      expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1);
      expect(mockFetchQuotesEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          blockNumber: approvedBlockNumber,
          source: ESwapQuoteSource.MARKET,
        }),
      );
      expect(store.get(swapQuoteActionLockAtom()).manualRefresh).toBe(true);

      const publishQuoteEvent = (
        type: 'done' | 'message',
        quoteEvent: ISwapQuoteEvent,
      ) => {
        const quoteRequestId = store.get(
          swapQuoteActionLockAtom(),
        ).quoteRequestId;
        result.current.quoteEventHandler({
          event: quoteEvent,
          type,
          accountId: evmAccount.id,
          params: {
            ...quoteParams,
            userAddress: '0xabc',
          },
          quoteRequestId: quoteRequestId ?? '',
          tokenPairs: {
            fromToken: ethToken,
            toToken: bnbToken,
          },
        });
      };
      const publishActionableQuote = (
        round: number,
        provider = 'refresh-provider',
      ) => {
        publishQuoteEvent('message', {
          data: JSON.stringify({
            data: [
              {
                eventId: `refresh-event-${round}`,
                fromAmount: '1',
                fromTokenInfo: ethToken,
                info: {
                  provider,
                  providerName: provider,
                },
                kind: ESwapQuoteKind.SELL,
                protocol: EProtocolOfExchange.SWAP,
                quoteId: `${provider}-quote-${round}`,
                toAmount: `${round + 1}`,
                toTokenInfo: bnbToken,
              },
            ],
          }),
        } as ISwapQuoteEvent);
      };

      for (let round = 0; round < swapQuoteIntervalMaxCount; round += 1) {
        act(() => {
          publishActionableQuote(round);
        });
        expect(store.get(swapQuoteFetchingAtom())).toBe(false);

        await act(async () => {
          await jest.advanceTimersByTimeAsync(swapRefreshInterval);
        });

        expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(round + 2);
        expect(mockFetchQuotesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            blockNumber: undefined,
            source: ESwapQuoteSource.MARKET,
          }),
        );
        expect(store.get(swapQuoteIntervalCountAtom())).toBe(round + 1);
        expect(store.get(swapShouldRefreshQuoteAtom())).toBe(false);
        expect(store.get(swapQuoteActionLockAtom()).manualRefresh).toBe(false);
      }

      const cancelCallCountBeforeFinalQuote =
        mockCancelFetchQuoteEvents.mock.calls.length;

      act(() => {
        publishActionableQuote(swapQuoteIntervalMaxCount);
      });

      expect(store.get(swapShouldRefreshQuoteAtom())).toBe(false);
      expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(
        cancelCallCountBeforeFinalQuote,
      );

      act(() => {
        publishActionableQuote(
          swapQuoteIntervalMaxCount,
          'second-refresh-provider',
        );
      });

      expect(
        store
          .get(swapQuoteListAtom())
          .some((quote) => quote.info.provider === 'second-refresh-provider'),
      ).toBe(true);
      expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(
        cancelCallCountBeforeFinalQuote,
      );

      act(() => {
        publishQuoteEvent('done', {} as ISwapQuoteEvent);
      });

      expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(
        swapQuoteIntervalMaxCount + 1,
      );
      expect(store.get(swapQuoteIntervalCountAtom())).toBe(
        swapQuoteIntervalMaxCount,
      );
      expect(store.get(swapShouldRefreshQuoteAtom())).toBe(true);
      expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(false);
      expect(store.get(swapQuoteAutoRefreshTimerAtom())).toBeUndefined();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it.each([
    {
      scenario: 'Swap',
      errorData: {
        errorMessage: 'Provider is temporarily unavailable',
        eventId: 'swap-business-error',
      },
      fromToken: ethToken,
      manualRefreshRequired: true,
      protocol: ESwapTabSwitchType.SWAP,
      quoteProtocol: EProtocolOfExchange.SWAP,
      toToken: bnbToken,
    },
    {
      scenario: 'Stock provider',
      errorData: {
        errorMessage: 'Stock provider is temporarily unavailable',
        eventId: 'stock-business-error',
        isStock: true,
      },
      fromToken: usdcToken,
      manualRefreshRequired: true,
      protocol: ESwapTabSwitchType.STOCK,
      quoteProtocol: EProtocolOfExchange.STOCK,
      toToken: stockTokenA,
    },
    {
      scenario: 'Stock market-closed',
      errorData: {
        errorMessage: 'Market is closed',
        eventId: 'stock-market-closed',
        isMarketOpen: false,
        isStock: true,
      },
      fromToken: usdcToken,
      manualRefreshRequired: false,
      protocol: ESwapTabSwitchType.STOCK,
      quoteProtocol: EProtocolOfExchange.STOCK,
      toToken: stockTokenA,
    },
    {
      scenario: 'Swap stock market-closed',
      errorData: {
        errorMessage: 'Market is closed',
        eventId: 'swap-stock-market-closed',
        isMarketOpen: false,
        isStock: true,
      },
      fromToken: usdcToken,
      manualRefreshRequired: false,
      protocol: ESwapTabSwitchType.SWAP,
      quoteProtocol: EProtocolOfExchange.SWAP,
      toToken: stockTokenA,
    },
    {
      scenario: 'Limit',
      errorData: {
        errorMessage: 'Limit price is invalid',
        eventId: 'limit-business-error',
      },
      fromToken: usdcToken,
      manualRefreshRequired: false,
      protocol: ESwapTabSwitchType.LIMIT,
      quoteProtocol: EProtocolOfExchange.LIMIT,
      toToken: usdtToken,
    },
  ])(
    'terminalizes $scenario business errors without automatic retry',
    async ({
      errorData,
      fromToken,
      manualRefreshRequired,
      protocol,
      quoteProtocol,
      toToken,
    }) => {
      jest.useFakeTimers();
      try {
        const quoteRequestId = `${protocol}-business-error-request`;
        const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
          storeInstance.set(swapTypeSwitchAtom(), protocol);
          storeInstance.set(swapSelectFromTokenAtom(), fromToken);
          storeInstance.set(swapSelectToTokenAtom(), toToken);
          storeInstance.set(swapFromTokenAmountAtom(), {
            value: '1',
            isInput: true,
          });
          storeInstance.set(swapQuoteFetchingAtom(), true);
          storeInstance.set(swapQuoteActionLockAtom(), {
            actionLock: true,
            fromToken,
            fromTokenAmount: '1',
            kind: ESwapQuoteKind.SELL,
            quoteRequestId,
            toToken,
            toTokenAmount: '',
            type: protocol,
          });
        });
        const { result } = renderHook(() => useSwapActions().current, {
          wrapper: Wrapper,
        });
        const quoteParams: IFetchQuotesParams = {
          autoSlippage: true,
          fromNetworkId: fromToken.networkId,
          fromTokenAddress: fromToken.contractAddress,
          fromTokenAmount: '1',
          protocol: quoteProtocol,
          slippagePercentage: 0.5,
          toNetworkId: toToken.networkId,
          toTokenAddress: toToken.contractAddress,
        };

        act(() => {
          result.current.quoteEventHandler({
            event: {
              data: JSON.stringify(errorData),
            } as ISwapQuoteEvent,
            type: 'message',
            params: quoteParams,
            quoteRequestId,
            tokenPairs: {
              fromToken,
              toToken,
            },
          });
        });

        expect(store.get(swapQuoteFetchingAtom())).toBe(false);
        expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(false);
        expect(store.get(swapQuoteAutoRefreshTimerAtom())).toBeUndefined();
        expect(store.get(swapShouldRefreshQuoteAtom())).toBe(
          manualRefreshRequired,
        );

        await act(async () => {
          await jest.advanceTimersByTimeAsync(
            swapRefreshInterval * (swapQuoteIntervalMaxCount + 1),
          );
        });

        expect(store.get(swapQuoteIntervalCountAtom())).toBe(0);
        expect(mockFetchQuotesEvents).not.toHaveBeenCalled();
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    },
  );

  it.each([
    {
      fromToken: ethToken,
      protocol: ESwapTabSwitchType.SWAP,
      quoteProtocol: EProtocolOfExchange.SWAP,
      supportsAutoRefresh: true,
      toToken: bnbToken,
    },
    {
      fromToken: usdcToken,
      protocol: ESwapTabSwitchType.STOCK,
      quoteProtocol: EProtocolOfExchange.STOCK,
      supportsAutoRefresh: true,
      toToken: stockTokenA,
    },
    {
      fromToken: usdcToken,
      protocol: ESwapTabSwitchType.LIMIT,
      quoteProtocol: EProtocolOfExchange.LIMIT,
      supportsAutoRefresh: false,
      toToken: usdtToken,
    },
    {
      fromToken: ethToken,
      protocol: ESwapTabSwitchType.PRIVATE_SEND,
      quoteProtocol: EProtocolOfExchange.PRIVATE_SEND,
      supportsAutoRefresh: false,
      toToken: bnbToken,
    },
  ])(
    'applies the quote-event refresh policy for $protocol quotes',
    async ({
      fromToken,
      protocol,
      quoteProtocol,
      supportsAutoRefresh,
      toToken,
    }) => {
      jest.useFakeTimers();
      try {
        const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
          storeInstance.set(swapTypeSwitchAtom(), protocol);
          storeInstance.set(swapSelectFromTokenAtom(), fromToken);
          storeInstance.set(swapSelectToTokenAtom(), toToken);
          storeInstance.set(swapFromTokenAmountAtom(), {
            value: '1',
            isInput: true,
          });
          if (protocol === ESwapTabSwitchType.STOCK) {
            storeInstance.set(swapStockExecutionTokenSyncIdAtom(), 1);
            storeInstance.set(swapStockExecutionTokensAtom(), {
              syncId: 1,
              fromToken,
              toToken,
            });
          }
        });
        const { result } = renderHook(() => useSwapActions().current, {
          wrapper: Wrapper,
        });

        await act(async () => {
          await result.current.quoteAction(
            { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
            '0xabc',
            evmAccount.id,
            undefined,
            undefined,
            ESwapQuoteKind.SELL,
          );
          await Promise.resolve();
        });
        expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1);
        expect(store.get(swapQuoteFetchingAtom())).toBe(true);

        const quoteRequestId = store.get(
          swapQuoteActionLockAtom(),
        ).quoteRequestId;
        const eventParams: IFetchQuotesParams = {
          autoSlippage: true,
          fromNetworkId: fromToken.networkId,
          fromTokenAddress: fromToken.contractAddress,
          fromTokenAmount: '1',
          protocol: quoteProtocol,
          slippagePercentage: 0.5,
          toNetworkId: toToken.networkId,
          toTokenAddress: toToken.contractAddress,
          userAddress: '0xabc',
        };
        act(() => {
          result.current.quoteEventHandler({
            event: {
              data: JSON.stringify({
                eventId: `${protocol}-event`,
                totalQuoteCount: 1,
              }),
            } as ISwapQuoteEvent,
            type: 'message',
            accountId: evmAccount.id,
            params: eventParams,
            quoteRequestId: quoteRequestId ?? '',
            tokenPairs: {
              fromToken,
              toToken,
            },
          });
        });
        act(() => {
          result.current.quoteEventHandler({
            event: {
              data: JSON.stringify({
                data: [
                  {
                    eventId: `${protocol}-event`,
                    fromAmount: '1',
                    fromTokenInfo: fromToken,
                    info: {
                      provider: `${protocol}-provider`,
                      providerName: `${protocol} Provider`,
                    },
                    kind: ESwapQuoteKind.SELL,
                    protocol: quoteProtocol,
                    quoteId: `${protocol}-quote`,
                    toAmount: '2',
                    toTokenInfo: toToken,
                  },
                ],
              }),
            } as ISwapQuoteEvent,
            type: 'message',
            accountId: evmAccount.id,
            params: eventParams,
            quoteRequestId: quoteRequestId ?? '',
            tokenPairs: {
              fromToken,
              toToken,
            },
          });
        });
        expect(store.get(swapQuoteListAtom())).toHaveLength(1);
        expect(store.get(swapQuoteFetchingAtom())).toBe(false);
        if (supportsAutoRefresh) {
          expect(store.get(swapQuoteAutoRefreshTimerAtom())).toBeDefined();
        } else {
          expect(store.get(swapQuoteAutoRefreshTimerAtom())).toBeUndefined();
        }

        await act(async () => {
          await jest.advanceTimersByTimeAsync(swapRefreshInterval);
        });

        expect(store.get(swapQuoteIntervalCountAtom())).toBe(
          supportsAutoRefresh ? 1 : 0,
        );
        expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(
          supportsAutoRefresh ? 2 : 1,
        );
        if (supportsAutoRefresh) {
          expect(mockFetchQuotesEvents).toHaveBeenLastCalledWith(
            expect.objectContaining({
              fromToken,
              protocol,
              toToken,
            }),
          );
        }
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    },
  );

  it('keeps automatic refresh timers isolated between Swap context stores', async () => {
    jest.useFakeTimers();
    try {
      const setupStore = (
        storeInstance: ReturnType<typeof createStore>,
        quoteRequestId: string,
      ) => {
        storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
        storeInstance.set(swapSelectFromTokenAtom(), ethToken);
        storeInstance.set(swapSelectToTokenAtom(), bnbToken);
        storeInstance.set(swapFromTokenAmountAtom(), {
          value: '1',
          isInput: true,
        });
        storeInstance.set(swapQuoteFetchingAtom(), true);
        storeInstance.set(swapQuoteActionLockAtom(), {
          actionLock: true,
          fromToken: ethToken,
          fromTokenAmount: '1',
          kind: ESwapQuoteKind.SELL,
          quoteRequestId,
          toToken: bnbToken,
          toTokenAmount: '',
          type: ESwapTabSwitchType.SWAP,
        });
      };
      const first = createWrapperWithStore((storeInstance) =>
        setupStore(storeInstance, 'first-store-request'),
      );
      const second = createWrapperWithStore((storeInstance) =>
        setupStore(storeInstance, 'second-store-request'),
      );
      const firstHook = renderHook(() => useSwapActions().current, {
        wrapper: first.Wrapper,
      });
      const secondHook = renderHook(() => useSwapActions().current, {
        wrapper: second.Wrapper,
      });
      const params: IFetchQuotesParams = {
        autoSlippage: true,
        fromNetworkId: ethToken.networkId,
        fromTokenAddress: ethToken.contractAddress,
        fromTokenAmount: '1',
        protocol: EProtocolOfExchange.SWAP,
        slippagePercentage: 0.5,
        toNetworkId: bnbToken.networkId,
        toTokenAddress: bnbToken.contractAddress,
      };
      const publishQuote = (
        quoteRequestId: string,
        eventId: string,
        quoteEventHandler: ReturnType<
          typeof useSwapActions
        >['current']['quoteEventHandler'],
      ) => {
        quoteEventHandler({
          event: {
            data: JSON.stringify({
              data: [
                {
                  eventId,
                  fromAmount: '1',
                  fromTokenInfo: ethToken,
                  info: {
                    provider: 'store-provider',
                    providerName: 'Store Provider',
                  },
                  kind: ESwapQuoteKind.SELL,
                  protocol: EProtocolOfExchange.SWAP,
                  quoteId: `${eventId}-quote`,
                  toAmount: '2',
                  toTokenInfo: bnbToken,
                },
              ],
            }),
          } as ISwapQuoteEvent,
          type: 'message',
          params,
          quoteRequestId,
          tokenPairs: {
            fromToken: ethToken,
            toToken: bnbToken,
          },
        });
      };

      act(() => {
        publishQuote(
          'first-store-request',
          'first-store-event',
          firstHook.result.current.quoteEventHandler,
        );
        publishQuote(
          'second-store-request',
          'second-store-event',
          secondHook.result.current.quoteEventHandler,
        );
      });
      expect(first.store.get(swapQuoteAutoRefreshTimerAtom())).toBeDefined();
      expect(second.store.get(swapQuoteAutoRefreshTimerAtom())).toBeDefined();

      act(() => {
        secondHook.result.current.cleanQuoteInterval();
      });
      expect(first.store.get(swapQuoteAutoRefreshTimerAtom())).toBeDefined();
      expect(second.store.get(swapQuoteAutoRefreshTimerAtom())).toBeUndefined();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(swapRefreshInterval);
      });
      expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('does not let delayed work from a replaced quote session start events', async () => {
    let resolveFirstCloseApproving: (() => void) | undefined;
    mockCloseApproving
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstCloseApproving = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        true,
        ESwapQuoteKind.SELL,
      );
    });
    await waitFor(() => expect(mockCloseApproving).toHaveBeenCalledTimes(1));
    const firstQuoteRequestId = store.get(
      swapQuoteActionLockAtom(),
    ).quoteRequestId;

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        true,
        ESwapQuoteKind.SELL,
      );
    });
    await waitFor(() => expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1));
    const currentQuoteRequestId = store.get(
      swapQuoteActionLockAtom(),
    ).quoteRequestId;

    await act(async () => {
      resolveFirstCloseApproving?.();
      await Promise.resolve();
    });

    expect(currentQuoteRequestId).not.toBe(firstQuoteRequestId);
    expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1);
    expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteRequestId: currentQuoteRequestId,
      }),
    );
  });

  it('terminalizes the active quote session when manual refresh is required', async () => {
    const quoteRequestId = 'manual-refresh-request';
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId,
      });
      storeInstance.set(swapQuoteFetchingAtom(), true);
      storeInstance.set(swapQuoteEventCompletedAtom(), false);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.requireManualQuoteRefresh();
    });

    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(quoteRequestId);
    expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(false);
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapShouldRefreshQuoteAtom())).toBe(true);
  });

  it('exposes manual refresh when a quote event session fails to start', async () => {
    mockFetchQuotesEvents.mockRejectedValueOnce(
      new Error('quote event failed to start'),
    );
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    });

    await waitFor(() =>
      expect(store.get(swapShouldRefreshQuoteAtom())).toBe(true),
    );
    const quoteRequestId = store.get(swapQuoteActionLockAtom()).quoteRequestId;
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(quoteRequestId);
    expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(false);
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
  });

  it('preserves the locked BUY kind when retrying an exact-buy quote', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '5',
        isInput: false,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: false,
        type: ESwapTabSwitchType.LIMIT,
        fromToken: ethToken,
        toToken: bnbToken,
        fromTokenAmount: '5',
        toTokenAmount: '21',
        kind: ESwapQuoteKind.BUY,
        quoteRequestId: 'failed-buy-request',
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
        true,
      );
    });

    await waitFor(() => expect(mockFetchQuotesEvents).toHaveBeenCalledTimes(1));
    expect(store.get(swapQuoteActionLockAtom())).toEqual(
      expect.objectContaining({ kind: ESwapQuoteKind.BUY }),
    );
    expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        fromTokenAmount: '5',
        kind: ESwapQuoteKind.BUY,
        toTokenAmount: '21',
      }),
    );
  });

  it('normalizes quote event results with the dispatch-time input amount', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'event-1',
        count: 1,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'event-1-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            eventId: 'event-1',
            info: {
              provider: 'stock',
              providerName: 'Stock',
            },
            fromTokenInfo: usdcToken,
            toAmount: '10',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '1',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'event-1-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())[0]).toEqual(
      expect.objectContaining({
        fromAmount: '1',
      }),
    );
  });

  it('accepts the current Swap quote before total and ignores stale request events', async () => {
    const staleQuote = {
      quoteId: 'stale-swap-quote',
      eventId: 'stale-swap-event',
      info: {
        provider: 'stale-provider',
        providerName: 'Stale Provider',
      },
      fromAmount: '2',
      fromTokenInfo: usdcToken,
      toAmount: '1',
      toTokenInfo: usdtToken,
      protocol: EProtocolOfExchange.SWAP,
      kind: ESwapQuoteKind.SELL,
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [staleQuote]);
      storeInstance.set(swapQuoteEventTotalCountAtom(), { count: 0 });
      storeInstance.set(swapQuoteFetchingAtom(), true);
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        type: ESwapTabSwitchType.SWAP,
        fromToken: usdcToken,
        toToken: usdtToken,
        fromTokenAmount: '21',
        toTokenAmount: '',
        kind: ESwapQuoteKind.SELL,
        quoteRequestId: 'current-swap-request',
      });
    });
    const { result } = renderHook(
      () => ({ actions: useSwapActions().current }),
      { wrapper: Wrapper },
    );
    const staleParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '21',
      protocol: EProtocolOfExchange.SWAP,
      slippagePercentage: 0.5,
      toNetworkId: usdtToken.networkId,
      toTokenAddress: usdtToken.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: {} as ISwapQuoteEvent,
        type: 'done',
        params: staleParams,
        quoteRequestId: 'stale-swap-request',
        tokenPairs: { fromToken: usdcToken, toToken: usdtToken },
      });
    });

    expect(store.get(swapQuoteEventCompletedAtom())).toBe(false);
    expect(store.get(swapQuoteFetchingAtom())).toBe(true);
    expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(true);
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();

    const currentQuoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'current-swap-quote',
            eventId: 'current-swap-event',
            info: {
              provider: 'current-provider',
              providerName: 'Current Provider',
            },
            fromAmount: '21',
            fromTokenInfo: usdcToken,
            toAmount: '10',
            toTokenInfo: usdtToken,
            protocol: EProtocolOfExchange.SWAP,
            kind: ESwapQuoteKind.SELL,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const currentParams: IFetchQuotesParams = staleParams;

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: currentQuoteEvent,
        type: 'message',
        params: currentParams,
        quoteRequestId: 'current-swap-request',
        tokenPairs: { fromToken: usdcToken, toToken: usdtToken },
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: 'current-swap-event',
      count: 1,
      totalQuoteCountReceived: false,
    });
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      'current-provider-Current Provider',
    ]);
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        eventId: 'current-swap-event',
        fromAmount: '21',
        quoteId: 'current-swap-quote',
      }),
    );
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(false);
  });

  it.each([
    {
      caseName: 'Limit rejects a Swap completion',
      currentSwapType: ESwapTabSwitchType.LIMIT,
      eventProtocol: EProtocolOfExchange.SWAP,
      fromToken: usdcToken,
      toToken: usdtToken,
      inputKind: ESwapQuoteKind.BUY,
      currentFromAmount: '5',
      currentToAmount: '21',
      requestFromAmount: '5',
      requestToAmount: '21',
      shouldAccept: false,
    },
    {
      caseName: 'Swap rejects a Limit completion',
      currentSwapType: ESwapTabSwitchType.SWAP,
      eventProtocol: EProtocolOfExchange.LIMIT,
      fromToken: usdcToken,
      toToken: usdtToken,
      inputKind: ESwapQuoteKind.SELL,
      currentFromAmount: '21',
      currentToAmount: '5',
      requestFromAmount: '21',
      requestToAmount: '5',
      shouldAccept: false,
    },
    {
      caseName: 'Bridge rejects a stale input completion',
      currentSwapType: ESwapTabSwitchType.BRIDGE,
      eventProtocol: EProtocolOfExchange.SWAP,
      fromToken: ethToken,
      toToken: bnbToken,
      inputKind: ESwapQuoteKind.SELL,
      currentFromAmount: '21',
      currentToAmount: '5',
      requestFromAmount: '2',
      requestToAmount: '5',
      shouldAccept: false,
    },
    {
      caseName: 'Limit accepts the current BUY input completion',
      currentSwapType: ESwapTabSwitchType.LIMIT,
      eventProtocol: EProtocolOfExchange.LIMIT,
      fromToken: usdcToken,
      toToken: usdtToken,
      inputKind: ESwapQuoteKind.BUY,
      currentFromAmount: '999',
      currentToAmount: '21',
      requestFromAmount: '5',
      requestToAmount: '21',
      shouldAccept: true,
    },
  ])(
    '$caseName',
    async ({
      currentSwapType,
      eventProtocol,
      fromToken,
      toToken,
      inputKind,
      currentFromAmount,
      currentToAmount,
      requestFromAmount,
      requestToAmount,
      shouldAccept,
    }) => {
      const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
        storeInstance.set(swapTypeSwitchAtom(), currentSwapType);
        storeInstance.set(swapSelectFromTokenAtom(), fromToken);
        storeInstance.set(swapSelectToTokenAtom(), toToken);
        storeInstance.set(swapFromTokenAmountAtom(), {
          value: currentFromAmount,
          isInput: inputKind === ESwapQuoteKind.SELL,
        });
        storeInstance.set(swapToTokenAmountAtom(), {
          value: currentToAmount,
          isInput: inputKind === ESwapQuoteKind.BUY,
        });
        storeInstance.set(swapQuoteEventCompletedAtom(), false);
        storeInstance.set(swapQuoteFetchingAtom(), true);
        storeInstance.set(swapQuoteActionLockAtom(), {
          actionLock: true,
          quoteRequestId: 'completion-request',
        });
      });
      const { result } = renderHook(
        () => ({ actions: useSwapActions().current }),
        { wrapper: Wrapper },
      );
      const params: IFetchQuotesParams = {
        fromNetworkId: fromToken.networkId,
        fromTokenAddress: fromToken.contractAddress,
        fromTokenAmount: requestFromAmount,
        protocol: eventProtocol,
        slippagePercentage: 0.5,
        toNetworkId: toToken.networkId,
        toTokenAddress: toToken.contractAddress,
        toTokenAmount: requestToAmount,
        kind: inputKind,
      };

      await act(async () => {
        result.current.actions.quoteEventHandler({
          event: {} as ISwapQuoteEvent,
          type: 'done',
          params,
          quoteRequestId: 'completion-request',
          tokenPairs: { fromToken, toToken },
        });
      });

      expect(store.get(swapQuoteEventCompletedAtom())).toBe(shouldAccept);
      expect(store.get(swapQuoteFetchingAtom())).toBe(!shouldAccept);
    },
  );

  it('accepts native Pro LIMIT events using the dispatched request tokens', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '999',
        isInput: false,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '999',
        isInput: false,
      });
      storeInstance.set(swapQuoteEventCompletedAtom(), false);
      storeInstance.set(swapQuoteFetchingAtom(), true);
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'pro-limit-request',
        type: ESwapTabSwitchType.LIMIT,
        fromToken: usdcToken,
        toToken: usdtToken,
        fromTokenAmount: '5',
        toTokenAmount: '21',
        kind: ESwapQuoteKind.BUY,
      });
    });
    const { result } = renderHook(
      () => ({ actions: useSwapActions().current }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: {} as ISwapQuoteEvent,
        type: 'done',
        params: {
          fromNetworkId: usdcToken.networkId,
          fromTokenAddress: usdcToken.contractAddress,
          fromTokenAmount: '5',
          protocol: EProtocolOfExchange.LIMIT,
          slippagePercentage: 0.5,
          toNetworkId: usdtToken.networkId,
          toTokenAddress: usdtToken.contractAddress,
          toTokenAmount: '21',
          kind: ESwapQuoteKind.BUY,
        },
        quoteRequestId: 'pro-limit-request',
        tokenPairs: { fromToken: usdcToken, toToken: usdtToken },
      });
    });

    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
  });

  it('accepts Stock quote event results before the total count event arrives', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'early-stock-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'early-stock-quote',
            eventId: 'early-stock-event',
            info: {
              provider: 'stock',
              providerName: 'Stock',
            },
            fromTokenInfo: usdcToken,
            toAmount: '0.0683',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '21',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
      toTokenAmount: '',
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'early-stock-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: 'early-stock-event',
      count: 1,
      totalQuoteCountReceived: false,
    });
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteListAtom())[0]).toEqual(
      expect.objectContaining({
        fromAmount: '21',
        quoteId: 'early-stock-quote',
      }),
    );
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'early-stock-quote',
    );

    store.set(swapToTokenAmountAtom(), {
      value: '0.0683',
      isInput: false,
    });

    const totalCountEvent = {
      data: JSON.stringify({
        eventId: 'early-stock-event',
        totalQuoteCount: 3,
      }),
    } as ISwapQuoteEvent;
    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: totalCountEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'early-stock-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: 'early-stock-event',
      count: 3,
      totalQuoteCountReceived: true,
    });
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'early-stock-quote',
    );

    const secondProviderQuoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'second-stock-quote',
            eventId: 'early-stock-event',
            info: {
              provider: 'stock-second',
              providerName: 'Stock Second',
            },
            fromTokenInfo: usdcToken,
            toAmount: '0.069',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: secondProviderQuoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'early-stock-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quoteId: 'early-stock-quote' }),
        expect.objectContaining({ quoteId: 'second-stock-quote' }),
      ]),
    );
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(2);
  });

  it('ignores stale Stock quote event results after the input amount changes', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'stale-event',
        count: 1,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'stale-stock-result-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            eventId: 'stale-event',
            info: {
              provider: 'stock',
              providerName: 'Stock',
            },
            fromTokenInfo: usdcToken,
            toAmount: '1',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '2',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'stale-stock-result-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual([]);
  });

  it('ignores stale Stock quote event errors after the input amount changes', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'stale-stock-error-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        errorMessage: 'Min amount/request 10 USDC',
        eventId: 'stale-error-event',
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '2',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'stale-stock-error-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
    expect(store.get(swapQuoteEventErrorAtom())).toBeUndefined();
  });

  it('keeps current Stock quote event errors out of generic red swap alerts', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'current-stock-error-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        errorMessage: 'Market is closed',
        eventId: 'current-market-closed-event',
        isMarketOpen: false,
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '21',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'current-stock-error-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteEventErrorAtom())).toEqual(
      expect.objectContaining({
        message: 'Market is closed',
        fromToken: usdcToken,
        toToken: stockTokenA,
        fromTokenAmount: '21',
        isStock: true,
        isMarketOpen: false,
        eventId: 'current-market-closed-event',
      }),
    );
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      'current-stock-error-request',
    );
  });

  it('does not emit or check unsupported-account alerts while addresses are resolving', async () => {
    mockCheckAccountNetworkNotSupported.mockResolvedValue(true);
    const resolvingAddressInfo = createExternalAddressInfo({
      address: undefined,
      isAddressInfoReady: false,
    });
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdtToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          resolvingAddressInfo,
          resolvingAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(mockCheckAccountNetworkNotSupported).not.toHaveBeenCalled();
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('creates a missing recipient address with the resolved target identity', async () => {
    const hdWallet: IDBWallet = {
      id: 'hd-1',
      name: 'HD Wallet 1',
      type: WALLET_TYPE_HD,
      backuped: true,
      accounts: [],
      nextIds: {},
      walletNo: 1,
    };
    const ethActiveAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...activeAccountInfo,
      deriveType: 'default',
      wallet: hdWallet,
      indexedAccount: {
        id: 'hd-1--0',
        name: 'Account 1',
        walletId: hdWallet.id,
        index: 0,
        idHash: 'indexed-account-hash',
      },
      network: { id: ethToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const ethAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      deriveType: ethActiveAccountInfo.deriveType,
      accountInfo: ethActiveAccountInfo,
      activeAccount: ethActiveAccountInfo,
    };
    const missingLtcAddressInfo: ISwapAddressInfo = {
      ...ethAddressInfo,
      address: undefined,
      networkId: ltcToken.networkId,
      deriveType: 'BIP84',
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapNetworks(), [evmSwapNetwork, ltcSwapNetwork]);
      storeInstance.set(swapSelectToTokenAtom(), ltcToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          ethAddressInfo,
          missingLtcAddressInfo,
        );
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      expect.objectContaining({
        action: expect.objectContaining({
          directionType: ESwapDirectionType.TO,
          actionData: expect.objectContaining({
            account: expect.objectContaining({
              networkId: ltcToken.networkId,
              deriveType: 'BIP84',
            }),
          }),
        }),
      }),
    ]);
  });

  it('does not report an unsupported source account when only the cross-chain recipient is missing', async () => {
    const importedWallet: IDBWallet = {
      id: WALLET_TYPE_IMPORTED,
      name: 'Imported',
      type: WALLET_TYPE_IMPORTED,
      backuped: true,
      accounts: [],
      nextIds: {},
      walletNo: WALLET_NO_IMPORTED,
    };
    const importedAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...activeAccountInfo,
      wallet: importedWallet,
      network: { id: bnbToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const importedFromAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: bnbToken.networkId,
      accountInfo: importedAccountInfo,
      activeAccount: importedAccountInfo,
    };
    const missingRecipientAddressInfo: ISwapAddressInfo = {
      ...importedFromAddressInfo,
      address: undefined,
      networkId: trxToken.networkId,
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), trxToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    mockCheckAccountNetworkNotSupported.mockResolvedValue(true);

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          importedFromAddressInfo,
          missingRecipientAddressInfo,
        );
      });
    });

    expect(mockCheckAccountNetworkNotSupported).not.toHaveBeenCalled();
    expect(store.get(swapAlertsAtom()).states).toEqual([]);
  });

  it('reports an unsupported target account when the provider cannot accept a recipient', async () => {
    const externalAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...activeAccountInfo,
      wallet: externalWallet,
      network: { id: bnbToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const externalFromAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: bnbToken.networkId,
      accountInfo: externalAccountInfo,
      activeAccount: externalAccountInfo,
    };
    const externalToAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...externalAccountInfo,
      account: undefined,
      network: { id: trxToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const missingRecipientAddressInfo: ISwapAddressInfo = {
      ...externalFromAddressInfo,
      address: undefined,
      networkId: trxToken.networkId,
      accountInfo: externalToAccountInfo,
      activeAccount: externalToAccountInfo,
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapNetworks(), [evmSwapNetwork, trxSwapNetwork]);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), trxToken);
      storeInstance.set(swapQuoteListAtom(), [
        buildRecipientUnsupportedQuote({
          fromToken: bnbToken,
          toToken: trxToken,
        }),
      ]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    mockCheckAccountNetworkNotSupported.mockResolvedValue(true);

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          externalFromAddressInfo,
          missingRecipientAddressInfo,
        );
      });
    });

    expect(mockCheckAccountNetworkNotSupported).toHaveBeenCalledWith({
      accountId: undefined,
      activeNetworkId: trxToken.networkId,
      walletId: externalWallet.id,
    });
    expect(store.get(swapAlertsAtom()).states).toEqual([
      expect.objectContaining({
        alertLevel: ESwapAlertLevel.ERROR,
      }),
    ]);
    expect(store.get(swapAlertsAtom()).states[0]?.action).toBeUndefined();
  });

  it('ignores a stale target-network check after the token pair changes', async () => {
    const externalAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...activeAccountInfo,
      wallet: externalWallet,
      network: { id: bnbToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const externalFromAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: bnbToken.networkId,
      accountInfo: externalAccountInfo,
      activeAccount: externalAccountInfo,
    };
    const externalToAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...externalAccountInfo,
      account: undefined,
      network: { id: trxToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const missingRecipientAddressInfo: ISwapAddressInfo = {
      ...externalFromAddressInfo,
      address: undefined,
      networkId: trxToken.networkId,
      accountInfo: externalToAccountInfo,
      activeAccount: externalToAccountInfo,
    };
    const targetNetworkCheck = createDeferred<boolean>();
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapNetworks(), [evmSwapNetwork, trxSwapNetwork]);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), trxToken);
      storeInstance.set(swapQuoteListAtom(), [
        buildRecipientUnsupportedQuote({
          fromToken: bnbToken,
          toToken: trxToken,
        }),
      ]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    mockCheckAccountNetworkNotSupported.mockReturnValueOnce(
      targetNetworkCheck.promise,
    );

    await withMutedConsoleError(async () => {
      const warningPromise = result.current.checkSwapWarning(
        externalFromAddressInfo,
        missingRecipientAddressInfo,
      );
      await waitFor(() => {
        expect(mockCheckAccountNetworkNotSupported).toHaveBeenCalledTimes(1);
      });

      store.set(swapSelectToTokenAtom(), ethToken);
      targetNetworkCheck.resolve(true);
      await act(async () => {
        await warningPromise;
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([]);
  });

  it('ignores a stale target-network check after the account context changes', async () => {
    const externalAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...activeAccountInfo,
      wallet: externalWallet,
      network: { id: bnbToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const externalFromAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: bnbToken.networkId,
      accountInfo: externalAccountInfo,
      activeAccount: externalAccountInfo,
    };
    const missingRecipientAddressInfo: ISwapAddressInfo = {
      ...externalFromAddressInfo,
      address: undefined,
      networkId: trxToken.networkId,
      accountInfo: {
        ...externalAccountInfo,
        account: undefined,
        network: { id: trxToken.networkId } as NonNullable<
          IAccountSelectorActiveAccountInfo['network']
        >,
      },
    };
    const targetNetworkCheck = createDeferred<boolean>();
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapNetworks(), [evmSwapNetwork, trxSwapNetwork]);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), trxToken);
      storeInstance.set(swapQuoteListAtom(), [
        buildRecipientUnsupportedQuote({
          fromToken: bnbToken,
          toToken: trxToken,
        }),
      ]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    mockCheckAccountNetworkNotSupported.mockReturnValueOnce(
      targetNetworkCheck.promise,
    );

    await withMutedConsoleError(async () => {
      const warningPromise = result.current.checkSwapWarning(
        externalFromAddressInfo,
        missingRecipientAddressInfo,
      );
      await waitFor(() => {
        expect(mockCheckAccountNetworkNotSupported).toHaveBeenCalledTimes(1);
      });

      act(() => {
        result.current.invalidateSwapWarningCheck();
      });
      targetNetworkCheck.resolve(true);
      await act(async () => {
        await warningPromise;
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([]);
  });

  it('does not offer address creation when hardware cannot use the target network', async () => {
    const hardwareWallet: IDBWallet = {
      id: 'hw-1',
      name: 'Hardware Wallet 1',
      type: WALLET_TYPE_HW,
      backuped: true,
      accounts: [],
      nextIds: {},
      walletNo: 1,
    };
    const btcAccount: INetworkAccount = {
      ...evmAccount,
      id: "hw-1--m/84'/0'/0'/0/0",
      impl: 'btc',
      address: 'bc1qtest',
      addressDetail: {
        ...evmAccount.addressDetail,
        networkId: btcToken.networkId,
        address: 'bc1qtest',
        baseAddress: 'bc1qtest',
        normalizedAddress: 'bc1qtest',
        displayAddress: 'bc1qtest',
      },
    };
    const hardwareAccountInfo: IAccountSelectorActiveAccountInfo = {
      ...activeAccountInfo,
      account: btcAccount,
      wallet: hardwareWallet,
      network: { id: btcToken.networkId } as NonNullable<
        IAccountSelectorActiveAccountInfo['network']
      >,
    };
    const hardwareFromAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      address: btcAccount.address,
      networkId: btcToken.networkId,
      accountInfo: hardwareAccountInfo,
      activeAccount: hardwareAccountInfo,
    };
    const hardwareToAddressInfo: ISwapAddressInfo = {
      ...hardwareFromAddressInfo,
      address: undefined,
      networkId: ethToken.networkId,
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapNetworks(), [btcSwapNetwork, evmSwapNetwork]);
      storeInstance.set(swapSelectFromTokenAtom(), btcToken);
      storeInstance.set(swapSelectToTokenAtom(), ethToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    mockCheckAccountNetworkNotSupported.mockImplementation(
      async ({ activeNetworkId }) => activeNetworkId === ethToken.networkId,
    );

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          hardwareFromAddressInfo,
          hardwareToAddressInfo,
        );
      });
    });

    expect(mockCheckAccountNetworkNotSupported).toHaveBeenNthCalledWith(1, {
      accountId: btcAccount.id,
      activeNetworkId: btcToken.networkId,
      walletId: hardwareWallet.id,
    });
    expect(mockCheckAccountNetworkNotSupported).toHaveBeenNthCalledWith(2, {
      accountId: btcAccount.id,
      activeNetworkId: ethToken.networkId,
      walletId: hardwareWallet.id,
    });
    expect(store.get(swapAlertsAtom()).states).toEqual([
      expect.objectContaining({
        alertLevel: ESwapAlertLevel.ERROR,
      }),
    ]);
    expect(store.get(swapAlertsAtom()).states[0]?.action).toBeUndefined();
  });

  it('keeps the unsupported-account alert after address resolution completes', async () => {
    const unsupportedAddressInfo = createExternalAddressInfo({
      address: undefined,
      isAddressInfoReady: true,
    });
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdtToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          unsupportedAddressInfo,
          unsupportedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapAlertsAtom()).states).toHaveLength(1);
  });

  it('does not keep noConnectWallet warning when native wallet readiness is not proven', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);
    store.set(swapAlertsAtom(), {
      states: [{ message: 'keep me' }, { noConnectWallet: true }],
      quoteId: 'old-quote',
    });

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(fromAddressInfo, fromAddressInfo, {
        allowNoConnectWallet: false,
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { message: 'keep me' },
    ]);
  });

  it('keeps noConnectWallet warning when the caller proves a real no-wallet state', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(fromAddressInfo, fromAddressInfo, {
        allowNoConnectWallet: true,
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { noConnectWallet: true },
    ]);
  });

  it('shows noConnectWallet when a disconnected web wallet leaves stale wallet info', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);
    const disconnectedAddressInfo: ISwapAddressInfo = {
      address: undefined,
      networkId: 'evm--1',
      accountInfo: {
        ...activeAccountInfo,
        account: undefined,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        account: undefined,
        wallet: externalWallet,
      },
      isAddressInfoReady: true,
    };

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(
        disconnectedAddressInfo,
        disconnectedAddressInfo,
        {
          allowNoConnectWallet: true,
        },
      );
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { noConnectWallet: true },
    ]);
  });

  it('updates position balances only for the active owner and keeps its cache coherent', async () => {
    const ownerA = 'account-a__evm--1__usd';
    const ownerB = 'account-b__evm--56__usd';
    const updatedAt = 123;
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapProPositionsCurrentOwnerKeyAtom(), ownerA);
    store.set(swapProPositionsDataOwnerKeyAtom(), ownerA);
    store.set(swapProSupportNetworksTokenListAtom(), [
      { ...ethToken, balanceParsed: '1' },
    ]);
    store.set(swapProPositionsCacheAtom(), {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        [ownerA]: {
          ownerKey: ownerA,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: [{ ...ethToken, balanceParsed: '1' }],
          updatedAt,
        },
      },
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateSwapProPositionTokenBalances({
        positionOwnerKey: ownerA,
        tokens: [{ ...ethToken, balanceParsed: '2' }],
      });
    });

    expect(
      store.get(swapProSupportNetworksTokenListAtom())[0]?.balanceParsed,
    ).toBe('2');
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerA]?.tokens[0]
        ?.balanceParsed,
    ).toBe('2');
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerA]?.updatedAt,
    ).toBe(updatedAt);

    act(() => {
      store.set(swapProPositionsCurrentOwnerKeyAtom(), ownerB);
      store.set(swapProPositionsDataOwnerKeyAtom(), ownerB);
      store.set(swapProSupportNetworksTokenListAtom(), [bnbToken]);
      result.current.updateSwapProPositionTokenBalances({
        positionOwnerKey: ownerA,
        tokens: [{ ...ethToken, balanceParsed: '3' }],
      });
    });

    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([
      bnbToken,
    ]);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerA]?.tokens[0]
        ?.balanceParsed,
    ).toBe('2');
  });

  it('orders token balance requests and loading across hook instances in the same Swap store', () => {
    const { store, Wrapper } = createWrapperWithStore();
    const firstInstance = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const secondInstance = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    const firstRequestId =
      firstInstance.result.current.beginSwapProTokenBalanceRequest();
    const secondRequestId =
      secondInstance.result.current.beginSwapProTokenBalanceRequest();

    expect(store.get(swapProTokenBalanceLoadingAtom())).toBe(true);
    expect(
      firstInstance.result.current.isSwapProTokenBalanceRequestLatest(
        firstRequestId,
      ),
    ).toBe(false);
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(true);

    firstInstance.result.current.invalidateSwapProTokenBalanceRequest(
      firstRequestId,
    );
    firstInstance.result.current.finishSwapProTokenBalanceRequest(
      firstRequestId,
    );
    expect(store.get(swapProTokenBalanceLoadingAtom())).toBe(true);
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(true);

    secondInstance.result.current.finishSwapProTokenBalanceRequest(
      secondRequestId,
    );
    expect(store.get(swapProTokenBalanceLoadingAtom())).toBe(false);
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(true);

    secondInstance.result.current.invalidateSwapProTokenBalanceRequest(
      secondRequestId,
    );
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(false);
  });

  it('uses a fresh top-N positions cache only as a seed and still restores the full live list', async () => {
    const ownerKey = 'indexed-account__evm--1__usd';
    const liveTokens = Array.from(
      { length: SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 5 },
      (_, index): ISwapToken => ({
        networkId: 'evm--1',
        contractAddress: `0x${index.toString(16).padStart(40, '0')}`,
        symbol: `TOKEN-${index}`,
        decimals: 18,
        balanceParsed: `${index}`,
        fiatValue: `${index}`,
      }),
    );
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [
        {
          apiAddress: '0xaccount',
          networkId: 'evm--1',
          accountId: 'network-account',
        },
      ],
    });
    mockFetchSwapTokens.mockResolvedValue(liveTokens);
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapProPositionsCacheAtom(), {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        [ownerKey]: {
          ownerKey,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: liveTokens.slice(
            0,
            SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
          ),
          updatedAt: Date.now(),
        },
      },
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [{ networkId: 'evm--1', name: 'Ethereum', symbol: 'ETH' }],
        'indexed-account',
        undefined,
        'usd',
      );
    });

    expect(mockFetchSwapTokens).toHaveBeenCalledTimes(1);
    expect(store.get(swapProSupportNetworksTokenListAtom())).toHaveLength(
      SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 5,
    );
    expect(store.get(swapProPositionsDataOwnerKeyAtom())).toBe(ownerKey);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerKey].tokens,
    ).toHaveLength(SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER);
  });

  it('does not mark a persisted positions seed as live when the refresh fails', async () => {
    const ownerKey = 'indexed-account__evm--1__usd';
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: true,
      swapSupportAccounts: [],
    });
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapProPositionsCacheAtom(), {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        [ownerKey]: {
          ownerKey,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: [ethToken],
          updatedAt: Date.now(),
        },
      },
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [{ networkId: 'evm--1', name: 'Ethereum', symbol: 'ETH' }],
        'indexed-account',
        undefined,
        'usd',
      );
    });

    expect(store.get(swapProPositionsCurrentOwnerKeyAtom())).toBe(ownerKey);
    expect(store.get(swapProPositionsDataOwnerKeyAtom())).toBe('');
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([]);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerKey].tokens,
    ).toEqual([ethToken]);
  });
});
