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

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const ReactModule = require('react') as typeof import('react');
  let currentFocus = true;
  const listeners: Array<(v: boolean) => void> = [];

  const __setFocus = (v: boolean) => {
    if (currentFocus === v) return;
    currentFocus = v;
    listeners.slice().forEach((l) => l(v));
  };

  const __resetFocus = () => {
    currentFocus = true;
    listeners.slice().forEach((l) => l(true));
  };

  const useRouteIsFocused = () => {
    const [v, setV] = ReactModule.useState<boolean>(currentFocus);
    ReactModule.useEffect(() => {
      listeners.push(setV);
      // Sync any value that changed between render-init and effect-attach.
      setV(currentFocus);
      return () => {
        const idx = listeners.indexOf(setV);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }, []);
    return v;
  };

  return {
    useRouteIsFocused,
    __setFocus,
    __resetFocus,
  };
});

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const focusControl = require('@onekeyhq/kit/src/hooks/useRouteIsFocused') as {
  __setFocus: (v: boolean) => void;
  __resetFocus: () => void;
};

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

    // The catch path must respect scope identity too. AbortError is
    // raised on every caller that uses cancellable storage (IndexedDB
    // transactions during search), not just opt-in
    // `undefinedResultIfError` consumers, so a stale rejection from
    // scope A could otherwise wipe scope B's loaded data to undefined.
    it('discards error-path undefined reset when swrKey changes mid-flight', async () => {
      swrCacheUtils.set('B', 'B-data');

      let rejectFetch!: (e: unknown) => void;
      const method = jest.fn(
        () =>
          new Promise<string>((_, rej) => {
            rejectFetch = rej;
          }),
      );

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string }
      >(
        ({ swrKey }) =>
          usePromiseResult(method, [], {
            initResult: 'init',
            swrKey,
            undefinedResultIfError: true,
          }),
        { initialProps: { swrKey: 'A' } },
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });

      rerender({ swrKey: 'B' });
      expect(result.current.result).toBe('B-data');

      await act(async () => {
        rejectFetch(new Error('boom'));
        await Promise.resolve();
      });

      // The A-scope rejection must not wipe the B-scope's loaded data.
      expect(result.current.result).toBe('B-data');
    });

    // Cross-scope guard for swrKey transitions: an in-flight request
    // dispatched under swrKey=A must not land on the new scope when the
    // consumer rerenders with swrKey=B. The render-time swrKey swap only
    // updates `result` to B's init/cached value; nothing currently
    // invalidates A's pending nonce, so without an extra check the stale
    // result would overwrite the new scope.
    it('discards in-flight result when swrKey changes mid-flight', async () => {
      const resolvers: Record<string, (v: string) => void> = {};
      const method = jest.fn(
        (key: string) =>
          new Promise<string>((res) => {
            resolvers[key] = res;
          }),
      );

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { swrKey: string }
      >(
        ({ swrKey }) =>
          usePromiseResult(() => method(swrKey), [], {
            initResult: 'init',
            swrKey,
          }),
        { initialProps: { swrKey: 'A' } },
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledWith('A');
      });

      // swrKey swap to B. Deps are stable so no new runner fires; the
      // render-time effect resets `result` to B's init.
      rerender({ swrKey: 'B' });
      expect(result.current.result).toBe('init');

      await act(async () => {
        resolvers.A('A-data');
        await Promise.resolve();
      });

      // A's stale result must not be applied under the B scope.
      expect(result.current.result).toBe('init');
      // SWR cache for either scope must not be polluted by stale data.
      expect(swrCacheUtils.get('A')).toBeUndefined();
      expect(swrCacheUtils.get('B')).toBeUndefined();
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

  describe('setStopPolling', () => {
    const POLLING_MS = 1000;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Advance fake timers and drain queued microtasks so awaited promise
    // chains inside the runner (`await wait(ms)` → `await defer.promise` →
    // setResult → finally) actually progress. testing-library's `waitFor`
    // can't help here: it polls via real setTimeout, which is also faked.
    const tick = async (ms = 0) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
        for (let i = 0; i < 10; i += 1) {
          await Promise.resolve();
        }
      });
    };

    it('skips the next polling tick once setStopPolling(true) is called', async () => {
      const method = jest.fn(async () => 'ok');

      const { result } = renderHook(() =>
        usePromiseResult(method, [], { pollingInterval: POLLING_MS }),
      );

      // Mount-time effect schedules the first run via setTimeout.
      await tick(0);
      const callsAfterMount = method.mock.calls.length;
      expect(callsAfterMount).toBeGreaterThanOrEqual(1);

      // One full interval → next polling tick should land.
      await tick(POLLING_MS);
      expect(method.mock.calls.length).toBeGreaterThan(callsAfterMount);
      const callsBeforeStop = method.mock.calls.length;

      act(() => {
        result.current.setStopPolling(true);
      });

      // Multiple intervals pass — finally-block sees stopPollingRef.current
      // and bails before scheduling the next run.
      await tick(POLLING_MS * 5);
      expect(method.mock.calls.length).toBe(callsBeforeStop);
    });

    it('auto-resumes polling when deps change after stopPolling', async () => {
      const method = jest.fn(async (_dep: string) => 'ok');

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { dep: string }
      >(
        ({ dep }) =>
          usePromiseResult(() => method(dep), [dep], {
            pollingInterval: POLLING_MS,
          }),
        { initialProps: { dep: 'a' } },
      );

      await tick(0);
      expect(method).toHaveBeenCalledWith('a');
      const callsAfterMount = method.mock.calls.length;

      act(() => {
        result.current.setStopPolling(true);
      });

      await tick(POLLING_MS * 3);
      expect(method.mock.calls.length).toBe(callsAfterMount);

      // Deps change → runnerDeps effect clears stopPollingRef and fires a
      // new run with the new input.
      rerender({ dep: 'b' });
      await tick(0);
      expect(method).toHaveBeenCalledWith('b');
      const callsAfterRerender = method.mock.calls.length;

      // Subsequent ticks resume normally on the new deps.
      await tick(POLLING_MS);
      expect(method.mock.calls.length).toBeGreaterThan(callsAfterRerender);
    });

    it('resumes polling immediately when setStopPolling(false) clears a prior stop', async () => {
      const method = jest.fn(async () => 'ok');

      const { result } = renderHook(() =>
        usePromiseResult(method, [], { pollingInterval: POLLING_MS }),
      );

      await tick(0);
      const callsAfterMount = method.mock.calls.length;
      expect(callsAfterMount).toBeGreaterThanOrEqual(1);

      act(() => {
        result.current.setStopPolling(true);
      });

      // Polling paused: ticks pass without new calls.
      await tick(POLLING_MS * 3);
      expect(method.mock.calls.length).toBe(callsAfterMount);

      // Manual clear must resurrect the dead chain — fire one request now,
      // and continue polling on subsequent ticks. Without the resume path
      // the finally-block guard would never schedule another tick.
      act(() => {
        result.current.setStopPolling(false);
      });

      await tick(0);
      const callsAfterResume = method.mock.calls.length;
      expect(callsAfterResume).toBeGreaterThan(callsAfterMount);

      await tick(POLLING_MS);
      expect(method.mock.calls.length).toBeGreaterThan(callsAfterResume);
    });
  });

  describe('debounced', () => {
    const DEBOUNCE_MS = 100;

    beforeEach(() => {
      focusControl.__resetFocus();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const tick = async (ms = 0) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
        for (let i = 0; i < 10; i += 1) {
          await Promise.resolve();
        }
      });
    };

    // The wrapper used to pre-call `setLoadingTrue()` synchronously
    // before scheduling the debounced runner. If the page blurred
    // during the debounce window, the inner runner fired under the
    // focus gate and never started a request — so `didStartRequest`
    // stayed false and `finally` skipped `setLoadingFalse()`. The
    // pre-loaded `isLoading=true` then leaked forever until refocus +
    // re-run. Move loading transitions inside the runner so they only
    // emit when the request actually starts.
    it('does not leak isLoading=true when the debounced runner is gated by blur after the timer was scheduled', async () => {
      const method = jest.fn(async () => 'data');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'init',
          watchLoading: true,
          debounced: DEBOUNCE_MS,
        }),
      );

      // Drain mount effect — the debounced wrapper scheduled the inner
      // runner via setTimeout but it has not fired yet.
      await tick(0);

      act(() => {
        focusControl.__setFocus(false);
      });

      // Advance past the debounce window. Inner runner fires under
      // blur and never starts a request.
      await tick(DEBOUNCE_MS * 2);

      expect(result.current.isLoading).not.toBe(true);
      expect(method).not.toHaveBeenCalled();
    });

    // Lock the happy path: when focus holds through the debounce
    // window, the runner starts, completes, and the loading
    // transitions pair correctly.
    it('still emits paired loading transitions for a debounced run that completes under focus', async () => {
      const onIsLoadingChange = jest.fn();
      const method = jest.fn(async () => 'data');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'init',
          watchLoading: true,
          debounced: DEBOUNCE_MS,
          onIsLoadingChange,
        }),
      );

      await tick(0);
      await tick(DEBOUNCE_MS * 2);

      expect(method).toHaveBeenCalledTimes(1);
      expect(result.current.result).toBe('data');
      expect(result.current.isLoading).toBe(false);
      expect(onIsLoadingChange).toHaveBeenCalledWith(true);
      expect(onIsLoadingChange).toHaveBeenCalledWith(false);
    });
  });

  describe('focus gating', () => {
    beforeEach(() => {
      focusControl.__resetFocus();
    });

    it('applies result when focused throughout the fetch', async () => {
      const method = jest.fn(async () => 'data');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { initResult: 'init' }),
      );

      await waitFor(() => {
        expect(result.current.result).toBe('data');
      });
      expect(method).toHaveBeenCalledTimes(1);
    });

    it('does not start fetch when not focused at mount (default checkIsFocused: true)', async () => {
      act(() => {
        focusControl.__setFocus(false);
      });

      const method = jest.fn(async () => 'data');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { initResult: 'init' }),
      );

      // Let any synchronous async cycles flush.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(method).not.toHaveBeenCalled();
      expect(result.current.result).toBe('init');
    });

    it('fires the deferred fetch once focus is regained', async () => {
      act(() => {
        focusControl.__setFocus(false);
      });

      const method = jest.fn(async () => 'data');

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { initResult: 'init' }),
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(method).not.toHaveBeenCalled();

      act(() => {
        focusControl.__setFocus(true);
      });

      await waitFor(() => {
        expect(result.current.result).toBe('data');
      });
      expect(method).toHaveBeenCalledTimes(1);
    });

    it('alwaysSetState: true bypasses focus gate at fetch resolution', async () => {
      let resolveFetch!: (v: string) => void;
      const method = jest.fn(
        () =>
          new Promise<string>((res) => {
            resolveFetch = res;
          }),
      );

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'init',
          alwaysSetState: true,
        }),
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });

      act(() => {
        focusControl.__setFocus(false);
      });

      await act(async () => {
        resolveFetch('fresh');
        await Promise.resolve();
      });

      // alwaysSetState forces the result through even while blurred.
      await waitFor(() => {
        expect(result.current.result).toBe('fresh');
      });
    });

    // The "Freeze absorbs the render" property of react-native-screens
    // is a production runtime behavior — jest has no Freeze, so we can
    // only verify the hook's own contribution: blur-time fetch resolution
    // should call setResult exactly once, no thrashing. In production
    // that single render is queued by Freeze and flushed on unfreeze.
    it('issues at most one extra setResult per fetch when blurred mid-flight (perf bound)', async () => {
      let resolveFetch!: (v: string) => void;
      const method = jest.fn(
        () =>
          new Promise<string>((res) => {
            resolveFetch = res;
          }),
      );

      const { result } = renderHook(() =>
        usePromiseResultWithRenderCount(method, { initResult: 'init' }),
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });

      act(() => {
        focusControl.__setFocus(false);
      });
      const rendersAfterBlur = result.current.renderCount;

      await act(async () => {
        resolveFetch('fresh');
        await Promise.resolve();
      });

      // Blur-time renders attributable to the fix: at most one for the
      // setResult that preserves the in-flight result. Anything beyond
      // that would mean we are doing extra work the Freeze cannot absorb.
      const blurRenderDelta = result.current.renderCount - rendersAfterBlur;
      expect(blurRenderDelta).toBeLessThanOrEqual(1);

      act(() => {
        focusControl.__setFocus(true);
      });

      await waitFor(() => {
        expect(result.current.result).toBe('fresh');
      });

      // No follow-up fetch is needed — the in-flight one delivered.
      expect(method).toHaveBeenCalledTimes(1);
    });

    // Cross-scope guard (PR #11681 review): when deps change while the
    // route is blurred, the new triggerByDeps run is gated by focus and
    // does not mint a fresh nonce. Without invalidation, an in-flight
    // stale request from the previous scope (matching the original
    // nonce) would satisfy shouldApplyResult (mount-only) and overwrite
    // the new scope's init / cached state. Bumping nonceRef on the
    // gated run prevents this cross-scope leak.
    it('discards in-flight result when deps change during blur (cross-scope guard)', async () => {
      const resolvers: Record<string, (v: string) => void> = {};
      const method = jest.fn(
        (id: string) =>
          new Promise<string>((res) => {
            resolvers[id] = res;
          }),
      );

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { id: string }
      >(
        ({ id }) =>
          usePromiseResult(() => method(id), [id], { initResult: 'init' }),
        { initialProps: { id: 'A' } },
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledWith('A');
      });
      expect(result.current.result).toBe('init');

      // Blur, then deps change to B. The triggerByDeps run for B is
      // gated by focus and no fetch is dispatched yet.
      act(() => {
        focusControl.__setFocus(false);
      });
      rerender({ id: 'B' });

      // A's stale in-flight request resolves while the new scope is B.
      await act(async () => {
        resolvers.A('A-data');
        await Promise.resolve();
      });

      // The previous scope's data must not land on the new scope.
      expect(result.current.result).toBe('init');

      // Refocus → B's deferred fetch fires → result reflects new scope.
      act(() => {
        focusControl.__setFocus(true);
      });

      await waitFor(() => {
        expect(method).toHaveBeenCalledWith('B');
      });

      await act(async () => {
        resolvers.B('B-data');
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.result).toBe('B-data');
      });
    });

    // setLoadingFalse must travel with setResult: if result landing is
    // not blocked by focus, isLoading clearing has to follow the same
    // gate. Otherwise `watchLoading` consumers (spinners /
    // onIsLoadingChange) see isLoading stuck on `true` after a
    // successful blur-time resolution.
    it('clears isLoading when result lands during blur (watchLoading)', async () => {
      let resolveFetch!: (v: string) => void;
      const method = jest.fn(
        () =>
          new Promise<string>((res) => {
            resolveFetch = res;
          }),
      );

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'init',
          watchLoading: true,
        }),
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      act(() => {
        focusControl.__setFocus(false);
      });

      await act(async () => {
        resolveFetch('fresh');
        await Promise.resolve();
      });

      expect(result.current.result).toBe('fresh');
      expect(result.current.isLoading).toBe(false);
    });

    // The error path must mirror the success path: if the success branch
    // applies blur-time results, then `undefinedResultIfError` callers
    // also expect their `undefined` reset to land regardless of focus,
    // not to be silently swallowed and re-thrown as an unhandled
    // rejection.
    it('applies undefinedResultIfError when fetch rejects during blur', async () => {
      let rejectFetch!: (e: unknown) => void;
      const method = jest.fn(
        () =>
          new Promise<string>((_, rej) => {
            rejectFetch = rej;
          }),
      );

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'init',
          undefinedResultIfError: true,
        }),
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });

      act(() => {
        focusControl.__setFocus(false);
      });

      await act(async () => {
        rejectFetch(new Error('boom'));
        await Promise.resolve();
      });

      expect(result.current.result).toBeUndefined();
    });

    // A runner that was blocked by the focus gate never called
    // setLoadingTrue, so its finally must not emit a paired
    // setLoadingFalse — otherwise `watchLoading` / onIsLoadingChange
    // sees a phantom (false) without any (true) preceding it.
    it('does not toggle loading when run is blocked by focus gate', async () => {
      act(() => {
        focusControl.__setFocus(false);
      });

      const onIsLoadingChange = jest.fn();
      const method = jest.fn(async () => 'data');

      renderHook(() =>
        usePromiseResult(method, [method], {
          initResult: 'init',
          watchLoading: true,
          onIsLoadingChange,
        }),
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // No fetch ever started → no loading transitions should emit.
      expect(onIsLoadingChange).not.toHaveBeenCalled();
      expect(method).not.toHaveBeenCalled();
    });

    // When request 2 supersedes in-flight request 1, request 1's
    // finally must not clear loading — request 2 is still pending.
    // Otherwise the spinner / isLoading flickers off and back on.
    it('does not clear loading from a stale request when a newer one is in-flight', async () => {
      const resolvers: Array<(v: string) => void> = [];
      const method = jest.fn(
        () =>
          new Promise<string>((res) => {
            resolvers.push(res);
          }),
      );

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { dep: string }
      >(
        ({ dep }) =>
          usePromiseResult(() => method(), [dep], {
            initResult: 'init',
            watchLoading: true,
          }),
        { initialProps: { dep: 'a' } },
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Deps change → request 2 starts, bumps nonceRef.
      rerender({ dep: 'b' });
      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(2);
      });
      expect(result.current.isLoading).toBe(true);

      // Stale request 1 resolves first — its setResult is skipped by
      // the nonce check, and its finally must not clear loading either.
      await act(async () => {
        resolvers[0]('stale');
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.result).not.toBe('stale');

      // Latest request 2 resolves → loading clears, result lands.
      await act(async () => {
        resolvers[1]('fresh');
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.result).toBe('fresh');
    });

    // The catch path must respect nonce identity too, not just swrKey.
    // When request 2 (deps changed, no swrKey change) supersedes
    // in-flight request 1 and lands a fresh result, request 1's later
    // rejection must not run its `undefinedResultIfError` reset — the
    // scope check alone cannot tell it is stale, so without the nonce
    // check it would roll the fresh result back to undefined.
    it('does not reset result from a stale request error after a newer one landed', async () => {
      const resolvers: Array<(v: string) => void> = [];
      const rejecters: Array<(e: unknown) => void> = [];
      const method = jest.fn(
        () =>
          new Promise<string>((res, rej) => {
            resolvers.push(res);
            rejecters.push(rej);
          }),
      );

      const { result, rerender } = renderHook<
        ReturnType<typeof usePromiseResult<string>>,
        { dep: string }
      >(
        ({ dep }) =>
          usePromiseResult(() => method(), [dep], {
            initResult: 'init',
            undefinedResultIfError: true,
          }),
        { initialProps: { dep: 'a' } },
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });

      // Deps change → request 2 starts and bumps nonceRef. There is no
      // swrKey, so request 1 is stale only by nonce, not by scope.
      rerender({ dep: 'b' });
      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(2);
      });

      // Latest request 2 lands a fresh result.
      await act(async () => {
        resolvers[1]('fresh');
        await Promise.resolve();
      });
      expect(result.current.result).toBe('fresh');

      // Stale request 1 rejects afterwards — its reset must be skipped.
      await act(async () => {
        rejecters[0](new Error('boom'));
        await Promise.resolve();
      });
      expect(result.current.result).toBe('fresh');
    });

    // Regression for the cold-start tab-switch data-loss bug. A fetch
    // started while focused must deliver its result even if the route
    // blurs before resolution — there is otherwise no recovery path on
    // refocus (deps did not change during blur and revalidateOnFocus is
    // not set), so a discarded result is permanently lost.
    it('preserves fetch result when route blurs during in-flight request', async () => {
      let resolveFetch!: (v: string) => void;
      const method = jest.fn(
        () =>
          new Promise<string>((res) => {
            resolveFetch = res;
          }),
      );

      const { result } = renderHook(() =>
        usePromiseResult(method, [method], { initResult: 'init' }),
      );

      await waitFor(() => {
        expect(method).toHaveBeenCalledTimes(1);
      });
      expect(result.current.result).toBe('init');

      // Tab switch happens before fetch completes.
      act(() => {
        focusControl.__setFocus(false);
      });

      // Fetch resolves while the route is blurred.
      await act(async () => {
        resolveFetch('fresh');
        await Promise.resolve();
      });

      // User switches back. No deps changed during blur and
      // revalidateOnFocus is not set, so no recovery run will fire — the
      // result must already be applied from the in-flight resolution.
      act(() => {
        focusControl.__setFocus(true);
      });

      await waitFor(() => {
        expect(result.current.result).toBe('fresh');
      });

      // The original in-flight fetch delivered the result; no extra fetch
      // was needed.
      expect(method).toHaveBeenCalledTimes(1);
    });
  });
});
