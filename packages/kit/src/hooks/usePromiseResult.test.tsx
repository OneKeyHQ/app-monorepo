/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */
/* eslint-disable react-hooks/exhaustive-deps */

// Polyfill requestIdleCallback/cancelIdleCallback for non-native environments
if (typeof globalThis.requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = (cb: () => void) =>
    setTimeout(cb, 0);
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

import { useRef } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react-native';

// In the harness (Hermes on device), platformEnv.isHarness is set by
// harness/polyfills.ts. When running on device, platformEnv must reflect
// native values so useVisibilityChange uses AppState instead of document.
jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const real = jest.requireActual('@onekeyhq/shared/src/platformEnv');
  const realEnv = real?.default ?? real;
  const inHarness = realEnv?.isHarness === true;
  return {
    __esModule: true,
    default: inHarness
      ? { ...realEnv, isWeb: false, isRuntimeBrowser: false }
      : {
          isNative: false,
          isDesktop: false,
          isWeb: true,
          isRuntimeBrowser: true,
          isRuntimeChrome: false,
        },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../components/src/hooks/useNetInfo');

  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
  };
});

import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

// eslint-disable-next-line import/no-relative-packages
import { globalNetInfo } from '../../../components/src/hooks/useNetInfo';

import { usePromiseResult } from './usePromiseResult';

function usePromiseResultWithRenderCount(
  method: () => Promise<string>,
  options?: Parameters<typeof usePromiseResult<string>>[2],
) {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const state = usePromiseResult(method, [method], options);

  return {
    renderCount: renderCountRef.current,
    ...state,
  };
}

