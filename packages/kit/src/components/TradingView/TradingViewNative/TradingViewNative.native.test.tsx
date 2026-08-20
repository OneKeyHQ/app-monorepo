/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import { TradingViewNative } from './TradingViewNative.native';

import type { ITradingViewNativeSource } from './types';

const mockLockAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockAppStateSubscriptionRemove = jest.fn();
const mockIsNativeTablet = jest.fn(() => false);
let mockAppStateChangeHandler:
  | ((nextState: 'active' | 'background' | 'inactive') => void)
  | undefined;

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: {
    ALL: 'ALL',
    DEFAULT: 'DEFAULT',
    LANDSCAPE: 'LANDSCAPE',
    PORTRAIT_UP: 'PORTRAIT_UP',
  },
  lockAsync: (orientationLock: string) => mockLockAsync(orientationLock),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (
      _eventName: 'change',
      handler: typeof mockAppStateChangeHandler,
    ) => {
      mockAppStateChangeHandler = handler;
      return { remove: mockAppStateSubscriptionRemove };
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  isNativeTablet: () => mockIsNativeTablet(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: true,
    isNativeIOSPad: false,
  },
}));

jest.mock('./TradingViewNativeContainer', () => ({
  TradingViewNativeContainer: () => null,
}));

const source: ITradingViewNativeSource = {
  kind: 'market',
  networkId: 'evm--1',
  realtime: 'disabled',
  symbol: 'TOKEN',
  tokenAddress: '0xabc',
};

describe('TradingViewNative screen orientation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNativeTablet.mockReturnValue(false);
    mockAppStateChangeHandler = undefined;
    mockLockAsync.mockResolvedValue(undefined);
  });

  it('does not change orientation for a regular chart', () => {
    render(<TradingViewNative source={source} />);

    expect(mockLockAsync).not.toHaveBeenCalled();
  });

  it('locks landscape only while fullscreen and restores portrait on exit', async () => {
    const handleFullscreenChange = jest.fn();
    const { rerender } = render(
      <TradingViewNative
        source={source}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    rerender(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    await waitFor(() => {
      expect(mockLockAsync).toHaveBeenLastCalledWith('LANDSCAPE');
    });

    rerender(
      <TradingViewNative
        source={source}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    expect(mockAppStateSubscriptionRemove).toHaveBeenCalledTimes(1);
    expect(mockLockAsync).toHaveBeenLastCalledWith('PORTRAIT_UP');
  });

  it('exits fullscreen when the app leaves the foreground', () => {
    const handleFullscreenChange = jest.fn();
    render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    act(() => {
      mockAppStateChangeHandler?.('background');
    });

    expect(handleFullscreenChange).toHaveBeenCalledWith(false);
  });

  it('exits fullscreen when the landscape lock fails', async () => {
    const handleFullscreenChange = jest.fn();
    mockLockAsync.mockRejectedValueOnce(new Error('orientation unavailable'));

    render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(false);
    });
  });

  it('uses the current Android tablet window without requesting rotation', () => {
    const handleFullscreenChange = jest.fn();
    mockIsNativeTablet.mockReturnValue(true);

    const { unmount } = render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(handleFullscreenChange).not.toHaveBeenCalled();

    unmount();

    expect(mockLockAsync).toHaveBeenLastCalledWith('DEFAULT');
  });
});
