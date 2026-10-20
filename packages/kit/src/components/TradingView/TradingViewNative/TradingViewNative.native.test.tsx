/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNative } from './TradingViewNative.native';

import type {
  ITradingViewNativeProps,
  ITradingViewNativeSource,
} from './types';

const mockLockAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockAppStateSubscriptionRemove = jest.fn();
const mockIsSpanning = jest.fn(() => false);
const mockStatusBar = jest.fn<null, [{ hidden?: boolean }]>(() => null);
const mockWindowDimensions = { height: 844, width: 390 };
const mockContainer = jest.fn<null, [ITradingViewNativeProps]>(() => null);
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
  Dimensions: {
    get: () => mockWindowDimensions,
  },
  StatusBar: (props: { hidden?: boolean }) => mockStatusBar(props),
  useWindowDimensions: () => mockWindowDimensions,
}));

jest.mock('@onekeyhq/shared/src/modules/DualScreenInfo', () => ({
  isSpanning: () => mockIsSpanning(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: true,
    isNativeIOSPad: false,
  },
}));

jest.mock('./TradingViewNativeContainer', () => ({
  TradingViewNativeContainer: (props: ITradingViewNativeProps) =>
    mockContainer(props),
}));

jest.mock('./useTradingViewNativeFullscreenTransition.native', () => ({
  useTradingViewNativeFullscreenTransition: ({
    onFullscreenChange,
  }: {
    onFullscreenChange?: (fullscreen: boolean) => void;
  }) => ({
    changeFullscreen: onFullscreenChange,
    onPresentationReady: undefined,
  }),
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
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeIOSPad = false;
    mockIsSpanning.mockReturnValue(false);
    mockWindowDimensions.height = 844;
    mockWindowDimensions.width = 390;
    mockAppStateChangeHandler = undefined;
    mockLockAsync.mockResolvedValue(undefined);
  });

  it('does not change orientation for a regular chart', () => {
    render(<TradingViewNative source={source} />);

    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockStatusBar).not.toHaveBeenCalled();
  });

  it('preserves the caller drawing configuration', () => {
    const { rerender } = render(
      <TradingViewNative source={source} enableDrawings />,
    );
    expect(mockContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableDrawings: true }),
    );

    rerender(<TradingViewNative source={source} enableDrawings={false} />);
    expect(mockContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableDrawings: false }),
    );
  });

  it('locks Android phone fullscreen to landscape and restores portrait', async () => {
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

  it('keeps the iPhone window in portrait and hides the status bar only while fullscreen', () => {
    platformEnv.isNativeAndroid = false;
    platformEnv.isNativeIOS = true;
    const { rerender } = render(
      <TradingViewNative source={source} isNativeChartFullscreen />,
    );
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockStatusBar).toHaveBeenLastCalledWith(
      expect.objectContaining({ hidden: true }),
    );
    mockStatusBar.mockClear();
    rerender(<TradingViewNative source={source} />);
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockStatusBar).not.toHaveBeenCalled();
  });

  it.each([
    { height: 1180, width: 820 },
    { height: 820, width: 1180 },
  ])(
    'preserves the iPad window through fullscreen at $width × $height',
    (dimensions) => {
      platformEnv.isNativeAndroid = false;
      platformEnv.isNativeIOS = true;
      platformEnv.isNativeIOSPad = true;
      Object.assign(mockWindowDimensions, dimensions);
      const { rerender, unmount } = render(
        <TradingViewNative source={source} isNativeChartFullscreen />,
      );
      rerender(<TradingViewNative source={source} />);
      rerender(<TradingViewNative source={source} isNativeChartFullscreen />);
      unmount();

      expect(mockLockAsync).not.toHaveBeenCalled();
      expect(mockStatusBar).not.toHaveBeenCalled();
    },
  );

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

  it('keeps the orientation lock when the fullscreen callback changes', () => {
    const previousHandler = jest.fn();
    const nextHandler = jest.fn();
    const { rerender } = render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={previousHandler}
      />,
    );

    rerender(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={nextHandler}
      />,
    );

    expect(mockLockAsync).toHaveBeenCalledTimes(1);
    expect(mockLockAsync).toHaveBeenCalledWith('LANDSCAPE');
    expect(mockAppStateSubscriptionRemove).not.toHaveBeenCalled();
    act(() => mockAppStateChangeHandler?.('background'));
    expect(nextHandler).toHaveBeenCalledWith(false);
    expect(previousHandler).not.toHaveBeenCalled();
  });

  it('keeps fullscreen during a transient inactive state', () => {
    const handleFullscreenChange = jest.fn();
    render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    act(() => {
      mockAppStateChangeHandler?.('inactive');
    });

    expect(handleFullscreenChange).not.toHaveBeenCalled();
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

  it('uses the current unfolded Android window without requesting rotation', () => {
    const handleFullscreenChange = jest.fn();
    mockIsSpanning.mockReturnValue(true);

    const { unmount } = render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(handleFullscreenChange).not.toHaveBeenCalled();
    expect(mockStatusBar).not.toHaveBeenCalled();

    unmount();

    expect(mockLockAsync).toHaveBeenLastCalledWith('DEFAULT');
  });

  it('uses the current Android landscape window without requesting rotation', () => {
    mockWindowDimensions.height = 390;
    mockWindowDimensions.width = 844;

    const { unmount } = render(
      <TradingViewNative source={source} isNativeChartFullscreen />,
    );

    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockStatusBar.mock.calls[0]?.[0]).toMatchObject({ hidden: true });

    unmount();

    expect(mockLockAsync).toHaveBeenLastCalledWith('DEFAULT');
  });

  it('locks a folded Android portrait window to landscape', async () => {
    const handleFullscreenChange = jest.fn();
    mockIsSpanning.mockReturnValue(false);
    mockWindowDimensions.height = 844;
    mockWindowDimensions.width = 390;

    render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    await waitFor(() => {
      expect(mockLockAsync).toHaveBeenCalledWith('LANDSCAPE');
    });
    expect(mockStatusBar.mock.calls[0]?.[0]).toMatchObject({ hidden: true });
  });
});
