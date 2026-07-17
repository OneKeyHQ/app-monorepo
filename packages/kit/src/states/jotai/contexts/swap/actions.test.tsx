/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  ICancelSwapQuoteEventsV2Params,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchSpeedSwapQuoteV2Params,
  IFetchSpeedSwapQuoteV2Result,
  IFetchSwapQuoteEventsV2Params,
  ISwapNetwork,
  ISwapQuoteEvent,
  ISwapQuoteSessionEventV2,
  ISwapQuoteSessionStartResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapFetchCancelCause,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapActions } from './actions';
import {
  ProviderJotaiContextSwap,
  swapActiveSelectedFromTokenBalanceAtom,
  swapAlertsAtom,
  swapAmountInputTabSessionAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapLastNonLimitSelectedTokensAtom,
  swapLimitExpirationTimeAtom,
  swapLimitPartiallyFillAtom,
  swapLimitPriceUseRateAtom,
  swapManualSelectQuoteProvidersAtom,
  swapNetworks,
  swapProDirectionAtom,
  swapProInputAmountAtom,
  swapProPositionsCacheAtom,
  swapProPositionsRequestStateAtom,
  swapProSelectTokenAtom,
  swapProSliderValueAtom,
  swapProSupportNetworksTokenListAtom,
  swapProSupportNetworksTokenListLoadingAtom,
  swapProUseSelectBuyTokenAtom,
  swapQuoteActionLockAtom,
  swapQuoteCommittedStateAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteFetchingAtom,
  swapQuoteListAtom,
  swapQuoteProviderSelectionReadyAtom,
  swapQuoteSessionStateAtom,
  swapQuoteStreamingCurrentSelectAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedToTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapSpeedQuoteFetchingAtom,
  swapSpeedQuoteResultAtom,
  swapSpeedQuoteSessionStateAtom,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedFromTokenBalanceAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
  useSwapStockSelectedTokenAtom,
} from './atoms';
import { ESwapQuoteCommitPhase } from './quoteCommittedState';
import {
  ESwapQuoteUiPhase,
  buildSwapManualProviderSelectionIntent,
  buildSwapQuoteProviderKey,
  getSwapQuoteProgressState,
  isSwapQuoteEventFetching,
} from './quoteProgress';
import {
  buildSwapQuoteDisplayIntentFingerprint,
  buildSwapQuoteExecutionFingerprint,
} from './quoteSessionV2';

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
const mockGetGlobalDeriveTypeOfNetwork: jest.MockedFunction<
  (params: { networkId: string }) => Promise<string | undefined>
> = jest.fn();
const mockGetNetworkAccount: jest.MockedFunction<
  (params: {
    deriveType: string;
    indexedAccountId?: string;
    accountId?: string;
    dbAccount?: unknown;
    networkId: string;
  }) => Promise<INetworkAccount | undefined>
> = jest.fn();
const mockFetchQuotesEvents: jest.MockedFunction<
  (params: unknown) => Promise<void>
> = jest.fn();
const mockFetchQuotesEventsV2: jest.MockedFunction<
  (
    params: IFetchSwapQuoteEventsV2Params,
  ) => Promise<ISwapQuoteSessionStartResult>
> = jest.fn();
const mockCloseApproving: jest.MockedFunction<() => Promise<void>> = jest.fn();
const mockCancelFetchQuoteEvents: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockCancelFetchQuoteEventsV2: jest.MockedFunction<
  (params: ICancelSwapQuoteEventsV2Params) => Promise<boolean>
> = jest.fn();
const mockFetchSpeedSwapQuoteV2: jest.MockedFunction<
  (
    params: IFetchSpeedSwapQuoteV2Params,
  ) => Promise<IFetchSpeedSwapQuoteV2Result>
> = jest.fn();
const mockCancelFetchSpeedSwapQuoteV2: jest.MockedFunction<
  (params: { surfaceId: string; requestId: string }) => Promise<boolean>
> = jest.fn();
const mockSetSwapNetworksSortRawData: jest.MockedFunction<
  (params: { data: unknown[] }) => Promise<void>
> = jest.fn();
type IMockSupportSwapAccountsResult = {
  accountIdKey: string;
  swapSupportAccounts: {
    accountId: string;
    apiAddress: string;
    networkId: string;
  }[];
  supportAccountsFetchFailed: boolean;
};
const mockGetSupportSwapAllAccounts: jest.MockedFunction<
  (params: unknown) => Promise<IMockSupportSwapAccountsResult>
