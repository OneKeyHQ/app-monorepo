/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { useWatchListV2Actions } from './actions';
import {
  ProviderJotaiContextMarketV2,
  marketWatchListV2Atom,
  useMarketWatchListV2Atom,
} from './atoms';

const mockGetWatchList = jest.fn<
  Promise<{ data: IMarketWatchListItemV2[] }>,
  []
>();
const mockAddWatchList = jest.fn<Promise<void>, [unknown]>();
const mockRemoveWatchList = jest.fn<Promise<void>, [unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      getMarketWatchListV2: () => mockGetWatchList(),
      addMarketWatchListV2: (params: unknown) => mockAddWatchList(params),
      removeMarketWatchListV2: (params: unknown) => mockRemoveWatchList(params),
    },
    serviceRookieGuide: {
      recordTaskCompleted: jest.fn(async () => undefined),
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createWrapper() {
  const store = createStore();

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextMarketV2 store={store}>
        {children}
      </ProviderJotaiContextMarketV2>
    );
  }

  return { store, Wrapper };
}

function useWatchListTestHook() {
  const actions = useWatchListV2Actions().current;
  const [watchList] = useMarketWatchListV2Atom();
  return { actions, watchList };
}

const btc: IMarketWatchListItemV2 = {
  chainId: 'btc--0',
  contractAddress: '',
};
const eth: IMarketWatchListItemV2 = {
  chainId: 'evm--1',
  contractAddress: '0x1',
};

