/* eslint-disable import/first */

const mockAccountListeners = new Map<string, () => void>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const getBorrowReserves = jest.fn();
  (
    globalThis as unknown as { __borrowReservesServiceMock: jest.Mock }
  ).__borrowReservesServiceMock = getBorrowReserves;
  return {
    __esModule: true,
    default: { serviceStaking: { getBorrowReserves } },
  };
});
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    WalletClear: 'WalletClear',
    AccountRemove: 'AccountRemove',
    AccountUpdate: 'AccountUpdate',
    GlobalDeriveTypeUpdate: 'GlobalDeriveTypeUpdate',
    NetworkDeriveTypeChanged: 'NetworkDeriveTypeChanged',
    AccountSelectorSelectedAccountUpdate:
      'AccountSelectorSelectedAccountUpdate',
  },
  appEventBus: {
    on: (name: string, listener: () => void) => {
      mockAccountListeners.set(name, listener);
    },
  },
}));

import { act, renderHook } from '@testing-library/react-native';

import type {
  IBorrowReserveItem,
  IBorrowReserveRequestParams,
} from '@onekeyhq/shared/types/staking';

import { isBorrowSnapshotReusable } from '../components/borrowDataGate.utils';

import {
  getBorrowReservesCacheUpdatedAt,
  isBorrowReservesCacheReusable,
  isBorrowReservesPayloadUsable,
  isBorrowReservesRequestSuperseded,
  useBorrowReserves,
} from './useBorrowReserves';

const mockGetBorrowReserves = (
  globalThis as unknown as { __borrowReservesServiceMock: jest.Mock }
).__borrowReservesServiceMock;

const zeroBalanceReserves: IBorrowReserveItem = {
  overview: {
    netWorth: { text: '$0.00' },
    netApy: { text: '0%' },
  },
  supplied: {
    suppliedBalance: { title: { text: '$0.00' } },
    suppliedApy: { title: { text: '0%' } },
    assets: [],
  },
  borrowed: {
    borrowedBalance: { title: { text: '$0.00' } },
    borrowedApy: { title: { text: '0%' } },
    assets: [],
  },
  supply: { assets: [] },
  borrow: { assets: [] },
};

function deferred() {
  let resolve!: (value: IBorrowReserveItem) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<IBorrowReserveItem>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );
  return { promise, resolve, reject };
}

function params(marketAddress: string): IBorrowReserveRequestParams {
  return {
    provider: 'aave',
    networkId: 'evm--1',
    marketAddress,
    accountId: 'account-1',
  };
}

