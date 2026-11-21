/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import {
  getHomeNetWorthAccountKey,
  publishHomeNetWorth,
  useHomeNetWorthFigures,
} from './earnNetWorthStore';
import {
  useEarnDesktopAccountMarkets,
  useRememberedAccountMarket,
} from './useEarnDesktopHomeData';

let mockSelectedAddress = 0;
let mockBackgroundSelectedAddress = 0;
let mockAccountReady = true;
let mockSelectorReady = false;
let mockOmitSelection = false;
let mockDbAccountImpl: string | undefined;
let mockIndexedAccountId: string | undefined;
let mockAccountId = '';
let nextAccountId = 0;
const mockGetBorrowReserves = jest.fn<
  Promise<ReturnType<typeof loan>>,
  [unknown]
>();
const mockGetEarnAccount = jest.fn<
  Promise<{
    accountId: string;
    accountAddress: string;
    account: ReturnType<typeof externalAccount>;
  } | null>,
  [unknown]
>();
const mockGetDBAccount = jest.fn<
  Promise<ReturnType<typeof externalAccount>>,
  [unknown]
>();
const mockGetBorrowHealthFactor = jest.fn<Promise<undefined>, [unknown]>();
const mockGetAllAccounts = jest.fn<
  Promise<{ accounts: { id: string }[] }>,
  [unknown]
>();
const mockGetDerivedAccountId = jest.fn<Promise<string>, [unknown]>();
const mockGetDeriveType = jest.fn<Promise<'default'>, [unknown]>();

jest.mock('@onekeyhq/components', () => {
  const deferredModule = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredModule.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getDBAccount: (args: unknown) => mockGetDBAccount(args),
      getAllAccounts: (args: unknown) => mockGetAllAccounts(args),
      getDbAccountIdFromIndexedAccountId: (args: unknown) =>
        mockGetDerivedAccountId(args),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (args: unknown) => mockGetDeriveType(args),
    },
    serviceStaking: {
      getEarnAccount: (args: unknown) => mockGetEarnAccount(args),
      getBorrowReserves: (args: unknown) => mockGetBorrowReserves(args),
      getBorrowHealthFactor: (args: unknown) => mockGetBorrowHealthFactor(args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useSelectedAccount: () => ({
    selectedAccount: {
      othersWalletAccountId: mockAccountId,
      indexedAccountId: mockIndexedAccountId,
    },
  }),
  useActiveAccount: () => ({
    activeAccount: {
      ready: mockSelectorReady,
      account: mockAccountReady
        ? externalAccount(mockSelectedAddress)
        : undefined,
      dbAccount: mockDbAccountImpl
        ? { ...externalAccount(mockSelectedAddress), impl: mockDbAccountImpl }
        : undefined,
    },
  }),
}));
jest.mock('../../../Borrow/hooks/useBorrowMarkets', () => ({}));
jest.mock('../../../Borrow/hooks/useBorrowReserves', () => ({
  isBorrowReservesPayloadUsable: (value: unknown) => Boolean(value),
}));

const market = {
  provider: 'aave',
  networkId: 'evm--1',
  marketAddress: '0xmarket',
  name: 'Aave',
  logoURI: '',
  network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
} as IBorrowMarketItem;
const markets = [market];

function externalAccount(selected: number) {
  const address = selected === 0 ? '0xaaa' : '0xbbb';
  return {
    id: mockAccountId,
    address,
    addressDetail: { normalizedAddress: address },
    connectedAddresses: { evm: '0xaaa,0xbbb' },
    ...(mockOmitSelection ? {} : { selectedAddress: { evm: selected } }),
  };
}

