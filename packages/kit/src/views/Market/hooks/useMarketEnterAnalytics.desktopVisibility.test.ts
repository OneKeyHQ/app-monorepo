/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';

import { useMarketEnterAnalytics } from './useMarketEnterAnalytics';

const mockDexLeave = jest.fn();
let mockEmitAppState: (state: unknown) => void = () => undefined;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    key: 'detail',
    params: { marketTokenId: 'pepe', network: 'eth', from: 'MarketList' },
  }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      enter: {
        dexEnter: () => undefined,
        dexLeave: (payload: unknown) => {
          mockDexLeave(payload);
        },
      },
    },
  },
}));
// The real visibility helper runs against the desktop renderer.
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true, isWeb: false, isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getNetworkIdFromShortCode: () => 'evm--1' },
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: undefined },
}));

describe('useMarketEnterAnalytics detail visit on desktop', () => {
  const originalDesktopApi = globalThis.desktopApi;
  beforeEach(() => {
    jest.useFakeTimers();
    mockDexLeave.mockClear();
    globalThis.desktopApi = {
      isFocused: () => true,
      onAppState: (cb: (state: unknown) => void) => {
        mockEmitAppState = cb;
        return () => {
          mockEmitAppState = () => undefined;
        };
      },
    } as unknown as typeof globalThis.desktopApi;
  });
  afterEach(() => {
    jest.useRealTimers();
    globalThis.desktopApi = originalDesktopApi;
  });

  function renderDetail() {
    return renderHook(() =>
      useMarketEnterAnalytics({
        detailVisit: {
          isFocused: true,
          chartMode: 'native',
          chartDisplayMode: 'simple',
        },
      }),
    );
  }

  it('keeps counting through a window fullscreen toggle', () => {
    const view = renderDetail();
    jest.advanceTimersByTime(2000);
    // Electron sends no state on enter/leave fullscreen; the window stays
    // focused.
    mockEmitAppState(undefined);
    jest.advanceTimersByTime(3000);
    mockEmitAppState(undefined);
    jest.advanceTimersByTime(1000);
    view.unmount();
    expect(mockDexLeave).toHaveBeenCalledTimes(1);
    expect(mockDexLeave.mock.calls[0][0]).toMatchObject({
      enterWay: EEnterWay.MarketList,
      durationMs: 6000,
    });
  });

  it('still pauses while the window is blurred or hidden', () => {
    const view = renderDetail();
    jest.advanceTimersByTime(2000);
    mockEmitAppState('blur');
    jest.advanceTimersByTime(30_000);
    mockEmitAppState('active');
    jest.advanceTimersByTime(1000);
    mockEmitAppState('background');
    jest.advanceTimersByTime(30_000);
    view.unmount();
    expect(mockDexLeave.mock.calls[0][0]).toMatchObject({ durationMs: 3000 });
  });
});
