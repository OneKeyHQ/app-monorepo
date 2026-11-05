/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNative } from './TradingViewNative.native';

import type { ITradingViewNativeFullscreenTransition } from './TradingViewNativeFullscreenTransitionContext';
import type {
  ITradingViewNativeProps,
  ITradingViewNativeSource,
} from './types';

const mockLockAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockAppStateSubscriptionRemove = jest.fn();
const mockIsSpanning = jest.fn(() => false);
const mockStatusBarEntry = { hidden: true };
const mockPushStatusBarEntry = jest.fn<
  typeof mockStatusBarEntry,
  [{ hidden?: boolean }]
>(() => mockStatusBarEntry);
const mockPopStatusBarEntry = jest.fn<void, [typeof mockStatusBarEntry]>();
const mockWindowDimensions = { height: 844, width: 390 };
const mockInsets = { top: 24, right: 0, bottom: 24, left: 0 };
const mockContainer = jest.fn<null, [ITradingViewNativeProps]>(() => null);
let mockTransition: ITradingViewNativeFullscreenTransition | undefined;
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
  StatusBar: {
    pushStackEntry: (props: { hidden?: boolean }) =>
      mockPushStatusBarEntry(props),
    popStackEntry: (entry: typeof mockStatusBarEntry) =>
      mockPopStatusBarEntry(entry),
  },
  useWindowDimensions: () => mockWindowDimensions,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => react.useRef({ value }).current,
  };
});

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

jest.mock('./TradingViewNativeContainer', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { TradingViewNativeFullscreenTransitionContext } = jest.requireActual<
    typeof import('./TradingViewNativeFullscreenTransitionContext')
  >('./TradingViewNativeFullscreenTransitionContext');
  return {
    TradingViewNativeContainer: (props: ITradingViewNativeProps) => {
      mockTransition = react.useContext(
        TradingViewNativeFullscreenTransitionContext,
      );
      return mockContainer(props);
    },
  };
});

const source: ITradingViewNativeSource = {
  kind: 'market',
  networkId: 'evm--1',
  realtime: 'disabled',
  symbol: 'TOKEN',
  tokenAddress: '0xabc',
};

function getContainerProps() {
  return mockContainer.mock.calls.at(-1)?.[0];
}

function requestFullscreen(isFullscreen: boolean) {
  act(() => getContainerProps()?.onNativeChartFullscreenChange?.(isFullscreen));
}

function reportLayerReady() {
  act(() => mockTransition?.onLayerReady());
}