function loan(amount: string) {
  return {
    borrowed: { assets: [{ borrowedAmount: { amount } }] },
    supplied: { assets: [] },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockSelectedAddress = 0;
  mockBackgroundSelectedAddress = 0;
  mockAccountReady = true;
  mockSelectorReady = false;
  mockOmitSelection = false;
  mockDbAccountImpl = undefined;
  mockIndexedAccountId = undefined;
  nextAccountId += 1;
  mockAccountId = `external--wc--session-${nextAccountId}--0`;
  mockGetBorrowReserves.mockReset();
  mockGetEarnAccount.mockReset().mockImplementation(async () => ({
    accountId: mockAccountId,
    accountAddress: mockBackgroundSelectedAddress === 0 ? '0xaaa' : '0xbbb',
    account: externalAccount(mockBackgroundSelectedAddress),
  }));
  mockGetDBAccount
    .mockReset()
    .mockImplementation(async () =>
      externalAccount(mockBackgroundSelectedAddress),
    );
  mockGetBorrowHealthFactor.mockReset().mockResolvedValue(undefined);
  mockGetAllAccounts.mockReset().mockResolvedValue({ accounts: [] });
  mockGetDerivedAccountId.mockReset().mockResolvedValue('hd-1--evm-account');
  mockGetDeriveType.mockReset().mockResolvedValue('default');
});

it('does not fetch or show a cached external account before its address selection is resolved', async () => {
  mockAccountReady = false;
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await act(async () => Promise.resolve());
  expect(mockGetBorrowReserves).not.toHaveBeenCalled();
  expect(view.result.current.loans).toHaveLength(0);
  expect(view.result.current.isLoaded).toBe(false);

  mockSelectedAddress = 1;
  mockBackgroundSelectedAddress = 1;
  mockAccountReady = true;
  view.rerender();
  await waitFor(() => expect(mockGetBorrowReserves).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
});

it('reports an unresolved external identity as a failure after account loading finishes', async () => {
  mockAccountReady = false;
  mockSelectorReady = true;
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.hasError).toBe(true));
  expect(view.result.current.loans).toHaveLength(0);
  expect(mockGetBorrowReserves).not.toHaveBeenCalled();
});

it('does not reuse the previous selected address when a new read fails', async () => {
  mockGetBorrowReserves
    .mockResolvedValueOnce(loan('1'))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(loan('2'));
  const view = renderHook(() => ({
    markets: useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
    remembered: useRememberedAccountMarket('aave:evm--1:0xmarket'),
  }));
  await waitFor(() =>
    expect(view.result.current.markets.loans).toHaveLength(1),
  );

  mockSelectedAddress = 1;
  mockBackgroundSelectedAddress = 1;
  view.rerender();
  expect(view.result.current.markets.loans).toHaveLength(0);
  expect(view.result.current.remembered?.reserves).toBeUndefined();
  await waitFor(() => expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(view.result.current.markets.hasSettled).toBe(true),
  );
  expect(view.result.current.markets.isLoaded).toBe(false);
  await waitFor(() => expect(view.result.current.markets.hasError).toBe(true));
  expect(view.result.current.markets.entries[0]?.accountDataUnavailable).toBe(
    true,
  );
  expect(view.result.current.markets.loans).toHaveLength(0);
  expect(view.result.current.remembered?.reserves).toBeUndefined();
  await act(async () => view.result.current.markets.refresh());
  await waitFor(() => expect(view.result.current.markets.isLoaded).toBe(true));
  expect(view.result.current.markets.hasError).toBe(false);
  expect(view.result.current.markets.loans).toHaveLength(1);
});

it('does not treat an unresolved account lookup as an empty position', async () => {
  mockGetEarnAccount.mockResolvedValueOnce(null);
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.hasSettled).toBe(true));
  expect(view.result.current.entries[0]?.accountDataUnavailable).toBe(true);
  expect(view.result.current.isLoaded).toBe(false);
  expect(view.result.current.loans).toHaveLength(0);
  expect(mockGetBorrowReserves).not.toHaveBeenCalled();
});

it('treats an absent wallet as an empty, complete account scope', async () => {
  mockAccountId = '';
  mockAccountReady = false;
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  expect(view.result.current.loans).toHaveLength(0);
  expect(mockGetEarnAccount).not.toHaveBeenCalled();
});

