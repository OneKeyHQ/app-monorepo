/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */
/* eslint-disable react-hooks/exhaustive-deps */

// Polyfill requestIdleCallback/cancelIdleCallback for jsdom
if (typeof globalThis.requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = (cb: () => void) =>
    setTimeout(cb, 0);
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

import { useRef } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
    isRuntimeChrome: false,
  },
}));

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

    const method = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() =>
      usePromiseResultWithRenderCount(method, {
        revalidateOnReconnect: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.result).toBe('first');
    });

    expect(method).toHaveBeenCalledTimes(1);
    expect(globalNetInfo.listeners).toHaveLength(1);

    act(() => {
      globalNetInfo.updateState({ isInternetReachable: true });
    });

    await waitFor(() => {
      expect(result.current.result).toBe('second');
    });

    expect(method).toHaveBeenCalledTimes(2);
  });
});
