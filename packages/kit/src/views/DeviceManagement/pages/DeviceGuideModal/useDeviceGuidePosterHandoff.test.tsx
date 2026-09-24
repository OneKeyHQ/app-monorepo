/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { Animated } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDeviceGuidePosterHandoff } from './useDeviceGuidePosterHandoff';

// jest-expo supplies a React Native mock; Animated lives on react-native-web.
jest.unmock('react-native');

describe('useDeviceGuidePosterHandoff', () => {
  const originalNative = platformEnv.isNative;
  const originalIOS = platformEnv.isNativeIOS;
  const originalAndroid = platformEnv.isNativeAndroid;

  beforeEach(() => {
    jest.spyOn(Animated, 'timing').mockImplementation(
      () =>
        ({
          start: () => undefined,
          stop: () => undefined,
          reset: () => undefined,
        }) as ReturnType<typeof Animated.timing>,
    );
  });

  afterEach(() => {
    platformEnv.isNative = originalNative;
    platformEnv.isNativeIOS = originalIOS;
    platformEnv.isNativeAndroid = originalAndroid;
    jest.restoreAllMocks();
  });

  function useIOS() {
    platformEnv.isNative = true;
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeAndroid = false;
  }

  function useAndroid() {
    platformEnv.isNative = true;
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = true;
  }

  function useDesktop() {
    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = false;
  }

  it('fades the iOS poster once after playback is actually playing', () => {
    useIOS();
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const { result } = renderHook(() => useDeviceGuidePosterHandoff());

    act(() => {
      result.current.handlePlaybackStateChange({
        isPlaying: true,
        isBuffering: false,
      });
    });
    expect(Animated.timing).not.toHaveBeenCalled();

    act(() => {
      result.current.handleReadyForDisplay();
    });
    expect(result.current.paused).toBe(false);
    expect(setValue).not.toHaveBeenCalledWith(0);
    expect(Animated.timing).not.toHaveBeenCalled();

    act(() => {
      result.current.handlePlaybackStateChange({
        isPlaying: false,
        isBuffering: false,
      });
      result.current.handlePlaybackStateChange({
        isPlaying: true,
        isBuffering: true,
      });
    });
    expect(Animated.timing).not.toHaveBeenCalled();

    act(() => {
      result.current.handlePlaybackStateChange({
        isPlaying: true,
        isBuffering: false,
      });
      result.current.handlePlaybackStateChange({
        isPlaying: true,
        isBuffering: false,
      });
    });
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    );
    expect(result.current.paused).toBe(false);
  });

  it('drops the Android poster and starts playback without a fade', () => {
    useAndroid();
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const { result } = renderHook(() => useDeviceGuidePosterHandoff());

    act(() => {
      result.current.handleReadyForDisplay();
      result.current.handleReadyForDisplay();
    });

    expect(setValue).toHaveBeenCalledWith(0);
    expect(Animated.timing).not.toHaveBeenCalled();
    expect(result.current.paused).toBe(false);
    expect(result.current.isWebPosterHidden).toBe(false);
  });

  it('keeps desktop on the progress gate', () => {
    useDesktop();
    const { result } = renderHook(() => useDeviceGuidePosterHandoff());

    expect(result.current.paused).toBeUndefined();
    expect(result.current.isWebPosterHidden).toBe(false);

    act(() => {
      result.current.handleVideoProgress({ currentTime: 0 });
    });
    expect(result.current.isWebPosterHidden).toBe(false);

    act(() => {
      result.current.handleVideoProgress({ currentTime: 0.5 });
    });
    expect(result.current.isWebPosterHidden).toBe(true);

    act(() => {
      result.current.handleReadyForDisplay();
      result.current.handlePlaybackStateChange({
        isPlaying: true,
        isBuffering: false,
      });
    });
    expect(Animated.timing).not.toHaveBeenCalled();
    expect(result.current.paused).toBeUndefined();
    expect(result.current.isWebPosterHidden).toBe(true);
  });
});