describe('useBorrowReserves in-flight requests', () => {
  beforeEach(() => {
    mockGetBorrowReserves.mockReset();
  });

  it('accepts zero balances and empty asset lists, but rejects missing sections', () => {
    expect(isBorrowReservesPayloadUsable(zeroBalanceReserves)).toBe(true);
    expect(isBorrowReservesPayloadUsable(undefined)).toBe(false);
    expect(isBorrowReservesPayloadUsable({})).toBe(false);
    expect(
      isBorrowReservesPayloadUsable({
        ...zeroBalanceReserves,
        supply: undefined,
      }),
    ).toBe(false);
    expect(
      isBorrowReservesPayloadUsable({
        ...zeroBalanceReserves,
        supplied: { ...zeroBalanceReserves.supplied, assets: [{}] },
      }),
    ).toBe(false);
    expect(
      isBorrowReservesPayloadUsable({
        ...zeroBalanceReserves,
        supplied: { ...zeroBalanceReserves.supplied, suppliedBalance: null },
      }),
    ).toBe(false);
  });

  it('invalidates a cached reserves entry after an account event without fetching', () => {
    const cachedUpdatedAt = Date.now();
    expect(isBorrowReservesCacheReusable(cachedUpdatedAt)).toBe(true);

    renderHook(() => useBorrowReserves());
    expect(mockGetBorrowReserves).not.toHaveBeenCalled();
    expect(mockAccountListeners.has('NetworkDeriveTypeChanged')).toBe(true);

    act(() => mockAccountListeners.get('NetworkDeriveTypeChanged')?.());
    expect(isBorrowReservesCacheReusable(cachedUpdatedAt)).toBe(false);
  });

  it('notifies a mounted consumer when account data changes in place', () => {
    const { result } = renderHook(() => useBorrowReserves());
    const previousRevision = result.current.accountRevision;

    act(() => mockAccountListeners.get('AccountUpdate')?.());

    expect(result.current.accountRevision).toBe(previousRevision + 1);
  });

  it('keeps a response settled in the invalidation millisecond reusable', () => {
    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      renderHook(() => useBorrowReserves());
      act(() => mockAccountListeners.get('AccountUpdate')?.());

      const updatedAt = getBorrowReservesCacheUpdatedAt();
      expect(updatedAt).toBeLessThanOrEqual(now);
      expect(
        isBorrowSnapshotReusable({
          updatedAt,
          now,
          isAccountCacheReusable: isBorrowReservesCacheReusable(updatedAt),
        }),
      ).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('shares only an identical in-flight scope, then fetches again after settlement', async () => {
    const first = deferred();
    const otherMarket = deferred();
    mockGetBorrowReserves
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(otherMarket.promise)
      .mockResolvedValueOnce(zeroBalanceReserves);
    const { result } = renderHook(() => useBorrowReserves());

    const firstRequest = result.current.fetchReserves(params('0xA'));
    const sharedRequest = result.current.fetchReserves(params('0xA'));
    const otherRequest = result.current.fetchReserves(params('0xB'));
    expect(sharedRequest).toBe(firstRequest);
    await Promise.resolve();
    expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2);

    first.resolve(zeroBalanceReserves);
    otherMarket.resolve(zeroBalanceReserves);
    await Promise.all([firstRequest, otherRequest]);
    await result.current.fetchReserves(params('0xA'));
    expect(mockGetBorrowReserves).toHaveBeenCalledTimes(3);
  });

  it('does not join an old account request after a derive change', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    mockGetBorrowReserves
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const { result } = renderHook(() => useBorrowReserves());

    const oldPromise = result.current.fetchReserves(params('0xC'));
    act(() => mockAccountListeners.get('NetworkDeriveTypeChanged')?.());
    const newPromise = result.current.fetchReserves(params('0xC'));
    expect(newPromise).not.toBe(oldPromise);
    await Promise.resolve();
    expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2);

    oldRequest.resolve(zeroBalanceReserves);
    const oldError: unknown = await oldPromise.catch((error: unknown) => error);
    expect(isBorrowReservesRequestSuperseded(oldError)).toBe(true);
    expect(result.current.fetchReserves(params('0xC'))).toBe(newPromise);
    newRequest.resolve(zeroBalanceReserves);
    await newPromise;
  });

  it('starts a new force refresh and rejects the older in-flight response', async () => {
    const oldRequest = deferred();
    const freshRequest = deferred();
    mockGetBorrowReserves
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(freshRequest.promise);
    const { result } = renderHook(() => useBorrowReserves());

    const oldPromise = result.current.fetchReserves(params('0xForce'));
    const freshPromise = result.current.fetchReserves(params('0xForce'), {
      forceNew: true,
    });
    expect(freshPromise).not.toBe(oldPromise);
    await Promise.resolve();
    expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2);

    oldRequest.resolve(zeroBalanceReserves);
    await expect(oldPromise).rejects.toThrow(
      'Borrow reserves request superseded',
    );
    freshRequest.resolve(zeroBalanceReserves);
    await freshPromise;
  });

  it('retries after a failed request settles', async () => {
    const failed = deferred();
    mockGetBorrowReserves
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce(zeroBalanceReserves);
    const { result } = renderHook(() => useBorrowReserves());

    const request = result.current.fetchReserves(params('0xD'));
    failed.reject(new Error('temporary failure'));
    await expect(request).rejects.toThrow('temporary failure');
    await result.current.fetchReserves(params('0xD'));
    expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, {}])(
    'rejects invalid successful payload %p and permits a retry',
    async (invalidPayload) => {
      mockGetBorrowReserves
        .mockResolvedValueOnce(invalidPayload)
        .mockResolvedValueOnce(zeroBalanceReserves);
      const { result } = renderHook(() => useBorrowReserves());

      await expect(
        result.current.fetchReserves(params('0xInvalid')),
      ).rejects.toThrow('Invalid Borrow reserves response');
      await expect(
        result.current.fetchReserves(params('0xInvalid')),
      ).resolves.toEqual(zeroBalanceReserves);
      expect(mockGetBorrowReserves).toHaveBeenCalledTimes(2);
    },
  );
});
