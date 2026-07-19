import { act, renderHook } from '@testing-library/react-native';

import type { IHomeDefaultToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import {
  loadNativeHomeDefaultTokenMap,
  resolveNativeHomeDefaultTokenProjection,
  useNativeHomeDefaultTokenMap,
} from './useNativeHomeDefaultTokenMap';

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      getHomeDefaultTokenMap: jest.fn(),
    },
  },
}));

const getHomeDefaultTokenMapMock = jest.spyOn(
  backgroundApiProxy.serviceToken,
  'getHomeDefaultTokenMap',
);

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const createDeferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('native Home default token map', () => {
  it('degrades safely after a BG rejection and recovers on the next attempt', async () => {
    const recoveredMap: Record<string, IHomeDefaultToken> = {
      'onekeyall--0_BTC': {
        logoURI: '',
        networkId: 'onekeyall--0',
        order: 1,
        symbol: 'BTC',
      },
    };
    const fetchMap = jest
      .fn<Promise<Record<string, IHomeDefaultToken>>, []>()
      .mockRejectedValueOnce(new Error('bg not ready'))
      .mockResolvedValueOnce(recoveredMap);

    const failed = await loadNativeHomeDefaultTokenMap({
      fetchMap,
      previousMap: {},
    });
    expect(failed).toEqual({ map: {}, status: 'error' });
    expect(resolveNativeHomeDefaultTokenProjection(failed.status)).toEqual({
      hideZeroBalanceTokens: false,
      initialized: true,
    });

    const recovered = await loadNativeHomeDefaultTokenMap({
      fetchMap,
      previousMap: failed.map,
    });
    expect(recovered).toEqual({ map: recoveredMap, status: 'success' });
    expect(resolveNativeHomeDefaultTokenProjection(recovered.status)).toEqual({
      hideZeroBalanceTokens: true,
      initialized: true,
    });
  });
});

describe('useNativeHomeDefaultTokenMap', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getHomeDefaultTokenMapMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps scheduling retries after consecutive BG rejections', async () => {
    getHomeDefaultTokenMapMock
      .mockRejectedValueOnce(new Error('bg not ready 1'))
      .mockRejectedValueOnce(new Error('bg not ready 2'))
      .mockResolvedValueOnce({});
    const { result } = renderHook(() =>
      useNativeHomeDefaultTokenMap({ retryDelayMs: 100 }),
    );

    await flushMicrotasks();
    expect(result.current.status).toBe('error');
    expect(getHomeDefaultTokenMapMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(getHomeDefaultTokenMapMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('error');

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(getHomeDefaultTokenMapMock).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('success');
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(getHomeDefaultTokenMapMock).toHaveBeenCalledTimes(3);
  });

  it('clears a pending retry timer on unmount', async () => {
    getHomeDefaultTokenMapMock.mockRejectedValue(new Error('bg not ready'));
    const { unmount } = renderHook(() =>
      useNativeHomeDefaultTokenMap({ retryDelayMs: 100 }),
    );

    await flushMicrotasks();
    expect(getHomeDefaultTokenMapMock).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(getHomeDefaultTokenMapMock).toHaveBeenCalledTimes(1);
  });

  it('does not let a stale request overwrite a newer generation', async () => {
    const stale = createDeferred<Record<string, IHomeDefaultToken>>();
    const current = createDeferred<Record<string, IHomeDefaultToken>>();
    const staleMap = {
      stale: {
        logoURI: '',
        networkId: 'onekeyall--0',
        order: 2,
        symbol: 'STALE',
      },
    };
    const currentMap = {
      current: {
        logoURI: '',
        networkId: 'onekeyall--0',
        order: 1,
        symbol: 'CURRENT',
      },
    };
    getHomeDefaultTokenMapMock
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise);
    const { result } = renderHook(() => useNativeHomeDefaultTokenMap());

    await act(async () => {
      const refreshTask = result.current.refresh();
      current.resolve(currentMap);
      await refreshTask;
    });
    expect(result.current).toMatchObject({
      map: currentMap,
      status: 'success',
    });

    await act(async () => {
      stale.resolve(staleMap);
      await stale.promise;
    });
    expect(result.current).toMatchObject({
      map: currentMap,
      status: 'success',
    });
  });
});
