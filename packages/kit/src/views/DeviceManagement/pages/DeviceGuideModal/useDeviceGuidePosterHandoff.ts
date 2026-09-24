import { useCallback, useEffect, useRef, useState } from 'react';

import { Animated } from 'react-native';

import type {
  IVideoPlaybackState,
  IVideoProgressData,
} from '@onekeyhq/components/src/content/Video/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const NATIVE_POSTER_FADE_MS = 220;

export function useDeviceGuidePosterHandoff() {
  const [isWebPosterHidden, setIsWebPosterHidden] = useState(false);
  const [isPlaybackStarted, setIsPlaybackStarted] = useState(false);
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const playbackRequestedRef = useRef(false);
  const fadeStartedRef = useRef(false);
  const isWebPosterHiddenRef = useRef(false);
  isWebPosterHiddenRef.current = isWebPosterHidden;

  useEffect(() => {
    return () => {
      posterOpacity.stopAnimation();
    };
  }, [posterOpacity]);

  const handleVideoProgress = useCallback((event: IVideoProgressData) => {
    if (platformEnv.isNative || isWebPosterHiddenRef.current) {
      return;
    }
    if (event.currentTime > 0) {
      setIsWebPosterHidden(true);
    }
  }, []);

  const handleReadyForDisplay = useCallback(() => {
    if (!platformEnv.isNative || playbackRequestedRef.current) {
      return;
    }
    playbackRequestedRef.current = true;
    if (platformEnv.isNativeAndroid) {
      posterOpacity.setValue(0);
    }
    setIsPlaybackStarted(true);
  }, [posterOpacity]);

  const handlePlaybackStateChange = useCallback(
    (state: IVideoPlaybackState) => {
      // Player setup can report playing before the view is display-ready.
      if (
        !platformEnv.isNativeIOS ||
        !playbackRequestedRef.current ||
        fadeStartedRef.current ||
        !state.isPlaying ||
        state.isBuffering
      ) {
        return;
      }
      fadeStartedRef.current = true;
      Animated.timing(posterOpacity, {
        toValue: 0,
        duration: NATIVE_POSTER_FADE_MS,
        useNativeDriver: true,
      }).start();
    },
    [posterOpacity],
  );

  return {
    isWebPosterHidden,
    paused: platformEnv.isNative ? !isPlaybackStarted : undefined,
    posterOpacity,
    handleVideoProgress,
    handleReadyForDisplay,
    handlePlaybackStateChange,
  };
}