describe('TradingViewNative screen orientation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeIOSPad = false;
    mockIsSpanning.mockReturnValue(false);
    mockWindowDimensions.height = 844;
    mockWindowDimensions.width = 390;
    mockInsets.top = 24;
    mockAppStateChangeHandler = undefined;
    mockTransition = undefined;
    mockLockAsync.mockResolvedValue(undefined);
  });

  it('does not change orientation for a regular chart', () => {
    render(<TradingViewNative source={source} />);

    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockPushStatusBarEntry).not.toHaveBeenCalled();
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

  it('keeps the page until the prepared layer is shown, then reports fullscreen', async () => {
    const handleFullscreenChange = jest.fn();
    const { rerender } = render(
      <TradingViewNative
        source={source}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    requestFullscreen(true);
    expect(getContainerProps()?.isNativeChartFullscreen).toBe(true);
    expect(mockTransition).toMatchObject({
      isRevealed: false,
      isLandscapeLayout: true,
      isStatusBarHidden: true,
      layerOpacity: { value: 0 },
    });
    expect(handleFullscreenChange).not.toHaveBeenCalled();
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockPushStatusBarEntry).not.toHaveBeenCalled();

    // The layer has drawn at the landscape size: rotate, then show it and
    // hide the status bar.
    reportLayerReady();
    expect(mockPushStatusBarEntry).not.toHaveBeenCalled();
    expect(mockLockAsync).toHaveBeenCalledWith('LANDSCAPE');
    expect(mockTransition?.layerOpacity?.value).toBe(0);
    // The host may show the layer as soon as the window is landscape.
    expect(mockTransition?.revealOnLandscape?.value).toBe(true);
    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(true);
    });
    expect(mockTransition?.layerOpacity?.value).toBe(1);
    expect(mockTransition?.revealOnLandscape?.value).toBe(false);
    expect(mockTransition?.isRevealed).toBe(true);
    expect(mockPushStatusBarEntry).toHaveBeenCalledWith({ hidden: true });

    rerender(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );
    expect(getContainerProps()?.isNativeChartFullscreen).toBe(true);
    expect(mockPushStatusBarEntry).toHaveBeenCalledTimes(1);
    expect(mockPopStatusBarEntry).not.toHaveBeenCalled();
  });

  it('restores the page before rotating back and hiding the layer', async () => {
    const handleFullscreenChange = jest.fn();
    const chart = (isNativeChartFullscreen: boolean) => (
      <TradingViewNative
        source={source}
        isNativeChartFullscreen={isNativeChartFullscreen}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />
    );
    const { rerender } = render(chart(false));
    requestFullscreen(true);
    reportLayerReady();
    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(true);
    });
    rerender(chart(true));
    mockLockAsync.mockClear();

    requestFullscreen(false);
    expect(handleFullscreenChange).toHaveBeenLastCalledWith(false);
    expect(getContainerProps()?.isNativeChartFullscreen).toBe(true);
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockPopStatusBarEntry).toHaveBeenCalledWith(mockStatusBarEntry);

    expect(mockTransition?.layerOpacity?.value).toBe(1);

    // The owner has committed its restored page under the layer: rotate back
    // and hide the layer together.
    rerender(chart(false));
    expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
    expect(mockTransition?.layerOpacity?.value).toBe(0);
    expect(getContainerProps()?.isNativeChartFullscreen).toBe(true);

    await waitFor(() => {
      expect(getContainerProps()?.isNativeChartFullscreen).toBe(false);
    });
  });

  it('covers the rotation back when the owner leaves fullscreen on its own', async () => {
    const handleFullscreenChange = jest.fn();
    const chart = (isNativeChartFullscreen: boolean) => (
      <TradingViewNative
        source={source}
        isNativeChartFullscreen={isNativeChartFullscreen}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />
    );
    const { rerender } = render(chart(false));
    requestFullscreen(true);
    reportLayerReady();
    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(true);
    });
    // The window has rotated to landscape.
    mockWindowDimensions.height = 390;
    mockWindowDimensions.width = 844;
    rerender(chart(true));
    mockLockAsync.mockClear();
    handleFullscreenChange.mockClear();

    // E.g. hardware back: the owner restores its page without the chart's
    // control. The layer stays up and hides only as the window rotates back.
    rerender(chart(false));
    expect(getContainerProps()?.isNativeChartFullscreen).toBe(true);
    expect(mockTransition?.isLandscapeLayout).toBe(true);
    expect(mockPopStatusBarEntry).toHaveBeenCalledWith(mockStatusBarEntry);
    expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
    expect(mockTransition?.layerOpacity?.value).toBe(0);
    expect(handleFullscreenChange).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getContainerProps()?.isNativeChartFullscreen).toBe(false);
    });
  });

  it('waits for the page to lay out with the returned status bar', async () => {
    const handleFullscreenChange = jest.fn();
    const chart = (isNativeChartFullscreen: boolean) => (
      <TradingViewNative
        source={source}
        isNativeChartFullscreen={isNativeChartFullscreen}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />
    );
    const { rerender } = render(chart(false));
    requestFullscreen(true);
    reportLayerReady();
    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(true);
    });
    // The hidden status bar leaves no top inset.
    mockInsets.top = 0;
    rerender(chart(true));
    mockLockAsync.mockClear();

    requestFullscreen(false);
    rerender(chart(false));
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockTransition?.layerOpacity?.value).toBe(1);

    mockInsets.top = 24;
    rerender(chart(false));
    expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
    expect(mockTransition?.layerOpacity?.value).toBe(0);
  });

  it('rotates back anyway when the status bar reports no top inset', async () => {
    const handleFullscreenChange = jest.fn();
    const chart = (isNativeChartFullscreen: boolean) => (
      <TradingViewNative
        source={source}
        isNativeChartFullscreen={isNativeChartFullscreen}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />
    );
    const { rerender } = render(chart(false));
    requestFullscreen(true);
    reportLayerReady();
    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(true);
    });
    mockInsets.top = 0;
    rerender(chart(true));
    mockLockAsync.mockClear();

    jest.useFakeTimers();
    try {
      requestFullscreen(false);
      rerender(chart(false));
      expect(mockLockAsync).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels a requested fullscreen before its layer is shown', () => {
    const handleFullscreenChange = jest.fn();
    render(
      <TradingViewNative
        source={source}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    requestFullscreen(true);
    requestFullscreen(false);

    expect(getContainerProps()?.isNativeChartFullscreen).toBe(false);
    expect(handleFullscreenChange).not.toHaveBeenCalled();
    expect(mockLockAsync).not.toHaveBeenCalledWith('LANDSCAPE');
  });

  it('rotates anyway when the chart never reports a drawn frame', () => {
    jest.useFakeTimers();
    try {
      render(
        <TradingViewNative
          source={source}
          onNativeChartFullscreenChange={jest.fn()}
        />,
      );
      requestFullscreen(true);
      expect(mockLockAsync).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(mockLockAsync).toHaveBeenCalledWith('LANDSCAPE');
    } finally {
      jest.useRealTimers();
    }
  });

  it('lets the native iPhone page own orientation and dismissal', () => {
    platformEnv.isNativeAndroid = false;
    platformEnv.isNativeIOS = true;
    mockWindowDimensions.width = 844;
    mockWindowDimensions.height = 390;
    const onFullscreenChange = jest.fn();
    const { rerender } = render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={onFullscreenChange}
      />,
    );
    requestFullscreen(false);
    expect(onFullscreenChange).toHaveBeenCalledWith(false);
    rerender(<TradingViewNative source={source} />);
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(mockPushStatusBarEntry).not.toHaveBeenCalled();
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
      expect(mockPushStatusBarEntry).not.toHaveBeenCalled();
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

  it('keeps the session when the fullscreen callback changes', () => {
    const previousHandler = jest.fn();
    const nextHandler = jest.fn();
    const { rerender } = render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={previousHandler}
      />,
    );
    reportLayerReady();

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
    reportLayerReady();

    await waitFor(() => {
      expect(handleFullscreenChange).toHaveBeenCalledWith(false);
    });
  });

  it('uses the current unfolded Android window without requesting rotation', async () => {
    const handleFullscreenChange = jest.fn();
    mockIsSpanning.mockReturnValue(true);

    const { unmount } = render(
      <TradingViewNative
        source={source}
        isNativeChartFullscreen
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );
    expect(mockTransition?.isLandscapeLayout).toBe(false);
    reportLayerReady();

    await waitFor(() => {
      expect(mockTransition?.isRevealed).toBe(true);
    });
    expect(mockLockAsync).not.toHaveBeenCalled();
    expect(handleFullscreenChange).not.toHaveBeenCalled();
    expect(mockPushStatusBarEntry).not.toHaveBeenCalled();

    unmount();

    expect(mockLockAsync).toHaveBeenLastCalledWith('DEFAULT');
  });

  it('uses the current Android landscape window without requesting rotation', async () => {
    mockWindowDimensions.height = 390;
    mockWindowDimensions.width = 844;

    const { unmount } = render(
      <TradingViewNative source={source} isNativeChartFullscreen />,
    );
    expect(mockTransition?.isLandscapeLayout).toBe(false);
    reportLayerReady();

    await waitFor(() => {
      expect(mockPushStatusBarEntry).toHaveBeenCalledWith({ hidden: true });
    });
    expect(mockLockAsync).not.toHaveBeenCalled();

    unmount();

    expect(mockLockAsync).toHaveBeenLastCalledWith('DEFAULT');
    expect(mockPopStatusBarEntry).toHaveBeenCalledWith(mockStatusBarEntry);
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
    reportLayerReady();

    expect(mockLockAsync).toHaveBeenCalledWith('LANDSCAPE');
    await waitFor(() => {
      expect(mockPushStatusBarEntry).toHaveBeenCalledWith({ hidden: true });
    });
  });
});