it('treats a confirmed missing indexed network account as absent', async () => {
  mockAccountId = '';
  mockAccountReady = false;
  mockIndexedAccountId = 'hd-1--0';
  mockGetEarnAccount.mockResolvedValueOnce(null);
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  expect(mockGetAllAccounts).toHaveBeenCalledWith({
    ids: ['hd-1--evm-account'],
  });
  expect(view.result.current.hasError).toBe(false);
});

it('reports a failed indexed account lookup instead of treating it as absent', async () => {
  mockAccountId = '';
  mockAccountReady = false;
  mockIndexedAccountId = 'hd-1--0';
  mockGetEarnAccount.mockResolvedValueOnce(null);
  mockGetAllAccounts.mockRejectedValueOnce(new Error('storage unavailable'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.hasError).toBe(true));
  expect(view.result.current.isLoaded).toBe(false);
});

it('treats a verified network-incompatible account as absent for that market', async () => {
  mockDbAccountImpl = 'sol';
  mockGetEarnAccount.mockResolvedValueOnce(null);
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  expect(
    view.result.current.entries[0]?.accountDataUnavailable,
  ).toBeUndefined();
  expect(view.result.current.loans).toHaveLength(0);
});

it('does not publish a previous address response after an address switch', async () => {
  const old = deferred<ReturnType<typeof loan>>();
  mockGetBorrowReserves
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(loan('2'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(mockGetBorrowReserves).toHaveBeenCalledTimes(1));
  mockSelectedAddress = 1;
  mockBackgroundSelectedAddress = 1;
  view.rerender();
  await waitFor(() => expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      view.result.current.loans[0]?.reserves?.borrowed.assets[0]?.borrowedAmount
        ?.amount,
    ).toBe('2'),
  );
  await act(async () => old.resolve(loan('1')));
  expect(
    view.result.current.loans[0]?.reserves?.borrowed.assets[0]?.borrowedAmount
      ?.amount,
  ).toBe('2');
});

it('does not expose the previous external address net worth after switching addresses', async () => {
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() => {
    const data = useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    });
    const accountKey = getHomeNetWorthAccountKey({
      accountId: mockAccountId,
      accountMarketsScope: data.accountScope,
    });
    const figures = useHomeNetWorthFigures(accountKey, 'usd');
    return { data, accountKey, figures };
  });
  await waitFor(() => expect(view.result.current.data.isLoaded).toBe(true));
  act(() => {
    publishHomeNetWorth({
      accountKey: view.result.current.accountKey,
      currencyId: 'usd',
      value: '123',
    });
  });
  expect(view.result.current.figures?.value).toBe('123');
  mockSelectedAddress = 1;
  mockBackgroundSelectedAddress = 1;
  view.rerender();
  expect(view.result.current.figures).toBeUndefined();
  await waitFor(() => expect(view.result.current.data.isLoaded).toBe(true));
  expect(view.result.current.figures).toBeUndefined();
});

it('keeps the same indexed account net worth across network changes', () => {
  const evm = getHomeNetWorthAccountKey({
    accountId: 'hd-1--evm-account',
    indexedAccountId: 'hd-1--0',
    accountMarketsScope: 'evm-network-scope',
  });
  const sol = getHomeNetWorthAccountKey({
    accountId: 'hd-1--sol-account',
    indexedAccountId: 'hd-1--0',
    accountMarketsScope: 'sol-network-scope',
  });
  expect(evm).toBe('hd-1--0');
  expect(sol).toBe(evm);
});

it('does not use the old cache when the background address changes before the account selector updates', async () => {
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
  expect(mockGetBorrowReserves).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xaaa' }),
  );
  mockBackgroundSelectedAddress = 1;
  await act(async () => view.result.current.refresh());
  expect(mockGetBorrowReserves).toHaveBeenCalledTimes(1);
  expect(view.result.current.loans).toHaveLength(0);
  expect(view.result.current.isLoaded).toBe(false);
  expect(view.result.current.entries[0]?.accountIdentityUnverified).toBe(true);
});