> = jest.fn();
const mockFetchSwapTokens: jest.MockedFunction<
  (params: {
    accountId?: string;
    throwOnError?: boolean;
  }) => Promise<ISwapToken[]>
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
      fetchQuotesEvents: (params: unknown) => mockFetchQuotesEvents(params),
      fetchQuotesEventsV2: (params: IFetchSwapQuoteEventsV2Params) =>
        mockFetchQuotesEventsV2(params),
      closeApproving: () => mockCloseApproving(),
      cancelFetchQuoteEvents: () => mockCancelFetchQuoteEvents(),
      cancelFetchQuoteEventsV2: (params: ICancelSwapQuoteEventsV2Params) =>
        mockCancelFetchQuoteEventsV2(params),
      fetchSpeedSwapQuoteV2: (params: IFetchSpeedSwapQuoteV2Params) =>
        mockFetchSpeedSwapQuoteV2(params),
      getSupportSwapAllAccounts: (params: unknown) =>
        mockGetSupportSwapAllAccounts(params),
      fetchSwapTokens: (params: {
        accountId?: string;
        throwOnError?: boolean;
      }) => mockFetchSwapTokens(params),
      cancelFetchSpeedSwapQuoteV2: (params: {
        surfaceId: string;
        requestId: string;
      }) => mockCancelFetchSpeedSwapQuoteV2(params),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params: { networkId: string }) =>
        mockGetGlobalDeriveTypeOfNetwork(params),
    },
    serviceAccount: {
      getNetworkAccount: (params: {
        deriveType: string;
        indexedAccountId?: string;
        accountId?: string;
        dbAccount?: unknown;
        networkId: string;
      }) => mockGetNetworkAccount(params),
    },
    simpleDb: {
      swapNetworksSort: {
        setRawData: (params: { data: unknown[] }) =>
          mockSetSwapNetworksSortRawData(params),
      },
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
const evmSwapNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
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

function buildFromAddressInfo({
  accountId,
  address,
  deriveType,
  networkId = 'evm--1',
}: {
  accountId: string;
  address: string;
  deriveType?: string;
  networkId?: string;
}): ISwapAddressInfo {
  const account: INetworkAccount = {
    ...evmAccount,
    id: accountId,
    address,
    addressDetail: {
      ...evmAccount.addressDetail,
      networkId,
      address,
      baseAddress: address,
      normalizedAddress: address,
      displayAddress: address,
    },
  };
  const accountInfo: IAccountSelectorActiveAccountInfo = {
    ...activeAccountInfo,
    account,
    deriveType: deriveType as IAccountSelectorActiveAccountInfo['deriveType'],
  };
  return {
    ...fromAddressInfo,
    address,
    networkId,
    accountInfo,
    activeAccount: accountInfo,
  };
}

function buildTargetNetworkAccount({
  accountId,
  address,
}: {
  accountId: string;
  address: string;
}): INetworkAccount {
  return {
    ...evmAccount,
    id: accountId,
    address,
    addressDetail: {
      ...evmAccount.addressDetail,
      networkId: 'evm--56',
      address,
      baseAddress: address,
      normalizedAddress: address,
      displayAddress: address,
    },
  };
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
    globalJotaiStorageReadyHandler.resolveReady(true);
    jest.clearAllMocks();
    mockFetchSwapTokenDetails.mockReset();
    mockGetSupportSwapAllAccounts.mockReset();
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      accountIdKey: '',
      swapSupportAccounts: [],
      supportAccountsFetchFailed: false,
    });
    mockFetchSwapTokens.mockReset();
    mockFetchSwapTokens.mockResolvedValue([]);
    mockGetGlobalDeriveTypeOfNetwork.mockReset();
    mockGetGlobalDeriveTypeOfNetwork.mockResolvedValue('default');
    mockGetNetworkAccount.mockReset();
    mockGetNetworkAccount.mockResolvedValue(undefined);
    mockSetSwapNetworksSortRawData.mockResolvedValue(undefined);
    mockCloseApproving.mockResolvedValue(undefined);
    mockCancelFetchQuoteEvents.mockResolvedValue(undefined);
    mockCancelFetchQuoteEventsV2.mockResolvedValue(true);
    mockCancelFetchSpeedSwapQuoteV2.mockResolvedValue(true);
    mockFetchSpeedSwapQuoteV2.mockImplementation(async ({ session }) => ({
      accepted: true,
      session,
      bgGeneration: 1,
      quotes: [],
    }));
    mockFetchQuotesEvents.mockResolvedValue(undefined);
    mockFetchQuotesEventsV2.mockImplementation(async ({ session }) => ({
      accepted: true,
      session,
      bgGeneration: 1,
    }));
    jest.spyOn(settingsAtom, 'get').mockResolvedValue({
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapSlippagePercentageCustomValue: 0,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapToAnotherAccountSwitchOn: false,
    });
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
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();

        return {
          actions,
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
  });

  it('settles a new token-detail owner to zero when the service returns no detail', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([]);
    const account = buildFromAddressInfo({
      accountId: 'account-empty',
      address: '0xempty',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, loading };
      },
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
    });

    expect(result.current.balance).toBe('0.0');
    expect(result.current.loading.from).toBe(false);
  });

  it('keeps a committed balance when a same-owner refresh returns no detail', async () => {
    mockFetchSwapTokenDetails
      .mockResolvedValueOnce([
        { balanceParsed: '10', price: '1', fiatValue: '10' },
      ])
      .mockResolvedValueOnce([]);
    const account = buildFromAddressInfo({
      accountId: 'account-a',
      address: '0xaaa',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, loading };
      },
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
    });

    expect(result.current.balance).toBe('10');
    expect(result.current.loading.from).toBe(false);
  });

  it('settles an overlapping same-owner refresh when no balance was committed yet', async () => {
    const firstRequest =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    const secondRequest =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    mockFetchSwapTokenDetails
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    const account = buildFromAddressInfo({
      accountId: 'account-overlap',
      address: '0xoverlap',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, loading };
      },
      { wrapper: createWrapper() },
    );

    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
    });
    act(() => {
      secondPromise = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
    });

    expect(result.current.balance).toBe('');
    expect(result.current.loading.from).toBe(true);

    await act(async () => {
      secondRequest.resolve([]);
      await secondPromise;
    });

    expect(result.current.balance).toBe('0.0');
    expect(result.current.loading.from).toBe(false);

    await act(async () => {
      firstRequest.resolve([
        { balanceParsed: '99', price: '1', fiatValue: '99' },
      ]);
      await firstPromise;
    });

    expect(result.current.balance).toBe('0.0');
    expect(result.current.loading.from).toBe(false);
  });

  it('keeps a newer account balance request loading when an older request resolves late', async () => {
    const requestA =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    const requestB =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    mockFetchSwapTokenDetails
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);
    const accountA = buildFromAddressInfo({
      accountId: 'account-a',
      address: '0xaaa',
    });
    const accountB = buildFromAddressInfo({
      accountId: 'account-b',
      address: '0xbbb',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, fromToken, loading };
      },
      {
        wrapper: createWrapper((store) => {
          store.set(swapSelectedFromTokenBalanceAtom(), 'account-a-cached');
        }),
      },
    );

    let accountARequest!: Promise<void>;
    let accountBRequest!: Promise<void>;
    act(() => {
      accountARequest = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        accountA,
        true,
      );
    });
    act(() => {
      accountBRequest = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        accountB,
        true,
      );
    });

    expect(result.current.balance).toBe('');
    expect(result.current.loading.from).toBe(true);

    await act(async () => {
      requestA.resolve([
        { balanceParsed: '111', price: '1', fiatValue: '111' },
      ]);
      await accountARequest;
    });

    expect(result.current.balance).toBe('');
    expect(result.current.fromToken?.accountAddress).not.toBe('0xaaa');
    expect(result.current.loading.from).toBe(true);

    await act(async () => {
      requestB.resolve([
        { balanceParsed: '222', price: '2', fiatValue: '444' },
      ]);
      await accountBRequest;
    });

    expect(result.current.balance).toBe('222');
    expect(result.current.fromToken?.accountAddress).toBe('0xbbb');
    expect(result.current.loading.from).toBe(false);
  });

  it('preserves a visible balance while refreshing the same semantic owner', async () => {
    const refreshRequest =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    mockFetchSwapTokenDetails
      .mockResolvedValueOnce([
        { balanceParsed: '10', price: '1', fiatValue: '10' },
      ])
      .mockImplementationOnce(() => refreshRequest.promise);
    const account = buildFromAddressInfo({
      accountId: 'account-a',
      address: '0xaaa',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, loading };
      },
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
    });
    expect(result.current.balance).toBe('10');

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        account,
        true,
      );
    });

    expect(result.current.balance).toBe('10');
    expect(result.current.loading.from).toBe(true);

    await act(async () => {
      refreshRequest.resolve([
        { balanceParsed: '11', price: '1', fiatValue: '11' },
      ]);
      await refreshPromise;
    });

    expect(result.current.balance).toBe('11');
    expect(result.current.loading.from).toBe(false);
  });

  it('rejects an older TO account resolution without clearing the newer request loading state', async () => {
    const accountResolutionA = createDeferred<INetworkAccount | undefined>();
    const accountResolutionB = createDeferred<INetworkAccount | undefined>();
    const detailRequestB =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    mockGetNetworkAccount
      .mockImplementationOnce(() => accountResolutionA.promise)
      .mockImplementationOnce(() => accountResolutionB.promise);
    mockFetchSwapTokenDetails.mockImplementationOnce(
      () => detailRequestB.promise,
    );
    const accountA = buildFromAddressInfo({
      accountId: 'account-a',
      address: '0xaaa',
    });
    const accountB = buildFromAddressInfo({
      accountId: 'account-b',
      address: '0xbbb',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [toToken] = useSwapSelectToTokenAtom();
        const [balance] = useSwapSelectedToTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, loading, toToken };
      },
      {
        wrapper: createWrapper((store) => {
          store.set(swapSelectToTokenAtom(), bnbToken);
          store.set(swapSelectedToTokenBalanceAtom(), 'old-to-balance');
        }),
      },
    );

    let accountARequest!: Promise<void>;
    let accountBRequest!: Promise<void>;
    await act(async () => {
      accountARequest = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.TO,
        accountA,
        true,
      );
      await Promise.resolve();
    });
    await act(async () => {
      accountBRequest = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.TO,
        accountB,
        true,
      );
      await Promise.resolve();
    });
    expect(mockGetNetworkAccount).toHaveBeenCalledTimes(2);

    await act(async () => {
      accountResolutionB.resolve(
        buildTargetNetworkAccount({
          accountId: 'target-b',
          address: '0xtarget-b',
        }),
      );
      await Promise.resolve();
    });
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1);

    await act(async () => {
      accountResolutionA.resolve(
        buildTargetNetworkAccount({
          accountId: 'target-a',
          address: '0xtarget-a',
        }),
      );
      await accountARequest;
    });

    expect(result.current.balance).toBe('');
    expect(result.current.loading.to).toBe(true);
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1);

    await act(async () => {
      detailRequestB.resolve([
        { balanceParsed: '22', price: '1', fiatValue: '22' },
      ]);
      await accountBRequest;
    });

    expect(result.current.balance).toBe('22');
    expect(result.current.toToken?.accountAddress).toBe('0xtarget-b');
    expect(result.current.loading.to).toBe(false);
  });

  it('clears and rejects the old TO balance when the target derive owner changes', async () => {
    const deriveARefresh =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    const deriveBRequest =
      createDeferred<
        { balanceParsed?: string; price?: string; fiatValue?: string }[]
      >();
    mockGetNetworkAccount.mockResolvedValue(
      buildTargetNetworkAccount({
        accountId: 'target-account',
        address: '0xtarget',
      }),
    );
    mockFetchSwapTokenDetails
      .mockResolvedValueOnce([
        { balanceParsed: '10', price: '1', fiatValue: '10' },
      ])
      .mockImplementationOnce(() => deriveARefresh.promise)
      .mockImplementationOnce(() => deriveBRequest.promise);
    const sourceAccount = buildFromAddressInfo({
      accountId: 'source-account',
      address: '0xsource',
    });
    const targetDeriveA = buildFromAddressInfo({
      accountId: 'target-account',
      address: '0xtarget',
      deriveType: 'derive-a',
      networkId: 'evm--56',
    });
    const targetDeriveB = buildFromAddressInfo({
      accountId: 'target-account',
      address: '0xtarget',
      deriveType: 'derive-b',
      networkId: 'evm--56',
    });

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balance] = useSwapSelectedToTokenBalanceAtom();
        const [loading] = useSwapSelectTokenDetailFetchingAtom();
        return { actions, balance, loading };
      },
      {
        wrapper: createWrapper((store) => {
          store.set(swapSelectToTokenAtom(), bnbToken);
        }),
      },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.TO,
        sourceAccount,
        true,
        targetDeriveA,
      );
    });
    expect(result.current.balance).toBe('10');

    let deriveAPromise!: Promise<void>;
    let deriveBPromise!: Promise<void>;
    act(() => {
      deriveAPromise = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.TO,
        sourceAccount,
        true,
        targetDeriveA,
      );
    });
    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2);
    });
    act(() => {
      deriveBPromise = result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.TO,
        sourceAccount,
        true,
        targetDeriveB,
      );
    });
    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(3);
    });

    expect(result.current.balance).toBe('');
    expect(result.current.loading.to).toBe(true);

    await act(async () => {
      deriveARefresh.resolve([
        { balanceParsed: '11', price: '1', fiatValue: '11' },
      ]);
      await deriveAPromise;
    });
    expect(result.current.balance).toBe('');
    expect(result.current.loading.to).toBe(true);

    await act(async () => {
      deriveBRequest.resolve([
        { balanceParsed: '20', price: '1', fiatValue: '20' },
      ]);
      await deriveBPromise;
    });
    expect(result.current.balance).toBe('20');
    expect(result.current.loading.to).toBe(false);
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
        {
          allowNoConnectWallet: true,
        },
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
          {
            allowNoConnectWallet: true,
          },
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
          {
            allowNoConnectWallet: true,
          },
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
          {
            allowNoConnectWallet: true,
          },
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
          {
            allowNoConnectWallet: true,
          },
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

  it('does not relabel previous Stock provider quotes as the current event', async () => {
    const oldQuote = {
      quoteId: 'old-stock-provider-quote',
      eventId: 'previous-event',
      fromAmount: '1000',
      toAmount: '10',
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

    await act(async () => {
      result.current.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: {
          fromNetworkId: usdcToken.networkId,
          fromTokenAddress: usdcToken.contractAddress,
          fromTokenAmount: '1000.0',
          protocol: EProtocolOfExchange.STOCK,
          slippagePercentage: 0.5,
          toNetworkId: appleStockToken.networkId,
          toTokenAddress: appleStockToken.contractAddress,
        },
        tokenPairs: {
          fromToken: usdcToken,
          toToken: appleStockToken,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual([
      expect.objectContaining({
        eventId: 'normalized-event',
        quoteId: 'new-stock-provider-quote',
      }),
    ]);
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

  it('revokes shared amounts and the active balance before entering Stock', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '0.213862',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '123.45',
        isInput: false,
      });
      storeInstance.set(swapSelectedFromTokenBalanceAtom(), '9.9');
      storeInstance.set(swapSelectedToTokenBalanceAtom(), '8.8');
      storeInstance.set(swapStockSelectedFromTokenBalanceAtom(), '7.7');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let switchPromise: Promise<void> | undefined;
    act(() => {
      switchPromise = result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.STOCK,
        'evm--56',
      );
    });

    // All writes above happen in the same Jotai transaction before the target
    // tab can render; no passive React effect is required to hide the old owner.
    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('9.9');
    expect(store.get(swapSelectedToTokenBalanceAtom())).toBe('');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('');

    await act(async () => switchPromise);
  });

  it('revokes Stock-owned amounts and balance before leaving Stock', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '25',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '0.12',
        isInput: false,
      });
      storeInstance.set(swapSelectedFromTokenBalanceAtom(), '9.9');
      storeInstance.set(swapSelectedToTokenBalanceAtom(), '2');
      storeInstance.set(swapStockSelectedFromTokenBalanceAtom(), '100');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let switchPromise: Promise<void> | undefined;
    act(() => {
      switchPromise = result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('9.9');
    expect(store.get(swapSelectedToTokenBalanceAtom())).toBe('');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('9.9');

    await act(async () => switchPromise);
  });

  it('clears every amount owner on each visible Swap tab transition', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '12.3',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '45.6',
        isInput: false,
      });
      storeInstance.set(swapProInputAmountAtom(), '78.9');
      storeInstance.set(swapProSliderValueAtom(), 50);
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        fromTokenAmount: '12.3',
        kind: ESwapQuoteKind.BUY,
        type: ESwapTabSwitchType.SWAP,
      });
      storeInstance.set(swapSpeedQuoteFetchingAtom(), true);
      storeInstance.set(swapSpeedQuoteSessionStateAtom(), {
        surfaceId: 'speed-surface',
        intentRevision: 1,
        activeSession: {
          surfaceId: 'speed-surface',
          requestId: 'speed-request',
          intentRevision: 1,
        },
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.LIMIT);
    });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapProInputAmountAtom())).toBe('');
    expect(store.get(swapProSliderValueAtom())).toBe(0);
    expect(store.get(swapAmountInputTabSessionAtom())).toBe(1);
    expect(store.get(swapQuoteActionLockAtom())).toEqual({
      actionLock: false,
    });
    expect(store.get(swapSpeedQuoteFetchingAtom())).toBe(false);
    expect(
      store.get(swapSpeedQuoteSessionStateAtom()).activeSession,
    ).toBeUndefined();
    expect(mockCancelFetchSpeedSwapQuoteV2).toHaveBeenCalledWith({
      surfaceId: 'speed-surface',
      requestId: 'speed-request',
    });

    act(() => {
      store.set(swapFromTokenAmountAtom(), {
        value: '1.25',
        isInput: true,
      });
      store.set(swapToTokenAmountAtom(), {
        value: '2.5',
        isInput: false,
      });
      store.set(swapProInputAmountAtom(), '3.75');
      store.set(swapProSliderValueAtom(), 75);
    });
    await act(async () => {
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.SWAP);
    });

    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('');
    expect(store.get(swapProInputAmountAtom())).toBe('');
    expect(store.get(swapProSliderValueAtom())).toBe(0);
    expect(store.get(swapAmountInputTabSessionAtom())).toBe(2);
  });

  it('keeps amount drafts during internal BRIDGE to SWAP normalization', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.BRIDGE);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1.5',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '3',
        isInput: false,
      });
      storeInstance.set(swapProInputAmountAtom(), '4.5');
      storeInstance.set(swapProSliderValueAtom(), 25);
      storeInstance.set(swapAmountInputTabSessionAtom(), 7);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.SWAP);
    });

    expect(store.get(swapFromTokenAmountAtom()).value).toBe('1.5');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('3');
    expect(store.get(swapProInputAmountAtom())).toBe('4.5');
    expect(store.get(swapProSliderValueAtom())).toBe(25);
    expect(store.get(swapAmountInputTabSessionAtom())).toBe(7);
  });

  it('does not clear amount drafts when the active visible tab is reapplied', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '8.25',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '16.5',
        isInput: false,
      });
      storeInstance.set(swapAmountInputTabSessionAtom(), 3);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(ESwapTabSwitchType.SWAP);
    });

    expect(store.get(swapFromTokenAmountAtom()).value).toBe('8.25');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('16.5');
    expect(store.get(swapAmountInputTabSessionAtom())).toBe(3);
  });

  it('retains the committed display but revokes execution when an AUTO suggestion changes the exact request fingerprint', async () => {
    const previousQuote = {
      quoteId: 'quote-auto-previous',
      eventId: 'event-auto-previous',
      fromAmount: '1',
      toAmount: '1.2',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.SWAP,
      fromTokenInfo: ethToken,
      toTokenInfo: usdcToken,
      info: {
        provider: 'provider-auto',
        providerName: 'Provider Auto',
      },
    } as IFetchQuoteResult;
    const previousRequest = {
      fromToken: ethToken,
      toToken: usdcToken,
      fromTokenAmount: '1',
      toTokenAmount: '',
      userAddress: '0xabc',
      slippagePercentage: 0.5,
      autoSlippage: true,
      accountId: evmAccount.id,
      kind: ESwapQuoteKind.SELL,
      protocol: ESwapTabSwitchType.SWAP,
      incognito: false,
    };
    const previousExecutionFingerprint =
      buildSwapQuoteExecutionFingerprint(previousRequest);
    const previousDisplayFingerprint =
      buildSwapQuoteDisplayIntentFingerprint(previousRequest);
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: 'main:auto-refresh',
        intentRevision: 3,
        lastSequence: 1,
        phase: 'settled',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Settled,
        intentFingerprint: previousExecutionFingerprint,
        displayIntentFingerprint: previousDisplayFingerprint,
        requestId: 'request-auto-previous',
        pendingQuotes: [],
        settledQuotes: [previousQuote],
        displayQuote: previousQuote,
        executableQuote: previousQuote,
      });
      storeInstance.set(
        swapManualSelectQuoteProvidersAtom(),
        buildSwapManualProviderSelectionIntent(previousQuote),
      );
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 1.2 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    });

    await waitFor(() =>
      expect(store.get(swapQuoteCommittedStateAtom()).phase).toBe(
        ESwapQuoteCommitPhase.Requesting,
      ),
    );
    const refreshingState = store.get(swapQuoteCommittedStateAtom());
    expect(refreshingState.intentFingerprint).not.toBe(
      previousExecutionFingerprint,
    );
    expect(refreshingState.displayIntentFingerprint).toBe(
      previousDisplayFingerprint,
    );
    expect(refreshingState.displayQuote).toBe(previousQuote);
    expect(refreshingState.executableQuote).toBeUndefined();

    const activeSession = store.get(swapQuoteSessionStateAtom()).activeSession;
    expect(activeSession).toBeDefined();
    if (!activeSession) {
      return;
    }
    const fallbackQuote = {
      ...previousQuote,
      quoteId: 'quote-auto-fallback',
      eventId: 'event-auto-refresh',
      toAmount: '1.1',
      info: {
        provider: 'provider-fallback',
        providerName: 'Provider Fallback',
      },
    } as IFetchQuoteResult;
    const refreshedPreferredQuote = {
      ...previousQuote,
      quoteId: 'quote-auto-preferred-refresh',
      eventId: fallbackQuote.eventId,
      toAmount: '1.15',
    } as IFetchQuoteResult;
    const laterPreferredQuote = {
      ...refreshedPreferredQuote,
      quoteId: 'quote-auto-preferred-later',
      toAmount: '1.05',
    } as IFetchQuoteResult;

    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        session: activeSession,
        bgGeneration: 1,
        sequence: 1,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 1.2,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: {
          fromToken: ethToken,
          toToken: usdcToken,
        },
        kind: 'message',
        data: JSON.stringify({
          totalQuoteCount: 2,
          eventId: fallbackQuote.eventId,
        }),
        lastEventId: null,
      });
      result.current.quoteEventHandlerV2({
        version: 2,
        session: activeSession,
        bgGeneration: 1,
        sequence: 2,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 1.2,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: {
          fromToken: ethToken,
          toToken: usdcToken,
        },
        kind: 'message',
        data: JSON.stringify({ data: [fallbackQuote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({ quoteId: fallbackQuote.quoteId }),
    );
    expect(store.get(swapQuoteCommittedStateAtom()).executableQuote).toEqual(
      expect.objectContaining({ quoteId: fallbackQuote.quoteId }),
    );

    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        session: activeSession,
        bgGeneration: 1,
        sequence: 3,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 1.2,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: {
          fromToken: ethToken,
          toToken: usdcToken,
        },
        kind: 'message',
        data: JSON.stringify({ data: [refreshedPreferredQuote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: refreshedPreferredQuote.quoteId,
        toAmount: refreshedPreferredQuote.toAmount,
      }),
    );
    expect(store.get(swapQuoteCommittedStateAtom()).executableQuote).toEqual(
      expect.objectContaining({ quoteId: refreshedPreferredQuote.quoteId }),
    );

    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        session: activeSession,
        bgGeneration: 1,
        sequence: 4,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 1.2,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: {
          fromToken: ethToken,
          toToken: usdcToken,
        },
        kind: 'message',
        data: JSON.stringify({ data: [laterPreferredQuote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: refreshedPreferredQuote.quoteId,
        toAmount: refreshedPreferredQuote.toAmount,
      }),
    );
    expect(store.get(swapQuoteStreamingCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: laterPreferredQuote.quoteId,
        toAmount: laterPreferredQuote.toAmount,
      }),
    );

    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        session: activeSession,
        bgGeneration: 1,
        sequence: 5,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 1.2,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: {
          fromToken: ethToken,
          toToken: usdcToken,
        },
        kind: 'done',
      });
    });

    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: laterPreferredQuote.quoteId,
        toAmount: laterPreferredQuote.toAmount,
      }),
    );
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
        toToken: stockTokenA,
        toTokenAmount: '',
        type: ESwapTabSwitchType.STOCK,
      }),
    );

    await waitFor(() =>
      expect(mockFetchQuotesEventsV2).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            accountId: evmAccount.id,
            autoSlippage: true,
            fromToken: usdcToken,
            fromTokenAmount: '1',
            incognito: false,
            protocol: ESwapTabSwitchType.STOCK,
            slippagePercentage: 0.5,
            toToken: stockTokenA,
            userAddress: '0xabc',
          }),
          session: expect.objectContaining({
            intentRevision: expect.any(Number),
            requestId: expect.any(String),
            surfaceId: expect.any(String),
          }),
        }),
      ),
    );
  });

  it('starts a new LIMIT session when order semantics change', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapLimitPriceUseRateAtom(), {
        fromToken: bnbToken,
        toToken: usdcToken,
        rate: '10',
      });
      storeInstance.set(swapLimitExpirationTimeAtom(), {
        label: '1 hour',
        value: '3600',
      });
      storeInstance.set(swapLimitPartiallyFillAtom(), {
        label: 'Enabled',
        value: true,
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
    await waitFor(() => expect(mockFetchQuotesEventsV2).toHaveBeenCalled());
    const firstSession = store.get(swapQuoteSessionStateAtom()).activeSession;
    const firstLimitSettingsKey = store.get(
      swapQuoteActionLockAtom(),
    ).limitSettingsKey;
    expect(mockFetchQuotesEventsV2).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          expirationTime: 3600,
          limitPartiallyFillable: true,
          protocol: ESwapTabSwitchType.LIMIT,
          userMarketPriceRate: '10',
        }),
      }),
    );

    act(() => {
      store.set(swapLimitPriceUseRateAtom(), {
        fromToken: bnbToken,
        toToken: usdcToken,
        rate: '11',
      });
      store.set(swapLimitExpirationTimeAtom(), {
        label: '2 hours',
        value: '7200',
      });
      store.set(swapLimitPartiallyFillAtom(), {
        label: 'Disabled',
        value: false,
      });
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
      expect(mockFetchQuotesEventsV2).toHaveBeenCalledTimes(2),
    );
    const secondSession = store.get(swapQuoteSessionStateAtom()).activeSession;
    expect(secondSession?.fingerprint).not.toBe(firstSession?.fingerprint);
    expect(store.get(swapQuoteActionLockAtom()).limitSettingsKey).not.toBe(
      firstLimitSettingsKey,
    );
    expect(mockFetchQuotesEventsV2).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          expirationTime: 7200,
          limitPartiallyFillable: false,
          protocol: ESwapTabSwitchType.LIMIT,
          userMarketPriceRate: '11',
        }),
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

  it('accepts Stock quote event results before the total count event arrives', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
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
  });

  it('enables provider selection and Review for a Stock V2 quote before total count arrives', () => {
    const session = {
      surfaceId: 'main:stock:provider-selection',
      requestId: 'request-stock-early',
      fingerprint: 'fingerprint-stock-early',
      intentRevision: 1,
    };
    const quote = {
      quoteId: 'early-stock-v2-quote',
      eventId: 'early-stock-v2-event',
      fromAmount: '21',
      toAmount: '0.0683',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: stockTokenA,
      info: {
        provider: 'stock',
        providerName: 'Stock',
      },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const eventBase = {
      version: 2,
      session,
      bgGeneration: 1,
      emittedAt: 1,
      params: {
        fromNetworkId: usdcToken.networkId,
        fromTokenAddress: usdcToken.contractAddress,
        fromTokenAmount: '21',
        protocol: EProtocolOfExchange.STOCK,
        slippagePercentage: 0.5,
        toNetworkId: stockTokenA.networkId,
        toTokenAddress: stockTokenA.contractAddress,
      },
      tokenPairs: {
        fromToken: usdcToken,
        toToken: stockTokenA,
      },
    } as const;

    act(() => {
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'message',
        sequence: 1,
        data: JSON.stringify({ data: [quote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: quote.eventId,
      count: 1,
      totalQuoteCountReceived: false,
    });
    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      quote.quoteId,
    );
    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote?.quoteId,
    ).toBe(quote.quoteId);

    act(() => {
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'done',
        sequence: 2,
      });
    });

    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(false);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      quote.quoteId,
    );
  });

  it('enables Swap Review early and retains AUTO slippage after settlement', () => {
    const session = {
      surfaceId: 'main:swap:provider-selection',
      requestId: 'request-swap-early',
      fingerprint: 'fingerprint-swap-early',
      intentRevision: 1,
    };
    const quote = {
      quoteId: 'early-swap-v2-quote',
      eventId: 'early-swap-v2-event',
      fromAmount: '21',
      toAmount: '0.01',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.SWAP,
      fromTokenInfo: usdcToken,
      toTokenInfo: bnbToken,
      info: {
        provider: 'swap-provider',
        providerName: 'Swap Provider',
      },
    } as IFetchQuoteResult;
    const laterQuote = {
      ...quote,
      quoteId: 'early-swap-v2-quote-later',
      toAmount: '0.0097',
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const eventBase = {
      version: 2,
      session,
      bgGeneration: 1,
      emittedAt: 1,
      params: {
        fromNetworkId: usdcToken.networkId,
        fromTokenAddress: usdcToken.contractAddress,
        fromTokenAmount: '21',
        protocol: EProtocolOfExchange.SWAP,
        slippagePercentage: 0.5,
        toNetworkId: bnbToken.networkId,
        toTokenAddress: bnbToken.contractAddress,
      },
      tokenPairs: {
        fromToken: usdcToken,
        toToken: bnbToken,
      },
    } as const;

    act(() => {
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'message',
        sequence: 1,
        data: JSON.stringify({
          totalQuoteCount: 2,
          eventId: quote.eventId,
        }),
        lastEventId: null,
      });
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'message',
        sequence: 2,
        data: JSON.stringify({ data: [quote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: quote.eventId,
      count: 2,
      totalQuoteCountReceived: true,
    });
    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      quote.quoteId,
    );
    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote?.quoteId,
    ).toBe(quote.quoteId);

    act(() => {
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'message',
        sequence: 3,
        data: JSON.stringify({
          autoSuggestedSlippage: 1.2,
          eventId: quote.eventId,
          fromNetworkId: usdcToken.networkId,
          fromTokenAddress: usdcToken.contractAddress,
          toNetworkId: bnbToken.networkId,
          toTokenAddress: bnbToken.contractAddress,
        }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteCurrentSelectAtom())?.autoSuggestedSlippage).toBe(
      1.2,
    );

    act(() => {
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'message',
        sequence: 4,
        data: JSON.stringify({ data: [laterQuote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteListAtom())[0]).toEqual(
      expect.objectContaining({
        quoteId: laterQuote.quoteId,
        toAmount: laterQuote.toAmount,
      }),
    );
    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: quote.quoteId,
        toAmount: quote.toAmount,
        autoSuggestedSlippage: 1.2,
      }),
    );
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      buildSwapQuoteProviderKey(quote),
    ]);
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: store.get(swapQuoteEventTotalCountAtom()),
        currentEventReceivedCount: store.get(
          swapQuoteCurrentEventReceivedCountAtom(),
        ),
        quoteEventCompleted: store.get(swapQuoteEventCompletedAtom()),
      }),
    ).toBe(true);

    act(() => {
      result.current.quoteEventHandlerV2({
        ...eventBase,
        kind: 'done',
        sequence: 5,
      });
    });

    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(false);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      laterQuote.quoteId,
    );
    expect(store.get(swapQuoteCurrentSelectAtom())?.toAmount).toBe(
      laterQuote.toAmount,
    );
    expect(store.get(swapQuoteCurrentSelectAtom())?.autoSuggestedSlippage).toBe(
      1.2,
    );
    expect(
      store.get(swapQuoteCommittedStateAtom()).settledQuotes[0]
        ?.autoSuggestedSlippage,
    ).toBe(1.2);
  });

  it('keeps a limit-violating first SSE quote non-executable', () => {
    const session = {
      surfaceId: 'main:swap:limit-guard',
      requestId: 'request-swap-limit-guard',
      fingerprint: 'fingerprint-swap-limit-guard',
      intentRevision: 1,
    };
    const quote = {
      quoteId: 'swap-limit-guard-quote',
      eventId: 'swap-limit-guard-event',
      fromAmount: '21',
      toAmount: '0.01',
      kind: ESwapQuoteKind.SELL,
      limit: { min: '50' },
      protocol: EProtocolOfExchange.SWAP,
      fromTokenInfo: usdcToken,
      toTokenInfo: bnbToken,
      info: {
        provider: 'swap-provider',
        providerName: 'Swap Provider',
      },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        session,
        bgGeneration: 1,
        sequence: 1,
        emittedAt: 1,
        params: {
          fromNetworkId: usdcToken.networkId,
          fromTokenAddress: usdcToken.contractAddress,
          fromTokenAmount: '21',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 0.5,
          toNetworkId: bnbToken.networkId,
          toTokenAddress: bnbToken.contractAddress,
        },
        tokenPairs: {
          fromToken: usdcToken,
          toToken: bnbToken,
        },
        kind: 'message',
        data: JSON.stringify({ data: [quote] }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual([quote]);
    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(false);
    expect(store.get(swapQuoteCurrentSelectAtom())).toBeUndefined();
    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote,
    ).toBeUndefined();
  });

  it('clears speed quote loading when the response amount is stale', async () => {
    const deferred = createDeferred<IFetchSpeedSwapQuoteV2Result>();
    mockFetchSpeedSwapQuoteV2.mockReturnValueOnce(deferred.promise);
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapProDirectionAtom(), ESwapDirection.BUY);
      storeInstance.set(swapProSelectTokenAtom(), bnbToken);
      storeInstance.set(swapProUseSelectBuyTokenAtom(), {
        ...usdcToken,
        speedSwapDefaultAmount: [],
      });
      storeInstance.set(swapProInputAmountAtom(), '1');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteSpeedAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        '0xabc',
      );
    });
    await waitFor(() => expect(mockFetchSpeedSwapQuoteV2).toHaveBeenCalled());
    const session = mockFetchSpeedSwapQuoteV2.mock.calls[0][0].session;
    act(() => {
      store.set(swapProInputAmountAtom(), '2');
    });
    await act(async () => {
      deferred.resolve({
        accepted: true,
        session,
        bgGeneration: 1,
        quotes: [
          {
            info: { provider: 'provider', providerName: 'Provider' },
            fromTokenInfo: usdcToken,
            toTokenInfo: bnbToken,
            fromAmount: '1',
            toAmount: '0.1',
          },
        ],
      });
      await deferred.promise;
    });

    await waitFor(() => {
      expect(store.get(swapSpeedQuoteFetchingAtom())).toBe(false);
    });
    expect(store.get(swapSpeedQuoteResultAtom())).toBeUndefined();
    expect(
      store.get(swapSpeedQuoteSessionStateAtom()).activeSession,
    ).toBeUndefined();
  });

  it('invalidates and exactly cancels the old speed quote when tokens become incomplete', async () => {
    const deferred = createDeferred<IFetchSpeedSwapQuoteV2Result>();
    mockFetchSpeedSwapQuoteV2.mockReturnValueOnce(deferred.promise);
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapProDirectionAtom(), ESwapDirection.BUY);
      storeInstance.set(swapProSelectTokenAtom(), bnbToken);
      storeInstance.set(swapProUseSelectBuyTokenAtom(), {
        ...usdcToken,
        speedSwapDefaultAmount: [],
      });
      storeInstance.set(swapProInputAmountAtom(), '1');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteSpeedAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        '0xabc',
      );
    });
    await waitFor(() => expect(mockFetchSpeedSwapQuoteV2).toHaveBeenCalled());
    const session = mockFetchSpeedSwapQuoteV2.mock.calls[0][0].session;
    act(() => {
      store.set(swapProSelectTokenAtom(), undefined);
    });
    await act(async () => {
      await result.current.quoteSpeedAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        '0xabc',
      );
    });

    expect(mockCancelFetchSpeedSwapQuoteV2).toHaveBeenCalledWith({
      surfaceId: session.surfaceId,
      requestId: session.requestId,
    });
    expect(store.get(swapSpeedQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapSpeedQuoteResultAtom())).toBeUndefined();
    expect(
      store.get(swapSpeedQuoteSessionStateAtom()).activeSession,
    ).toBeUndefined();

    await act(async () => {
      deferred.resolve({
        accepted: true,
        session,
        bgGeneration: 1,
        quotes: [
          {
            info: { provider: 'late', providerName: 'Late' },
            fromTokenInfo: usdcToken,
            toTokenInfo: bnbToken,
            fromAmount: '1',
            toAmount: '0.1',
          },
        ],
      });
      await deferred.promise;
    });
    expect(store.get(swapSpeedQuoteResultAtom())).toBeUndefined();
  });

  it('clears speed quote loading when the current request is cancelled', async () => {
    // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- needs standard Error cause semantics
    const cancelError = new Error('speed quote cancelled', {
      cause: ESwapFetchCancelCause.SWAP_SPEED_QUOTE_CANCEL,
    });
    mockFetchSpeedSwapQuoteV2.mockRejectedValueOnce(cancelError);
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapProDirectionAtom(), ESwapDirection.BUY);
      storeInstance.set(swapProSelectTokenAtom(), bnbToken);
      storeInstance.set(swapProUseSelectBuyTokenAtom(), {
        ...usdcToken,
        speedSwapDefaultAmount: [],
      });
      storeInstance.set(swapProInputAmountAtom(), '1');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.quoteSpeedAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        '0xabc',
      );
    });

    await waitFor(() => {
      expect(store.get(swapSpeedQuoteFetchingAtom())).toBe(false);
    });
    expect(
      store.get(swapSpeedQuoteSessionStateAtom()).activeSession,
    ).toBeUndefined();
  });

  it('marks the current quote request failed when its start RPC rejects without an event', async () => {
    mockFetchQuotesEventsV2.mockRejectedValueOnce(
      new Error('quote transport start failed'),
    );
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
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

    await waitFor(() => {
      expect(store.get(swapQuoteCommittedStateAtom()).phase).toBe(
        ESwapQuoteCommitPhase.Error,
      );
    });
    expect(store.get(swapQuoteEventErrorAtom())).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        fromToken: ethToken,
        toToken: usdcToken,
        fromTokenAmount: '1',
      }),
    );
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
  });

  it('terminates the current quote request when the background rejects its lease', async () => {
    mockFetchQuotesEventsV2.mockImplementationOnce(async ({ session }) => ({
      accepted: false,
      session,
      bgGeneration: 2,
    }));
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
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

    await waitFor(() => {
      expect(store.get(swapQuoteCommittedStateAtom()).phase).toBe(
        ESwapQuoteCommitPhase.Error,
      );
    });
    expect(store.get(swapQuoteSessionStateAtom()).phase).toBe('cancelled');
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapQuoteEventErrorAtom())).toBeUndefined();
    expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(false);
    expect(store.get(swapQuoteCurrentSelectAtom())).toBeUndefined();
  });

  it('keeps an authoritative zero-provider response settled after exact transport close', () => {
    const session = {
      surfaceId: 'main:swap:zero-provider',
      requestId: 'request-zero-provider',
      fingerprint: 'fingerprint-zero-provider',
      intentRevision: 2,
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteFetchingAtom(), true);
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        kind: 'message',
        session,
        bgGeneration: 1,
        sequence: 1,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 0.5,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: { fromToken: ethToken, toToken: usdcToken },
        data: JSON.stringify({
          eventId: 'event-zero-provider',
          totalQuoteCount: 0,
        }),
        lastEventId: null,
      });
    });

    expect(store.get(swapQuoteCommittedStateAtom())).toEqual(
      expect.objectContaining({
        phase: ESwapQuoteCommitPhase.Settled,
        pendingQuotes: [],
        settledQuotes: [],
        executableQuote: undefined,
      }),
    );
    expect(store.get(swapQuoteSessionStateAtom())).toEqual(
      expect.objectContaining({ activeSession: undefined, phase: 'cancelled' }),
    );
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())).toBeUndefined();
    expect(mockCancelFetchQuoteEventsV2).toHaveBeenCalledWith({
      surfaceId: session.surfaceId,
      requestId: session.requestId,
    });

    const quoteEventTotalCount = store.get(swapQuoteEventTotalCountAtom());
    const quoteEventFetching = isSwapQuoteEventFetching({
      quoteEventTotalCount,
      currentEventReceivedCount: store.get(
        swapQuoteCurrentEventReceivedCountAtom(),
      ),
      quoteEventCompleted: store.get(swapQuoteEventCompletedAtom()),
    });
    expect(
      getSwapQuoteProgressState({
        quoteLoading: store.get(swapQuoteFetchingAtom()),
        quoteEventFetching,
        quoteCurrentSelect: store.get(swapQuoteCurrentSelectAtom()),
        quoteEventTotalCount,
        quoteEventCompleted: store.get(swapQuoteEventCompletedAtom()),
        quoteEventError: store.get(swapQuoteEventErrorAtom()),
      }).phase,
    ).toBe(ESwapQuoteUiPhase.ZeroProvider);
  });

  it('keeps reset quote state idle when a late V2 event arrives', async () => {
    const session = {
      surfaceId: 'main:swap:reset',
      requestId: 'request-reset',
      fingerprint: 'fingerprint-reset',
      intentRevision: 3,
    };
    const lateQuote = {
      quoteId: 'late-reset-quote',
      fromAmount: '1',
      toAmount: '2',
      fromTokenInfo: ethToken,
      toTokenInfo: usdcToken,
      info: { provider: 'late', providerName: 'Late' },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.resetQuoteAction();
    });
    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        kind: 'message',
        session,
        bgGeneration: 1,
        sequence: 1,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 0.5,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: { fromToken: ethToken, toToken: usdcToken },
        data: JSON.stringify({ data: [lateQuote] }),
        lastEventId: null,
      });
    });

    expect(mockCancelFetchQuoteEventsV2).toHaveBeenCalledWith({
      surfaceId: session.surfaceId,
      requestId: session.requestId,
    });
    expect(
      store.get(swapQuoteSessionStateAtom()).activeSession,
    ).toBeUndefined();
    expect(store.get(swapQuoteListAtom())).toEqual([]);
    expect(store.get(swapQuoteCommittedStateAtom())).toEqual(
      expect.objectContaining({
        phase: ESwapQuoteCommitPhase.Idle,
        pendingQuotes: [],
      }),
    );
  });

  it('does not revive an old protocol quote after switching tabs', async () => {
    const session = {
      surfaceId: 'main:swap:tab-switch',
      requestId: 'request-old-swap',
      fingerprint: 'fingerprint-old-swap',
      intentRevision: 4,
    };
    const lateQuote = {
      quoteId: 'late-old-protocol-quote',
      fromAmount: '1',
      toAmount: '2',
      fromTokenInfo: ethToken,
      toTokenInfo: usdcToken,
      info: { provider: 'late', providerName: 'Late' },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapTypeSwitchAction(
        ESwapTabSwitchType.STOCK,
        'evm--56',
      );
    });
    act(() => {
      result.current.quoteEventHandlerV2({
        version: 2,
        kind: 'message',
        session,
        bgGeneration: 1,
        sequence: 1,
        emittedAt: 1,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: '1',
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 0.5,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: { fromToken: ethToken, toToken: usdcToken },
        data: JSON.stringify({ data: [lateQuote] }),
        lastEventId: null,
      });
    });

    expect(mockCancelFetchQuoteEventsV2).toHaveBeenCalledWith({
      surfaceId: session.surfaceId,
      requestId: session.requestId,
    });
    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
    expect(store.get(swapQuoteListAtom())).toEqual([]);
    expect(store.get(swapQuoteCommittedStateAtom()).phase).toBe(
      ESwapQuoteCommitPhase.Idle,
    );
  });

  it('blocks quote A after raw SELL intent changes and only exposes quote B', () => {
    const sessionA = {
      surfaceId: 'main:swap:semantic-intent',
      requestId: 'request-a',
      fingerprint: 'fingerprint-a',
      intentRevision: 7,
    };
    const quoteA = {
      quoteId: 'quote-a',
      eventId: 'event-a',
      fromAmount: '1',
      toAmount: '10',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.SWAP,
      fromTokenInfo: ethToken,
      toTokenInfo: usdcToken,
      info: { provider: 'a', providerName: 'A' },
    } as IFetchQuoteResult;
    const quoteB = {
      ...quoteA,
      quoteId: 'quote-b',
      eventId: 'event-b',
      fromAmount: '12',
      toAmount: '120',
      info: { provider: 'b', providerName: 'B' },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: sessionA.surfaceId,
        intentRevision: sessionA.intentRevision,
        activeSession: sessionA,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: sessionA.fingerprint,
        requestId: sessionA.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const buildEvent = ({
      data,
      eventId,
      kind,
      quote,
      sequence,
      session,
    }: {
      data?: string;
      eventId: string;
      kind: ISwapQuoteSessionEventV2['kind'];
      quote: IFetchQuoteResult;
      sequence: number;
      session: typeof sessionA;
    }): ISwapQuoteSessionEventV2 => {
      const event = {
        version: 2,
        session,
        bgGeneration: 1,
        sequence,
        emittedAt: sequence,
        params: {
          fromNetworkId: ethToken.networkId,
          fromTokenAddress: ethToken.contractAddress,
          fromTokenAmount: quote.fromAmount,
          protocol: EProtocolOfExchange.SWAP,
          slippagePercentage: 0.5,
          toNetworkId: usdcToken.networkId,
          toTokenAddress: usdcToken.contractAddress,
        },
        tokenPairs: { fromToken: ethToken, toToken: usdcToken },
        kind,
        ...(kind === 'message'
          ? {
              data:
                data ??
                JSON.stringify(
                  eventId ? { eventId, totalQuoteCount: 1 } : { data: [quote] },
                ),
              lastEventId: null,
            }
          : {}),
      } as ISwapQuoteSessionEventV2;
      return event;
    };

    store.set(swapFromTokenAmountAtom(), { value: '12', isInput: true });
    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          eventId: 'event-a',
          kind: 'message',
          quote: quoteA,
          sequence: 1,
          session: sessionA,
        }),
      );
      result.current.quoteEventHandlerV2(
        buildEvent({
          data: JSON.stringify({ data: [quoteA] }),
          eventId: '',
          kind: 'message',
          quote: quoteA,
          sequence: 2,
          session: sessionA,
        }),
      );
      result.current.quoteEventHandlerV2(
        buildEvent({
          eventId: 'event-a',
          kind: 'done',
          quote: quoteA,
          sequence: 3,
          session: sessionA,
        }),
      );
    });

    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote?.quoteId,
    ).toBe(quoteA.quoteId);
    expect(store.get(swapQuoteCurrentSelectAtom())).toBeUndefined();

    act(() => {
      result.current.invalidateQuoteIntent({ isPending: true });
    });
    expect(mockCancelFetchQuoteEventsV2).toHaveBeenCalledWith({
      surfaceId: sessionA.surfaceId,
      requestId: sessionA.requestId,
    });
    expect(store.get(swapQuoteFetchingAtom())).toBe(true);
    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote,
    ).toBeUndefined();
    expect(store.get(swapQuoteListAtom())).toEqual([]);

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          data: JSON.stringify({ data: [quoteA] }),
          eventId: '',
          kind: 'message',
          quote: quoteA,
          sequence: 4,
          session: sessionA,
        }),
      );
    });
    expect(store.get(swapQuoteListAtom())).toEqual([]);

    const intentRevision = store.get(
      swapQuoteSessionStateAtom(),
    ).intentRevision;
    const sessionB = {
      ...sessionA,
      requestId: 'request-b',
      fingerprint: 'fingerprint-b',
      intentRevision,
    };
    store.set(swapQuoteSessionStateAtom(), {
      surfaceId: sessionB.surfaceId,
      intentRevision,
      activeSession: sessionB,
      bgGeneration: 1,
      lastSequence: 0,
      phase: 'streaming',
    });
    store.set(swapQuoteCommittedStateAtom(), {
      phase: ESwapQuoteCommitPhase.Requesting,
      intentFingerprint: sessionB.fingerprint,
      requestId: sessionB.requestId,
      pendingQuotes: [],
      settledQuotes: [],
    });
    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          eventId: 'event-b',
          kind: 'message',
          quote: quoteB,
          sequence: 1,
          session: sessionB,
        }),
      );
      result.current.quoteEventHandlerV2(
        buildEvent({
          data: JSON.stringify({ data: [quoteB] }),
          eventId: '',
          kind: 'message',
          quote: quoteB,
          sequence: 2,
          session: sessionB,
        }),
      );
      result.current.quoteEventHandlerV2(
        buildEvent({
          eventId: 'event-b',
          kind: 'done',
          quote: quoteB,
          sequence: 3,
          session: sessionB,
        }),
      );
    });

    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      quoteB.quoteId,
    );
    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote?.quoteId,
    ).toBe(quoteB.quoteId);
  });

  it('blocks a settled LIMIT BUY quote as soon as the raw BUY amount changes', () => {
    const session = {
      surfaceId: 'main:limit:semantic-intent',
      requestId: 'request-limit-a',
      fingerprint: 'fingerprint-limit-a',
      intentRevision: 4,
    };
    const quote = {
      quoteId: 'limit-buy-a',
      eventId: 'limit-event-a',
      fromAmount: '5',
      toAmount: '10',
      kind: ESwapQuoteKind.BUY,
      protocol: EProtocolOfExchange.LIMIT,
      fromTokenInfo: ethToken,
      toTokenInfo: usdcToken,
      info: { provider: 'limit', providerName: 'Limit' },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '5',
        isInput: false,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '10',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 3,
        phase: 'settled',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Settled,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [quote],
        displayQuote: quote,
        executableQuote: quote,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      quote.quoteId,
    );
    store.set(swapToTokenAmountAtom(), { value: '12', isInput: true });
    expect(store.get(swapQuoteCurrentSelectAtom())).toBeUndefined();

    act(() => {
      result.current.invalidateQuoteIntent({ isPending: true });
    });
    expect(mockCancelFetchQuoteEventsV2).toHaveBeenCalledWith({
      surfaceId: session.surfaceId,
      requestId: session.requestId,
    });
    expect(
      store.get(swapQuoteCommittedStateAtom()).executableQuote,
    ).toBeUndefined();
    expect(store.get(swapQuoteFetchingAtom())).toBe(true);
  });

  it('accepts only the active V2 session and commits once after done', async () => {
    const session = {
      surfaceId: 'main:swap:test',
      requestId: 'request-current',
      fingerprint: 'fingerprint-current',
      intentRevision: 7,
    };
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: ethToken.networkId,
      fromTokenAddress: ethToken.contractAddress,
      fromTokenAmount: '1',
      protocol: EProtocolOfExchange.SWAP,
      slippagePercentage: 0.5,
      toNetworkId: usdcToken.networkId,
      toTokenAddress: usdcToken.contractAddress,
    };
    const quote = {
      quoteId: 'quote-current',
      eventId: 'event-current',
      fromAmount: '1',
      toAmount: '1.2',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.SWAP,
      fromTokenInfo: ethToken,
      toTokenInfo: usdcToken,
      info: {
        provider: 'provider-current',
        providerName: 'Provider Current',
      },
    } as IFetchQuoteResult;
    const alternateQuote = {
      ...quote,
      quoteId: 'quote-alternate',
      toAmount: '1.1',
      info: {
        provider: 'provider-alternate',
        providerName: 'Provider Alternate',
      },
    } as IFetchQuoteResult;
    const laterAlternateQuote = {
      ...alternateQuote,
      quoteId: 'quote-alternate-later',
      toAmount: '1.05',
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), usdcToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteSessionStateAtom(), {
        surfaceId: session.surfaceId,
        intentRevision: session.intentRevision,
        activeSession: session,
        bgGeneration: 1,
        lastSequence: 0,
        phase: 'streaming',
      });
      storeInstance.set(swapQuoteCommittedStateAtom(), {
        phase: ESwapQuoteCommitPhase.Requesting,
        intentFingerprint: session.fingerprint,
        requestId: session.requestId,
        pendingQuotes: [],
        settledQuotes: [],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const buildEvent = (
      event: Pick<ISwapQuoteSessionEventV2, 'kind'> &
        Partial<ISwapQuoteSessionEventV2>,
    ): ISwapQuoteSessionEventV2 => {
      const quoteEvent = {
        version: 2,
        session,
        bgGeneration: 1,
        sequence: 1,
        emittedAt: 1,
        params: quoteParams,
        tokenPairs: { fromToken: ethToken, toToken: usdcToken },
        ...event,
      } as ISwapQuoteSessionEventV2;
      return quoteEvent;
    };

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'message',
          session: { ...session, requestId: 'request-stale' },
          data: JSON.stringify({ data: [quote] }),
          lastEventId: null,
        }),
      );
    });
    expect(store.get(swapQuoteListAtom())).toEqual([]);
    expect(store.get(swapQuoteSessionStateAtom()).lastSequence).toBe(0);
    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(false);
    store.set(swapManualSelectQuoteProvidersAtom(), {
      type: 'manual-provider',
      info: alternateQuote.info,
    });

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'message',
          data: JSON.stringify({
            totalQuoteCount: 2,
            eventId: 'event-current',
          }),
          lastEventId: null,
        }),
      );
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'message',
          sequence: 2,
          data: JSON.stringify({ data: [quote] }),
          lastEventId: null,
        }),
      );
    });
    expect(store.get(swapQuoteListAtom())).toEqual([quote]);
    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      quote.quoteId,
    );
    expect(store.get(swapManualSelectQuoteProvidersAtom())).toEqual({
      type: 'manual-provider',
      info: alternateQuote.info,
    });
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      buildSwapQuoteProviderKey(quote),
    ]);

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'message',
          sequence: 3,
          data: JSON.stringify({ data: [alternateQuote] }),
          lastEventId: null,
        }),
      );
    });
    expect(store.get(swapQuoteListAtom())).toEqual([quote, alternateQuote]);
    store.set(
      swapManualSelectQuoteProvidersAtom(),
      buildSwapManualProviderSelectionIntent(alternateQuote),
    );
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      buildSwapQuoteProviderKey(quote),
      buildSwapQuoteProviderKey(alternateQuote),
    ]);
    expect(store.get(swapQuoteProviderSelectionReadyAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      alternateQuote.quoteId,
    );

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'message',
          sequence: 3,
          data: JSON.stringify({
            data: [{ ...quote, quoteId: 'duplicate-should-be-dropped' }],
          }),
          lastEventId: null,
        }),
      );
    });
    expect(store.get(swapManualSelectQuoteProvidersAtom())).toEqual(
      buildSwapManualProviderSelectionIntent(alternateQuote),
    );
    expect(store.get(swapQuoteStreamingCurrentSelectAtom())).toEqual(
      expect.objectContaining({ quoteId: alternateQuote.quoteId }),
    );

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'message',
          sequence: 4,
          data: JSON.stringify({ data: [laterAlternateQuote] }),
          lastEventId: null,
        }),
      );
    });

    expect(store.get(swapQuoteListAtom())).toEqual([
      quote,
      laterAlternateQuote,
    ]);
    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: alternateQuote.quoteId,
        toAmount: alternateQuote.toAmount,
      }),
    );
    expect(store.get(swapQuoteStreamingCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        quoteId: laterAlternateQuote.quoteId,
        toAmount: laterAlternateQuote.toAmount,
      }),
    );

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({ kind: 'done', sequence: 5 }),
      );
    });

    expect(store.get(swapQuoteListAtom())).toEqual([
      quote,
      laterAlternateQuote,
    ]);
    const committedState = store.get(swapQuoteCommittedStateAtom());
    expect(committedState).toEqual(
      expect.objectContaining({
        phase: ESwapQuoteCommitPhase.Settled,
        executableQuote: expect.objectContaining({
          quoteId: laterAlternateQuote.quoteId,
        }),
      }),
    );
    expect(committedState.settledQuotes).toHaveLength(2);

    const retainedAlternateQuote = committedState.settledQuotes.find(
      (candidate) => candidate.quoteId === laterAlternateQuote.quoteId,
    );
    expect(retainedAlternateQuote).toBeDefined();
    expect(store.get(swapQuoteCurrentSelectAtom())).toBe(
      retainedAlternateQuote,
    );

    const refreshSession = {
      ...session,
      requestId: 'request-refresh',
    };
    const invalidManualQuote = {
      ...quote,
      eventId: 'event-refresh',
      quoteId: 'quote-current-error',
      toAmount: '0',
      errorMessage: 'provider unavailable',
    };
    const validFallbackQuote = {
      ...alternateQuote,
      eventId: 'event-refresh',
      quoteId: 'quote-alternate-refresh',
      toAmount: '1.15',
    };
    store.set(swapManualSelectQuoteProvidersAtom(), {
      type: 'manual-provider',
      info: invalidManualQuote.info,
    });
    store.set(swapQuoteListAtom(), [invalidManualQuote, validFallbackQuote]);
    store.set(swapQuoteCurrentEventProviderKeysAtom(), [
      buildSwapQuoteProviderKey(invalidManualQuote),
      buildSwapQuoteProviderKey(validFallbackQuote),
    ]);
    store.set(swapQuoteEventTotalCountAtom(), {
      count: 2,
      eventId: 'event-refresh',
      totalQuoteCountReceived: true,
    });
    store.set(swapQuoteEventCompletedAtom(), false);
    store.set(swapQuoteSessionStateAtom(), {
      surfaceId: refreshSession.surfaceId,
      intentRevision: refreshSession.intentRevision,
      activeSession: refreshSession,
      bgGeneration: 2,
      lastSequence: 0,
      phase: 'streaming',
    });
    store.set(swapQuoteCommittedStateAtom(), {
      phase: ESwapQuoteCommitPhase.Requesting,
      intentFingerprint: refreshSession.fingerprint,
      requestId: refreshSession.requestId,
      pendingQuotes: [invalidManualQuote, validFallbackQuote],
      settledQuotes: [],
      displayQuote: retainedAlternateQuote,
    });

    act(() => {
      result.current.quoteEventHandlerV2(
        buildEvent({
          kind: 'done',
          session: refreshSession,
          bgGeneration: 2,
        }),
      );
    });

    expect(store.get(swapManualSelectQuoteProvidersAtom())).toBeUndefined();
    expect(store.get(swapQuoteCurrentSelectAtom())).toBe(validFallbackQuote);
    expect(store.get(swapQuoteCommittedStateAtom()).executableQuote).toBe(
      validFallbackQuote,
    );

    store.set(swapFromTokenAmountAtom(), { value: '2', isInput: true });
    expect(store.get(swapQuoteCurrentSelectAtom())).toBeUndefined();
  });

  it('treats an exact empty positions response as settled cache data', async () => {
    mockGetSupportSwapAllAccounts.mockResolvedValueOnce({
      accountIdKey: 'owner-empty',
      swapSupportAccounts: [
        {
          accountId: 'network-account-empty',
          apiAddress: '0xempty',
          networkId: 'evm--1',
        },
      ],
      supportAccountsFetchFailed: false,
    });
    mockFetchSwapTokens.mockResolvedValueOnce([]);
    const { store, Wrapper } = createWrapperWithStore();
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-empty',
      );
    });

    const ownerKey = 'owner-empty__evm--1';
    expect(store.get(swapProPositionsRequestStateAtom())).toEqual({
      ownerKey,
      requestId: 1,
      status: 'settled',
    });
    expect(store.get(swapProPositionsCacheAtom()).byOwner[ownerKey]).toEqual(
      expect.objectContaining({ ownerKey, tokens: [] }),
    );
    expect(mockFetchSwapTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'network-account-empty',
        throwOnError: true,
      }),
    );
    expect(store.get(swapProSupportNetworksTokenListLoadingAtom())).toBe(false);
  });

  it('recovers from a first raw positions failure on manual retry', async () => {
    const supportAccountsResult: IMockSupportSwapAccountsResult = {
      accountIdKey: 'owner-retry',
      swapSupportAccounts: [
        {
          accountId: 'network-account-retry',
          apiAddress: '0xretry',
          networkId: 'evm--1',
        },
      ],
      supportAccountsFetchFailed: false,
    };
    mockGetSupportSwapAllAccounts
      .mockResolvedValueOnce(supportAccountsResult)
      .mockResolvedValueOnce(supportAccountsResult);
    mockFetchSwapTokens
      .mockRejectedValueOnce(new Error('positions offline'))
      .mockResolvedValueOnce([{ ...ethToken, fiatValue: '2' }]);
    const { store, Wrapper } = createWrapperWithStore();
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-retry',
      );
    });
    expect(store.get(swapProPositionsRequestStateAtom())).toEqual({
      ownerKey: 'owner-retry__evm--1',
      requestId: 1,
      status: 'error',
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-retry',
      );
    });
    expect(store.get(swapProPositionsRequestStateAtom())).toEqual({
      ownerKey: 'owner-retry__evm--1',
      requestId: 2,
      status: 'settled',
    });
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner['owner-retry__evm--1']
        ?.tokens,
    ).toEqual([{ ...ethToken, fiatValue: '2' }]);
    expect(mockFetchSwapTokens).toHaveBeenCalledTimes(2);
    expect(mockFetchSwapTokens).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ throwOnError: true }),
    );
    expect(mockFetchSwapTokens).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ throwOnError: true }),
    );
  });

  it('preserves last-good positions when every network request fails', async () => {
    const ownerKey = 'owner-all-failed__evm--1,evm--56';
    const previousEntry = {
      ownerKey,
      networkIdsKey: 'evm--1,evm--56',
      tokens: [ethToken],
      updatedAt: 1,
    };
    mockGetSupportSwapAllAccounts.mockResolvedValueOnce({
      accountIdKey: 'owner-all-failed',
      swapSupportAccounts: [
        {
          accountId: 'network-account-all-failed-a',
          apiAddress: '0xa',
          networkId: 'evm--1',
        },
        {
          accountId: 'network-account-all-failed-b',
          apiAddress: '0xb',
          networkId: 'evm--56',
        },
      ],
      supportAccountsFetchFailed: false,
    });
    mockFetchSwapTokens.mockRejectedValue(new Error('positions offline'));
    const { store, Wrapper } = createWrapperWithStore((targetStore) => {
      targetStore.set(swapProPositionsCacheAtom(), {
        byOwner: { [ownerKey]: previousEntry },
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork, { networkId: 'evm--56', name: 'BNB', symbol: 'BNB' }],
        'owner-all-failed',
      );
    });

    expect(store.get(swapProPositionsRequestStateAtom()).status).toBe('error');
    expect(store.get(swapProPositionsCacheAtom()).byOwner[ownerKey]).toBe(
      previousEntry,
    );
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([
      ethToken,
    ]);
    expect(mockFetchSwapTokens).toHaveBeenCalledTimes(2);
    expect(mockFetchSwapTokens).toHaveBeenCalledWith(
      expect.objectContaining({ throwOnError: true }),
    );
  });

  it('rejects a partial cross-network snapshot and preserves last-good positions', async () => {
    const ownerKey = 'owner-partial__evm--1,evm--56';
    const previousEntry = {
      ownerKey,
      networkIdsKey: 'evm--1,evm--56',
      tokens: [ethToken],
      updatedAt: 1,
    };
    mockGetSupportSwapAllAccounts.mockResolvedValueOnce({
      accountIdKey: 'owner-partial',
      swapSupportAccounts: [
        {
          accountId: 'network-account-partial-success',
          apiAddress: '0xa',
          networkId: 'evm--1',
        },
        {
          accountId: 'network-account-partial-failure',
          apiAddress: '0xb',
          networkId: 'evm--56',
        },
      ],
      supportAccountsFetchFailed: false,
    });
    mockFetchSwapTokens.mockImplementation(({ accountId }) =>
      accountId === 'network-account-partial-success'
        ? Promise.resolve([{ ...bnbToken, fiatValue: '9' }])
        : Promise.reject(new Error('one network offline')),
    );
    const { store, Wrapper } = createWrapperWithStore((targetStore) => {
      targetStore.set(swapProPositionsCacheAtom(), {
        byOwner: { [ownerKey]: previousEntry },
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork, { networkId: 'evm--56', name: 'BNB', symbol: 'BNB' }],
        'owner-partial',
      );
    });

    expect(store.get(swapProPositionsRequestStateAtom()).status).toBe('error');
    expect(store.get(swapProPositionsCacheAtom()).byOwner[ownerKey]).toBe(
      previousEntry,
    );
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([
      ethToken,
    ]);
  });

  it('preserves the exact Stock metadata snapshot during a raw positions refresh', async () => {
    const ownerKey = 'owner-cached__evm--1';
    const stockMetadataSnapshot = {
      ownerKey: `${ownerKey}::all`,
      requestKey: 'en-US::evm--1:0xeeee',
      data: [] as string[],
    };
    const { store, Wrapper } = createWrapperWithStore((targetStore) => {
      targetStore.set(swapProPositionsCacheAtom(), {
        byOwner: {
          [ownerKey]: {
            ownerKey,
            networkIdsKey: 'evm--1',
            tokens: [ethToken],
            updatedAt: 1,
            stockMetadataSnapshot,
          },
        },
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-cached',
      );
    });

    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerKey]
        ?.stockMetadataSnapshot,
    ).toBe(stockMetadataSnapshot);
  });

  it('keeps last-good positions when support account discovery fails', async () => {
    const ownerKey = 'owner-failed__evm--1';
    const previousEntry = {
      ownerKey,
      networkIdsKey: 'evm--1',
      tokens: [ethToken],
      updatedAt: 1,
    };
    const { store, Wrapper } = createWrapperWithStore((targetStore) => {
      targetStore.set(swapProPositionsCacheAtom(), {
        byOwner: { [ownerKey]: previousEntry },
      });
    });
    mockGetSupportSwapAllAccounts.mockResolvedValueOnce({
      accountIdKey: 'owner-failed',
      swapSupportAccounts: [],
      supportAccountsFetchFailed: true,
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-failed',
      );
    });

    expect(store.get(swapProPositionsRequestStateAtom())).toEqual({
      ownerKey,
      requestId: 1,
      status: 'error',
    });
    expect(store.get(swapProPositionsCacheAtom()).byOwner[ownerKey]).toBe(
      previousEntry,
    );
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([
      ethToken,
    ]);
    expect(store.get(swapProSupportNetworksTokenListLoadingAtom())).toBe(false);
  });

  it('releases positions loading after an unexpected discovery error', async () => {
    mockGetSupportSwapAllAccounts.mockRejectedValueOnce(
      new Error('discovery failed'),
    );
    const { store, Wrapper } = createWrapperWithStore();
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-error',
      );
    });

    expect(store.get(swapProPositionsRequestStateAtom()).status).toBe('error');
    expect(store.get(swapProSupportNetworksTokenListLoadingAtom())).toBe(false);
  });

  it('lets only the latest positions owner request commit', async () => {
    const ownerADeferred = createDeferred<ISwapToken[]>();
    const ownerBDeferred = createDeferred<ISwapToken[]>();
    const tokenA = { ...ethToken, fiatValue: '1' };
    const tokenB = { ...ethToken, fiatValue: '2' };
    mockGetSupportSwapAllAccounts
      .mockResolvedValueOnce({
        accountIdKey: 'owner-a',
        swapSupportAccounts: [
          {
            accountId: 'network-account-a',
            apiAddress: '0xa',
            networkId: 'evm--1',
          },
        ],
        supportAccountsFetchFailed: false,
      })
      .mockResolvedValueOnce({
        accountIdKey: 'owner-b',
        swapSupportAccounts: [
          {
            accountId: 'network-account-b',
            apiAddress: '0xb',
            networkId: 'evm--1',
          },
        ],
        supportAccountsFetchFailed: false,
      });
    mockFetchSwapTokens.mockImplementation(({ accountId }) =>
      accountId === 'network-account-a'
        ? ownerADeferred.promise
        : ownerBDeferred.promise,
    );
    const { store, Wrapper } = createWrapperWithStore();
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let requestA!: Promise<void>;
    act(() => {
      requestA = result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-a',
      );
    });
    await waitFor(() => expect(mockFetchSwapTokens).toHaveBeenCalledTimes(1));

    let requestB!: Promise<void>;
    act(() => {
      requestB = result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-b',
      );
    });
    await waitFor(() => expect(mockFetchSwapTokens).toHaveBeenCalledTimes(2));

    await act(async () => {
      ownerBDeferred.resolve([tokenB]);
      await requestB;
    });
    await act(async () => {
      ownerADeferred.resolve([tokenA]);
      await requestA;
    });

    expect(store.get(swapProPositionsRequestStateAtom())).toEqual({
      ownerKey: 'owner-b__evm--1',
      requestId: 2,
      status: 'settled',
    });
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([tokenB]);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner['owner-a__evm--1'],
    ).toBeUndefined();
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner['owner-b__evm--1']?.tokens,
    ).toEqual([tokenB]);
  });

  it('lets only the latest same-owner positions generation commit', async () => {
    const firstDeferred = createDeferred<ISwapToken[]>();
    const secondDeferred = createDeferred<ISwapToken[]>();
    const firstToken = { ...ethToken, fiatValue: '1' };
    const secondToken = { ...ethToken, fiatValue: '2' };
    const supportAccountsResult: IMockSupportSwapAccountsResult = {
      accountIdKey: 'owner-same',
      swapSupportAccounts: [
        {
          accountId: 'network-account-same',
          apiAddress: '0xsame',
          networkId: 'evm--1',
        },
      ],
      supportAccountsFetchFailed: false,
    };
    mockGetSupportSwapAllAccounts
      .mockResolvedValueOnce(supportAccountsResult)
      .mockResolvedValueOnce(supportAccountsResult);
    mockFetchSwapTokens
      .mockImplementationOnce(() => firstDeferred.promise)
      .mockImplementationOnce(() => secondDeferred.promise);
    const { store, Wrapper } = createWrapperWithStore();
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-same',
      );
    });
    await waitFor(() => expect(mockFetchSwapTokens).toHaveBeenCalledTimes(1));

    let secondRequest!: Promise<void>;
    act(() => {
      secondRequest = result.current.swapProLoadSupportNetworksTokenList(
        [evmSwapNetwork],
        'owner-same',
      );
    });
    await waitFor(() => expect(mockFetchSwapTokens).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondDeferred.resolve([secondToken]);
      await secondRequest;
    });
    await act(async () => {
      firstDeferred.resolve([firstToken]);
      await firstRequest;
    });

    expect(store.get(swapProPositionsRequestStateAtom())).toEqual({
      ownerKey: 'owner-same__evm--1',
      requestId: 2,
      status: 'settled',
    });
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([
      secondToken,
    ]);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner['owner-same__evm--1']
        ?.tokens,
    ).toEqual([secondToken]);
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
});
