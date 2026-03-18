/**
 * @jest-environment jsdom
 */

import { useRef } from 'react';

import { act, renderHook } from '@testing-library/react';

jest.mock('./useVisibilityChange', () => ({
  __esModule: true,
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
}));

const netInfoModule: typeof import('./useNetInfo') = require('./useNetInfo');

const { globalNetInfo, useNetInfo } = netInfoModule;

function useNetInfoWithRenderCount(enabled: boolean) {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const state = useNetInfo(enabled);

  return {
    renderCount: renderCountRef.current,
    state,
  };
}

describe('useNetInfo', () => {
  beforeEach(() => {
    globalNetInfo.listeners = [];
    globalNetInfo.state = { isInternetReachable: null };
    globalNetInfo.prevIsInternetReachable = false;
  });

  it('does not subscribe to netinfo updates when disabled', () => {
    const { result } = renderHook(() => useNetInfoWithRenderCount(false));

    expect(result.current.renderCount).toBe(1);
    expect(globalNetInfo.listeners).toHaveLength(0);

    act(() => {
      globalNetInfo.updateState({ isInternetReachable: false });
    });

    expect(result.current.renderCount).toBe(1);
    expect(result.current.state.isRawInternetReachable).toBeNull();
  });

  it('subscribes to netinfo updates when enabled', () => {
    const { result } = renderHook(() => useNetInfoWithRenderCount(true));

    expect(result.current.renderCount).toBe(1);
    expect(globalNetInfo.listeners).toHaveLength(1);

    act(() => {
      globalNetInfo.updateState({ isInternetReachable: false });
    });

    expect(result.current.renderCount).toBe(2);
    expect(result.current.state.isInternetReachable).toBe(false);
    expect(result.current.state.isRawInternetReachable).toBe(false);
  });
});