describe('usePromiseResult', () => {
  beforeEach(() => {
    globalNetInfo.listeners = [];
    globalNetInfo.state = { isInternetReachable: null };
    globalNetInfo.prevIsInternetReachable = false;
  });

  it('does not rerender on netinfo updates when reconnect revalidation is disabled', async () => {
    const method = jest.fn(async () => 'done');

    const { result } = renderHook(() =>
      usePromiseResultWithRenderCount(method),
    );

    await waitFor(() => {
      expect(result.current.result).toBe('done');
    });

    const renderCountAfterLoad = result.current.renderCount;

    expect(method).toHaveBeenCalledTimes(1);
    expect(globalNetInfo.listeners).toHaveLength(0);

    act(() => {
      globalNetInfo.updateState({ isInternetReachable: false });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(method).toHaveBeenCalledTimes(1);
    expect(result.current.renderCount).toBe(renderCountAfterLoad);
  });

  it('revalidates when network recovers if reconnect revalidation is enabled', async () => {
    globalNetInfo.state = { isInternetReachable: false };

    // On native (harness), AppState visibility callbacks may trigger extra
    // re-validations during initial render. Use a flag to control the return
    // value so recovery is deterministic regardless of call count.
    let recovered = false;
    const method = jest.fn(async () =>
      recovered ? 'after-recovery' : 'before-recovery',
    );

    const { result } = renderHook(() =>
      usePromiseResultWithRenderCount(method, {
        revalidateOnReconnect: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.result).toBe('before-recovery');
    });

    const callsBeforeRecovery = method.mock.calls.length;
    expect(callsBeforeRecovery).toBeGreaterThanOrEqual(1);
    expect(globalNetInfo.listeners).toHaveLength(1);

    // Flip the flag, then trigger network recovery
    recovered = true;
    act(() => {
      globalNetInfo.updateState({ isInternetReachable: true });
    });

    await waitFor(() => {
      expect(result.current.result).toBe('after-recovery');
    });

    // At least one additional call after recovery
    expect(method.mock.calls.length).toBeGreaterThan(callsBeforeRecovery);
  });

  describe('swrKey', () => {
    beforeEach(() => {
      swrCacheUtils.clearAll();
    });

    it('uses cached value as initial result on mount', async () => {
      swrCacheUtils.set('test-key', 'cached-value');

      const method = jest.fn(async () => 'fresh-value');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { swrKey: 'test-key' }),
      );

      // Initial render should have the cached value immediately
      expect(result.current.result).toBe('cached-value');

      // After async resolution, should update to fresh value
      await waitFor(() => {
        expect(result.current.result).toBe('fresh-value');
      });
    });

    it('writes fresh result to SWR cache on success', async () => {
      const method = jest.fn(async () => 'fresh-value');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { swrKey: 'write-test' }),
      );

      await waitFor(() => {
        expect(result.current.result).toBe('fresh-value');
      });

      expect(swrCacheUtils.get('write-test')).toBe('fresh-value');
    });

    it('overrides explicit initResult with cached value', async () => {
      swrCacheUtils.set('override-test', 'cached-value');

      const method = jest.fn(async () => 'fresh-value');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'explicit-init',
          swrKey: 'override-test',
        }),
      );

      // Cache hit should take precedence over explicit initResult.
      expect(result.current.result).toBe('cached-value');

      await waitFor(() => {
        expect(result.current.result).toBe('fresh-value');
      });
    });

    it('uses explicit initResult when cache misses', async () => {
      const method = jest.fn(async () => 'fresh-value');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'explicit-init',
          swrKey: 'missing-cache-key',
        }),
      );

      expect(result.current.result).toBe('explicit-init');

      await waitFor(() => {
        expect(result.current.result).toBe('fresh-value');
      });
    });

    it('returns undefined initially when no cache exists', async () => {
      const method = jest.fn(async () => 'fresh-value');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { swrKey: 'no-cache-key' }),
      );

      // No cache, no initResult → undefined
      expect(result.current.result).toBeUndefined();

      await waitFor(() => {
        expect(result.current.result).toBe('fresh-value');
      });
    });

    it('syncs result to new swrKey cached value immediately when key changes', () => {
      swrCacheUtils.set('wallet-A', 'data-A');
      swrCacheUtils.set('wallet-B', 'data-B');

      // Pending promise — never resolves in this test, so we can assert
      // the synchronous cache swap without an async revalidation winning.
      const method = jest.fn(() => new Promise<string>(() => {}));

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string }
      >(({ swrKey }) => usePromiseResult(method, [swrKey], { swrKey }), {
        initialProps: { swrKey: 'wallet-A' },
      });

      expect(result.current.result).toBe('data-A');

      rerender({ swrKey: 'wallet-B' });

      // Must be synchronous: no await, no waitFor.
      expect(result.current.result).toBe('data-B');
    });

    it('falls back to initResult when new swrKey has no cached entry', () => {
      swrCacheUtils.set('wallet-A', 'data-A');

      const method = jest.fn(() => new Promise<string>(() => {}));

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string }
      >(
        ({ swrKey }) =>
          usePromiseResult(method, [swrKey], {
            initResult: 'init-value',
            swrKey,
          }),
        { initialProps: { swrKey: 'wallet-A' } },
      );

      expect(result.current.result).toBe('data-A');

      rerender({ swrKey: 'wallet-B' });

      // New key has no cache → fall back to initResult, NOT previous scope's data.
      expect(result.current.result).toBe('init-value');
    });

    it('resets to initResult when swrKey transitions from defined to undefined', () => {
      swrCacheUtils.set('wallet-A', 'data-A');

      const method = jest.fn(() => new Promise<string>(() => {}));

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string | undefined }
      >(
        ({ swrKey }) =>
          usePromiseResult(method, [swrKey], {
            initResult: 'init-value',
            swrKey,
          }),
        { initialProps: { swrKey: 'wallet-A' as string | undefined } },
      );

      expect(result.current.result).toBe('data-A');

      rerender({ swrKey: undefined });

      // key→undefined: no cache to read, must reset to initResult.
      expect(result.current.result).toBe('init-value');
    });

    it('resets to undefined when swrKey transitions to undefined without initResult', () => {
      swrCacheUtils.set('wallet-A', 'data-A');

      const method = jest.fn(() => new Promise<string>(() => {}));

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string | undefined }
      >(({ swrKey }) => usePromiseResult(method, [swrKey], { swrKey }), {
        initialProps: { swrKey: 'wallet-A' as string | undefined },
      });

      expect(result.current.result).toBe('data-A');

      rerender({ swrKey: undefined });

      // key→undefined, no initResult → must not keep previous scope's data.
      expect(result.current.result).toBeUndefined();
    });

    it('resets to undefined when new swrKey has neither cache nor initResult', () => {
      swrCacheUtils.set('wallet-A', 'data-A');

      const method = jest.fn(() => new Promise<string>(() => {}));

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string }
      >(({ swrKey }) => usePromiseResult(method, [swrKey], { swrKey }), {
        initialProps: { swrKey: 'wallet-A' },
      });

      expect(result.current.result).toBe('data-A');

      rerender({ swrKey: 'wallet-B' });

      // No cache, no initResult → must not keep showing previous scope.
      expect(result.current.result).toBeUndefined();
    });
  });
});
