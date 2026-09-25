/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IBorrowEModeStatus,
  IBorrowHealthFactor,
  IBorrowRewards,
} from '@onekeyhq/shared/types/staking';

const mockGetHealthFactor = jest.fn<Promise<unknown>, unknown[]>();
const mockGetRewards = jest.fn<Promise<unknown>, unknown[]>();
const mockGetEModeStatus = jest.fn<Promise<unknown>, unknown[]>();
const mockGetCache = jest.fn<unknown, unknown[]>();

type IScopedResult = {
  scopeKey: string;
  state: 'resolved' | 'error' | 'cancelled';
  data?: unknown;
  eModeStatus?: unknown;
  fromFreshCache?: boolean;
  accountGeneration?: number;
  resolvedAt?: number;
};

const mockPromiseResults: {
  method: () => Promise<IScopedResult>;
  deps: unknown[];
  swrShouldPersist?: (result: IScopedResult) => boolean;
}[] = [];
let mockResultSnapshot: IScopedResult | null = null;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowHealthFactor: (...args: unknown[]) =>
        mockGetHealthFactor(...args),
      getBorrowRewards: (...args: unknown[]) => mockGetRewards(...args),
      getBorrowEModeStatus: (...args: unknown[]) => mockGetEModeStatus(...args),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/swrCacheUtils')
  >('@onekeyhq/shared/src/utils/swrCacheUtils'),
  swrCacheUtils: {
    getWithTimestamp: (...args: unknown[]) => mockGetCache(...args),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<IScopedResult>,
    deps: unknown[],
    options: { swrShouldPersist?: (result: IScopedResult) => boolean },
  ) => {
    mockPromiseResults.push({
      method,
      deps,
      swrShouldPersist: options.swrShouldPersist,
    });
    return {
      result: mockResultSnapshot,
      isLoading: undefined,
      run: () => method().then(() => undefined),
    };
  },
}));

import { useBorrowEModeStatus } from './useBorrowEModeStatus';
import { useBorrowHealthFactor } from './useBorrowHealthFactor';
import { useBorrowRewards } from './useBorrowRewards';

const healthFactor: IBorrowHealthFactor = {
  healthFactor: { text: { text: '1.5' } },
};
const rewards = {
  title: { text: 'Rewards' },
} as IBorrowRewards;
const eModeStatus: IBorrowEModeStatus = {
  eModeId: 0,
  originalLtv: '80',
  categories: [],
};

const baseParams = {
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: '0xMarket',
  accountId: 'account-1',
};