describe('marketV2 watchlist actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWatchList.mockResolvedValue({ data: [] });
  });

  it('refreshes only after all queued optimistic mutations finish', async () => {
    const firstRequest = deferred<void>();
    const secondRequest = deferred<void>();
    mockAddWatchList
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(useWatchListTestHook, {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.watchList.isMounted).toBe(true));
    mockGetWatchList.mockResolvedValueOnce({ data: [btc, eth] });

    let firstMutation!: Promise<void>;
    let secondMutation!: Promise<void>;
    act(() => {
      firstMutation = result.current.actions.addIntoWatchListV2(btc);
      secondMutation = result.current.actions.addIntoWatchListV2(eth);
    });

    expect(result.current.watchList.data).toEqual([
      expect.objectContaining(btc),
      expect.objectContaining(eth),
    ]);
    await act(async () => {
      firstRequest.resolve();
      await firstMutation;
    });

    expect(mockGetWatchList).toHaveBeenCalledTimes(1);
    expect(result.current.watchList.data).toEqual([
      expect.objectContaining(btc),
      expect.objectContaining(eth),
    ]);

    await act(async () => {
      secondRequest.resolve();
      await secondMutation;
    });
    expect(mockGetWatchList).toHaveBeenCalledTimes(2);
  });

  it('rolls back a failed add after a refresh replaces the optimistic object', async () => {
    const request = deferred<void>();
    const refreshedBtc = { ...btc };
    mockAddWatchList.mockImplementationOnce(() => request.promise);

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(useWatchListTestHook, {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.watchList.isMounted).toBe(true));
    let mutation!: Promise<void>;
    act(() => {
      mutation = result.current.actions.addIntoWatchListV2(btc);
    });
    act(() => {
      store.set(marketWatchListV2Atom(), { data: [refreshedBtc] });
    });
    expect(result.current.watchList.data[0]).toBe(refreshedBtc);

    const error = new Error('add failed');
    await act(async () => {
      request.reject(error);
      await expect(mutation).rejects.toBe(error);
    });
    expect(result.current.watchList.data).toEqual([]);
  });

  it('deduplicates same-token mutations while one is pending', async () => {
    const addRequest = deferred<void>();
    const removeRequest = deferred<void>();
    mockAddWatchList.mockImplementationOnce(() => addRequest.promise);
    mockRemoveWatchList.mockImplementationOnce(() => removeRequest.promise);

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(useWatchListTestHook, {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.watchList.isMounted).toBe(true));

    let add!: Promise<void>;
    let duplicateAdd!: Promise<void>;
    act(() => {
      add = result.current.actions.addIntoWatchListV2(btc);
      duplicateAdd = result.current.actions.addIntoWatchListV2(btc);
    });
    await waitFor(() => expect(mockAddWatchList).toHaveBeenCalledTimes(1));
    const addError = new Error('add failed');
    await act(async () => {
      addRequest.reject(addError);
      await expect(add).rejects.toBe(addError);
      await expect(duplicateAdd).rejects.toBe(addError);
    });
    expect(result.current.watchList.data).toEqual([]);

    act(() => {
      store.set(marketWatchListV2Atom(), { data: [btc] });
    });
    let remove!: Promise<void>;
    let duplicateRemove!: Promise<void>;
    act(() => {
      remove = result.current.actions.removeFromWatchListV2(
        btc.chainId,
        btc.contractAddress,
      );
      duplicateRemove = result.current.actions.removeFromWatchListV2(
        btc.chainId,
        btc.contractAddress,
      );
    });
    await waitFor(() => expect(mockRemoveWatchList).toHaveBeenCalledTimes(1));
    const removeError = new Error('remove failed');
    await act(async () => {
      removeRequest.reject(removeError);
      await expect(remove).rejects.toBe(removeError);
      await expect(duplicateRemove).rejects.toBe(removeError);
    });
    expect(result.current.watchList.data).toEqual([btc]);
  });

  it('queues a remove behind an in-flight add for the same token', async () => {
    const addRequest = deferred<void>();
    const removeRequest = deferred<void>();
    mockAddWatchList.mockImplementationOnce(() => addRequest.promise);
    mockRemoveWatchList.mockImplementationOnce(() => removeRequest.promise);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(useWatchListTestHook, { wrapper: Wrapper });
    await waitFor(() => expect(result.current.watchList.isMounted).toBe(true));

    let add!: Promise<void>;
    let remove!: Promise<void>;
    act(() => {
      add = result.current.actions.addIntoWatchListV2(btc);
      remove = result.current.actions.removeFromWatchListV2(
        btc.chainId,
        btc.contractAddress,
      );
    });
    await waitFor(() => expect(mockAddWatchList).toHaveBeenCalledTimes(1));
    expect(mockRemoveWatchList).not.toHaveBeenCalled();

    await act(async () => {
      addRequest.resolve();
      await add;
    });
    await waitFor(() => expect(mockRemoveWatchList).toHaveBeenCalledTimes(1));
    expect(result.current.watchList.data).toEqual([]);

    await act(async () => {
      removeRequest.resolve();
      await remove;
    });
  });

  it('queues an add behind an in-flight remove for the same token', async () => {
    const removeRequest = deferred<void>();
    const addRequest = deferred<void>();
    mockRemoveWatchList.mockImplementationOnce(() => removeRequest.promise);
    mockAddWatchList.mockImplementationOnce(() => addRequest.promise);
    mockGetWatchList.mockResolvedValue({ data: [btc] });

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(useWatchListTestHook, { wrapper: Wrapper });
    await waitFor(() => expect(result.current.watchList.isMounted).toBe(true));
    act(() => {
      store.set(marketWatchListV2Atom(), { data: [btc] });
    });

    let remove!: Promise<void>;
    let add!: Promise<void>;
    act(() => {
      remove = result.current.actions.removeFromWatchListV2(
        btc.chainId,
        btc.contractAddress,
      );
      add = result.current.actions.addIntoWatchListV2(btc);
    });
    await waitFor(() => expect(mockRemoveWatchList).toHaveBeenCalledTimes(1));
    expect(mockAddWatchList).not.toHaveBeenCalled();

    await act(async () => {
      removeRequest.resolve();
      await remove;
    });
    await waitFor(() => expect(mockAddWatchList).toHaveBeenCalledTimes(1));
    expect(result.current.watchList.data).toEqual([btc]);

    await act(async () => {
      addRequest.resolve();
      await add;
    });
  });
});