it('does not fall back to old loans if the address changes while a refresh fails', async () => {
  const next = deferred<ReturnType<typeof loan>>();
  mockGetBorrowReserves
    .mockResolvedValueOnce(loan('1'))
    .mockReturnValueOnce(next.promise);
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
  let refresh: Promise<void> | undefined;
  act(() => {
    refresh = view.result.current.refresh();
  });
  await waitFor(() => expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2));
  mockBackgroundSelectedAddress = 1;
  await act(async () => {
    next.reject(new Error('offline'));
    await refresh;
  });
  expect(view.result.current.loans).toHaveLength(0);
  expect(view.result.current.isLoaded).toBe(false);
});

it('keeps the identity unverified when its background account cannot be read', async () => {
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
  mockGetDBAccount.mockRejectedValueOnce(new Error('account read failed'));
  await act(async () => view.result.current.refresh());
  expect(view.result.current.loans).toHaveLength(0);
  expect(view.result.current.isLoaded).toBe(false);
  expect(view.result.current.entries[0]?.accountIdentityUnverified).toBe(true);
});

it('preserves other market results if one account identity check fails', async () => {
  const otherMarket = { ...market, marketAddress: '0xother' };
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  mockGetDBAccount.mockRejectedValueOnce(new Error('account read failed'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets: [market, otherMarket],
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.entries).toHaveLength(2));
  expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2);
  expect(view.result.current.entries[0]?.accountIdentityUnverified).toBe(true);
  expect(view.result.current.loans).toHaveLength(1);
  expect(view.result.current.loans[0]?.market.marketAddress).toBe('0xother');
  expect(view.result.current.isLoaded).toBe(false);
});

it('keeps known markets available without declaring totals complete while a new market loads', async () => {
  const otherMarket = { ...market, marketAddress: '0xother' };
  const pending = deferred<ReturnType<typeof loan>>();
  mockGetBorrowReserves
    .mockResolvedValueOnce(loan('1'))
    .mockResolvedValueOnce(loan('1'))
    .mockReturnValueOnce(pending.promise);
  const view = renderHook(
    ({ currentMarkets }) =>
      useEarnDesktopAccountMarkets({
        markets: currentMarkets,
        isListReady: true,
        isActive: false,
      }),
    { initialProps: { currentMarkets: markets } },
  );
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  view.rerender({ currentMarkets: [market, otherMarket] });
  expect(view.result.current.loans).toHaveLength(1);
  expect(view.result.current.isLoaded).toBe(false);
  await waitFor(() => expect(mockGetBorrowReserves).toHaveBeenCalledTimes(3));
  await act(async () => pending.resolve(loan('2')));
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  expect(view.result.current.loans).toHaveLength(2);
});

it('uses the default external address when the legacy selection field is missing', async () => {
  mockOmitSelection = true;
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
  expect(view.result.current.isLoaded).toBe(true);
  expect(mockGetBorrowReserves).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xaaa' }),
  );
});

it('does not use external selection for an imported account and binds its market address', async () => {
  mockAccountId = 'imported--evm--account';
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
  expect(mockGetDBAccount).not.toHaveBeenCalled();
  expect(mockGetBorrowReserves).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xaaa' }),
  );
});

it('binds a market request to the network account snapshot rather than a separately read address', async () => {
  mockGetEarnAccount.mockResolvedValueOnce({
    accountId: mockAccountId,
    accountAddress: '0xbbb',
    account: externalAccount(0),
  });
  mockGetBorrowReserves.mockResolvedValue(loan('1'));
  const view = renderHook(() =>
    useEarnDesktopAccountMarkets({
      markets,
      isListReady: true,
      isActive: false,
    }),
  );
  await waitFor(() => expect(view.result.current.loans).toHaveLength(1));
  expect(mockGetBorrowReserves).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xaaa' }),
  );
  expect(mockGetBorrowHealthFactor).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xaaa' }),
  );
});
