/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTradingViewNativeFullscreenTransition } from './useTradingViewNativeFullscreenTransition.native';

type ICover = {
  uri: string;
  onLoad: () => void;
  onError: () => void;
};
const mockCaptureScreen = jest.fn<Promise<string>, []>();
const mockReleaseCapture = jest.fn<void, [string]>();
const mockSetCover = jest.fn<void, [string, ICover | null]>();
const mockRemoveSubscription = jest.fn();
let mockAppStateChange: (state: string) => void;

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: typeof mockAppStateChange) => {
      mockAppStateChange = listener;
      return { remove: mockRemoveSubscription };
    },
  },
}));
jest.mock('react-native-view-shot', () => ({
  captureScreen: () => mockCaptureScreen(),
  releaseCapture: (uri: string) => mockReleaseCapture(uri),
}));
jest.mock('./TradingViewNativePresentation.native', () => ({
  setTradingViewNativeTransitionCover: (id: string, cover: ICover | null) =>
    mockSetCover(id, cover),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true, isNativeIOSPad: false },
}));

function latestCover() {
  const cover = mockSetCover.mock.calls.at(-1)?.[1];
  if (!cover) throw new OneKeyLocalError('Expected a transition cover');
  return cover;
}

function paintCover() {
  act(() => {
    latestCover().onLoad();
    jest.advanceTimersByTime(50);
  });
}

describe('native fullscreen presentation transitions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeIOSPad = false;
    mockCaptureScreen.mockResolvedValue('file:///transition.png');
  });
  afterEach(() => jest.useRealTimers());

  it('keeps the complete source screen until the cover is drawn and the landscape canvas is ready', async () => {
    const onFullscreenChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ isFullscreen }) =>
        useTradingViewNativeFullscreenTransition({
          isFullscreen,
          onFullscreenChange,
        }),
      { initialProps: { isFullscreen: false } },
    );
    await act(async () => result.current.changeFullscreen(true));
    expect(onFullscreenChange).not.toHaveBeenCalled();
    paintCover();
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
    rerender({ isFullscreen: true });
    act(() => result.current.onPresentationReady({ width: 390, height: 700 }));
    expect(mockReleaseCapture).not.toHaveBeenCalled();
    act(() => {
      result.current.onPresentationReady({ width: 720, height: 310 });
      jest.advanceTimersByTime(50);
    });
    expect(mockSetCover).toHaveBeenLastCalledWith(expect.any(String), null);
    expect(mockReleaseCapture).toHaveBeenCalledWith('file:///transition.png');
  });

  it('accepts the rendered inline layout after indicator changes or iPad window resizing', async () => {
    const { result, rerender } = renderHook(
      ({ isFullscreen }) =>
        useTradingViewNativeFullscreenTransition({
          isFullscreen,
          onFullscreenChange: jest.fn(),
        }),
      { initialProps: { isFullscreen: true } },
    );
    await act(async () => result.current.changeFullscreen(false));
    paintCover();
    expect(mockReleaseCapture).not.toHaveBeenCalled();
    rerender({ isFullscreen: false });
    act(() => {
      result.current.onPresentationReady({ width: 520, height: 240 });
      jest.advanceTimersByTime(50);
    });
    expect(mockReleaseCapture).toHaveBeenCalledTimes(1);
  });

  it('reveals an iPad chart in its current portrait orientation', async () => {
    platformEnv.isNativeIOSPad = true;
    const { result, rerender } = renderHook(
      ({ isFullscreen }) =>
        useTradingViewNativeFullscreenTransition({
          isFullscreen,
          onFullscreenChange: jest.fn(),
        }),
      { initialProps: { isFullscreen: false } },
    );
    await act(async () => result.current.changeFullscreen(true));
    paintCover();
    rerender({ isFullscreen: true });
    act(() => {
      result.current.onPresentationReady({ width: 390, height: 700 });
      jest.advanceTimersByTime(50);
    });
    expect(mockReleaseCapture).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated presses while a transition is pending', async () => {
    const onFullscreenChange = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativeFullscreenTransition({
        isFullscreen: false,
        onFullscreenChange,
      }),
    );
    await act(async () => {
      result.current.changeFullscreen(true);
      result.current.changeFullscreen(true);
    });
    paintCover();
    expect(mockCaptureScreen).toHaveBeenCalledTimes(1);
    expect(onFullscreenChange).toHaveBeenCalledTimes(1);
  });

  it.each(['capture', 'image', 'timeout'])(
    'allows fullscreen when the %s stage fails',
    async (failure) => {
      if (failure === 'capture') {
        mockCaptureScreen.mockRejectedValue(new Error('Capture failed'));
      }
      const onFullscreenChange = jest.fn();
      const { result } = renderHook(() =>
        useTradingViewNativeFullscreenTransition({
          isFullscreen: false,
          onFullscreenChange,
        }),
      );
      await act(async () => result.current.changeFullscreen(true));
      act(() => {
        if (failure === 'image') latestCover().onError();
        if (failure === 'timeout') jest.advanceTimersByTime(5000);
      });
      expect(onFullscreenChange).toHaveBeenCalledTimes(1);
      expect(mockSetCover).toHaveBeenLastCalledWith(expect.any(String), null);
    },
  );

  it('discards a capture that finishes after the chart owner unmounts', async () => {
    let resolveCapture: (uri: string) => void = () => undefined;
    mockCaptureScreen.mockReturnValue(
      new Promise((resolve) => {
        resolveCapture = resolve;
      }),
    );
    const onFullscreenChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useTradingViewNativeFullscreenTransition({
        isFullscreen: false,
        onFullscreenChange,
      }),
    );
    act(() => result.current.changeFullscreen(true));
    unmount();
    await act(async () => resolveCapture('file:///late.png'));
    expect(onFullscreenChange).not.toHaveBeenCalled();
    expect(mockReleaseCapture).toHaveBeenCalledWith('file:///late.png');
    expect(mockSetCover.mock.calls.every(([, cover]) => cover === null)).toBe(
      true,
    );
  });

  it('removes the image when the app leaves the foreground', async () => {
    const onFullscreenChange = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativeFullscreenTransition({
        isFullscreen: false,
        onFullscreenChange,
      }),
    );
    await act(async () => result.current.changeFullscreen(true));
    act(() => mockAppStateChange('background'));
    act(() => jest.advanceTimersByTime(6000));
    expect(onFullscreenChange).not.toHaveBeenCalled();
    expect(mockReleaseCapture).toHaveBeenCalledTimes(1);
  });

  it('preserves the direct fullscreen path outside iOS', () => {
    platformEnv.isNativeIOS = false;
    const onFullscreenChange = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativeFullscreenTransition({
        isFullscreen: false,
        onFullscreenChange,
      }),
    );
    act(() => result.current.changeFullscreen(true));
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
    expect(mockCaptureScreen).not.toHaveBeenCalled();
  });
});