const cases = [
  {
    name: 'health factor',
    useHook: useBorrowHealthFactor,
    service: mockGetHealthFactor,
    payload: healthFactor,
    resultField: 'data',
    displayField: 'healthFactorData',
  },
  {
    name: 'rewards',
    useHook: useBorrowRewards,
    service: mockGetRewards,
    payload: rewards,
    resultField: 'data',
    displayField: 'borrowRewards',
  },
  {
    name: 'E-Mode status',
    useHook: useBorrowEModeStatus,
    service: mockGetEModeStatus,
    payload: eModeStatus,
    resultField: 'eModeStatus',
    displayField: 'eModeStatus',
  },
] as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Borrow metric request reuse', () => {
  beforeEach(() => {
    mockPromiseResults.length = 0;
    mockGetCache.mockReset();
    mockGetHealthFactor.mockReset();
    mockGetRewards.mockReset();
    mockGetEModeStatus.mockReset();
    mockResultSnapshot = null;
  });

  it.each(cases)(
    '$name joins the preload request after its worker unmounts',
    async ({ useHook, service, payload, resultField }) => {
      const pending = deferred<typeof payload>();
      service.mockReturnValueOnce(pending.promise);
      const worker = renderHook(() =>
        useHook({ ...baseParams, isPreloading: true }),
      );
      const workerMethod = mockPromiseResults.at(-1)?.method;
      const foreground = renderHook(() => useHook(baseParams));
      const foregroundMethod = mockPromiseResults.at(-1)?.method;

      const workerResult = workerMethod?.();
      const foregroundResult = foregroundMethod?.();
      await Promise.resolve();
      expect(service).toHaveBeenCalledTimes(1);

      worker.unmount();
      pending.resolve(payload);
      await expect(workerResult).resolves.toMatchObject({
        [resultField]: payload,
        state: 'resolved',
      });
      await expect(foregroundResult).resolves.toMatchObject({
        [resultField]: payload,
        state: 'resolved',
      });
      foreground.unmount();
    },
  );

  it.each(cases)(
    '$name uses a fresh preload snapshot once without extending its TTL',
    async ({ useHook, service, payload, resultField }) => {
      const scopeKey = JSON.stringify([
        baseParams.networkId,
        baseParams.provider,
        baseParams.marketAddress,
        baseParams.accountId,
        true,
      ]);
      mockGetCache.mockReturnValue({
        data: {
          scopeKey,
          state: 'resolved',
          [resultField]: payload,
        },
        updatedAt: Date.now() - 10_000,
      });
      service.mockResolvedValue(payload);
      const view = renderHook(() => useHook(baseParams));
      const { method, swrShouldPersist } = mockPromiseResults.at(-1) ?? {};

      const cachedResult = await method?.();
      expect(cachedResult).toMatchObject({
        [resultField]: payload,
        fromFreshCache: true,
      });
      expect(swrShouldPersist?.(cachedResult as IScopedResult)).toBe(false);
      expect(service).not.toHaveBeenCalled();

      await method?.();
      expect(service).toHaveBeenCalledTimes(1);
      view.unmount();
    },
  );

  it.each(cases)(
    '$name fetches when the preload snapshot is older than 60 seconds',
    async ({ useHook, service, payload, resultField }) => {
      const scopeKey = JSON.stringify([
        baseParams.networkId,
        baseParams.provider,
        baseParams.marketAddress,
        baseParams.accountId,
        true,
      ]);
      mockGetCache.mockReturnValue({
        data: {
          scopeKey,
          state: 'resolved',
          [resultField]: payload,
        },
        updatedAt: Date.now() - 60_001,
      });
      service.mockResolvedValue(payload);
      const view = renderHook(() => useHook(baseParams));
      const method = mockPromiseResults.at(-1)?.method;

      await expect(method?.()).resolves.toMatchObject({ state: 'resolved' });
      expect(service).toHaveBeenCalledTimes(1);
      view.unmount();
    },
  );

  it.each(cases)(
    '$name publishes a 61-second same-scope snapshot while requesting fresh data',
    async ({ useHook, service, payload, resultField, displayField }) => {
      const view = renderHook(() =>
        useHook({ ...baseParams, isPreloading: true }),
      );
      const accountGeneration = mockPromiseResults.at(-1)?.deps[0] as number;
      const scopeKey = JSON.stringify([
        baseParams.networkId,
        baseParams.provider,
        baseParams.marketAddress,
        baseParams.accountId,
        true,
      ]);
      mockResultSnapshot = {
        scopeKey,
        state: 'resolved',
        [resultField]: payload,
        accountGeneration,
        resolvedAt: Date.now() - 60_001,
      };
      view.rerender(undefined);
      expect(view.result.current).toMatchObject({
        [displayField]: payload,
        isInitialLoading: false,
        isReadyForMarketSwitch: true,
      });

      service.mockResolvedValue(payload);
      await mockPromiseResults.at(-1)?.method();
      expect(service).toHaveBeenCalledTimes(1);

      mockResultSnapshot = {
        ...mockResultSnapshot,
        resolvedAt: undefined,
      };
      view.rerender(undefined);
      expect(view.result.current.isReadyForMarketSwitch).toBe(false);

      mockResultSnapshot = {
        ...mockResultSnapshot,
        resolvedAt: Date.now(),
      };
      view.rerender(undefined);
      expect(view.result.current.isReadyForMarketSwitch).toBe(true);

      mockResultSnapshot = {
        ...mockResultSnapshot,
        resolvedAt: Date.now() - 30 * 60 * 1000 - 1,
      };
      view.rerender(undefined);
      expect(view.result.current).toMatchObject({
        [displayField]: null,
        isInitialLoading: true,
        isError: false,
        isReadyForMarketSwitch: false,
      });

      mockResultSnapshot = {
        scopeKey,
        state: 'error',
        [resultField]: null,
        accountGeneration,
        resolvedAt: Date.now() - 30 * 60 * 1000 - 1,
      };
      view.rerender(undefined);
      expect(view.result.current.isReadyForMarketSwitch).toBe(true);

      mockResultSnapshot = {
        ...mockResultSnapshot,
        state: 'cancelled',
      };
      view.rerender(undefined);
      expect(view.result.current.isReadyForMarketSwitch).toBe(false);
      view.unmount();
    },
  );

  it.each(cases)(
    '$name separates network, market and account request identities',
    async ({ useHook, service, payload }) => {
      const pending = deferred<typeof payload>();
      service.mockReturnValue(pending.promise);
      const scopes = [
        baseParams,
        { ...baseParams, networkId: 'evm--137' },
        { ...baseParams, marketAddress: '0xOtherMarket' },
        { ...baseParams, accountId: 'account-2' },
      ];
      const views = scopes.map((params) => renderHook(() => useHook(params)));
      const methods = mockPromiseResults.map(({ method }) => method);
      const results = methods.map((method) => method());
      await Promise.resolve();

      expect(service).toHaveBeenCalledTimes(scopes.length);
      expect(service.mock.calls.map(([params]) => params)).toEqual(scopes);

      pending.resolve(payload);
      await Promise.all(results);
      views.forEach((view) => view.unmount());
    },
  );

  it.each(cases)(
    '$name explicit refresh supersedes an older preload response',
    async ({ useHook, service, payload, resultField }) => {
      const preload = deferred<typeof payload>();
      const refresh = deferred<typeof payload>();
      service
        .mockReturnValueOnce(preload.promise)
        .mockReturnValueOnce(refresh.promise);
      const worker = renderHook(() =>
        useHook({ ...baseParams, isPreloading: true }),
      );
      const workerMethod = mockPromiseResults.at(-1)?.method;
      const workerShouldPersist = mockPromiseResults.at(-1)?.swrShouldPersist;
      const foreground = renderHook(() => useHook(baseParams));

      const preloadResult = workerMethod?.();
      const refreshResult = foreground.result.current.refresh();
      await Promise.resolve();
      expect(service).toHaveBeenCalledTimes(2);

      refresh.resolve(payload);
      await refreshResult;
      preload.resolve(payload);
      const staleResult = await preloadResult;
      expect(staleResult).toMatchObject({
        state: 'cancelled',
        [resultField]: null,
      });
      expect(workerShouldPersist?.(staleResult as IScopedResult)).toBe(false);
      worker.unmount();
      foreground.unmount();
    },
  );

  it.each(cases)(
    '$name clears a failed flight so a later request retries',
    async ({ useHook, service, payload }) => {
      const failed = deferred<typeof payload>();
      service.mockReturnValueOnce(failed.promise).mockResolvedValue(payload);
      const worker = renderHook(() =>
        useHook({ ...baseParams, isPreloading: true }),
      );
      const workerMethod = mockPromiseResults.at(-1)?.method;
      const foreground = renderHook(() => useHook(baseParams));
      const foregroundMethod = mockPromiseResults.at(-1)?.method;

      const first = workerMethod?.();
      const second = foregroundMethod?.();
      await Promise.resolve();
      expect(service).toHaveBeenCalledTimes(1);
      failed.reject(new Error('offline'));
      await expect(first).resolves.toMatchObject({ state: 'error' });
      await expect(second).resolves.toMatchObject({ state: 'error' });
      await expect(foregroundMethod?.()).resolves.toMatchObject({
        state: 'resolved',
      });
      expect(service).toHaveBeenCalledTimes(2);
      worker.unmount();
      foreground.unmount();
    },
  );

  it.each(cases)(
    '$name discards an old in-flight response and fallback after account invalidation',
    async ({ useHook, service, payload, resultField }) => {
      const scopeKey = JSON.stringify([
        baseParams.networkId,
        baseParams.provider,
        baseParams.marketAddress,
        baseParams.accountId,
        true,
      ]);
      mockResultSnapshot = {
        scopeKey,
        state: 'resolved',
        [resultField]: payload,
      };
      const pending = deferred<typeof payload>();
      service.mockReturnValueOnce(pending.promise);
      const view = renderHook(() => useHook(baseParams));
      const method = mockPromiseResults.at(-1)?.method;
      const oldRequest = method?.();
      await Promise.resolve();

      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountUpdate,
        payload: undefined,
      });
      pending.resolve(payload);
      await expect(oldRequest).resolves.toMatchObject({
        state: 'cancelled',
        [resultField]: null,
      });
      view.unmount();
    },
  );

  it.each(cases)(
    '$name re-dispatches the current scope when its account changes in place',
    async ({ useHook, service, payload, resultField }) => {
      const oldRequest = deferred<typeof payload>();
      service
        .mockReturnValueOnce(oldRequest.promise)
        .mockResolvedValue(payload);
      const view = renderHook(() => useHook(baseParams));
      const first = mockPromiseResults.at(-1);
      const firstResult = first?.method();
      await Promise.resolve();
      expect(service).toHaveBeenCalledTimes(1);

      mockResultSnapshot = {
        scopeKey: JSON.stringify([
          baseParams.networkId,
          baseParams.provider,
          baseParams.marketAddress,
          baseParams.accountId,
          true,
        ]),
        state: 'resolved',
        [resultField]: payload,
        accountGeneration: first?.deps[0] as number,
        resolvedAt: Date.now(),
      };
      view.rerender(undefined);
      expect(view.result.current.isInitialLoading).toBe(false);

      act(() => {
        appEventBus.emitToSelf({
          type: EAppEventBusNames.AccountUpdate,
          payload: undefined,
        });
      });
      expect(view.result.current).toMatchObject({
        isInitialLoading: true,
        isError: false,
        isReadyForMarketSwitch: false,
      });
      const second = mockPromiseResults.at(-1);
      expect(second?.deps[0]).not.toBe(first?.deps[0]);
      const secondResult = second?.method();
      await expect(secondResult).resolves.toMatchObject({
        state: 'resolved',
        [resultField]: payload,
      });

      oldRequest.resolve(payload);
      await expect(firstResult).resolves.toMatchObject({
        state: 'cancelled',
        [resultField]: null,
      });
      expect(service).toHaveBeenCalledTimes(2);
      view.unmount();
    },
  );
});
