import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { ForwardedRef } from 'react';

import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'react-native-video';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IVideoProps, IVideoRef } from './type';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  AllPlayerEvents,
  VideoPlayer,
  VideoPlayerStatus,
  VideoViewProps,
} from 'react-native-video';

function useVideoEvent<Event extends keyof AllPlayerEvents>(
  player: VideoPlayer,
  event: Event,
  callback: AllPlayerEvents[Event] | undefined,
) {
  useEffect(() => {
    if (!callback) {
      return;
    }
    const subscription = player.addEventListener(event, callback);
    return () => subscription.remove();
  }, [callback, event, player]);
}

function VideoComponent(
  {
    source,
    muted,
    autoPlay,
    paused,
    repeat,
    rate,
    playInBackground,
    controls,
    resizeMode,
    poster: _poster,
    onEnd,
    onError,
    onPlaybackStateChange,
    onProgress,
    onReadyForDisplay,
    style: callerStyle,
    ...rawProps
  }: IVideoProps,
  ref: ForwardedRef<IVideoRef>,
) {
  const shouldPlay = paused === undefined ? autoPlay !== false : !paused;
  const player = useVideoPlayer(source, (initialPlayer) => {
    initialPlayer.muted = muted ?? false;
    initialPlayer.loop = repeat ?? false;
    initialPlayer.rate = rate ?? 1;
    initialPlayer.playInBackground = playInBackground ?? false;
    if (shouldPlay) {
      initialPlayer.play();
    } else {
      initialPlayer.pause();
    }
  });
  const [props, style] = usePropsAndStyle(rawProps);
  const mergedStyle = useMemo<ViewStyle>(
    () =>
      StyleSheet.flatten<ViewStyle>([
        style as ViewStyle,
        callerStyle as StyleProp<ViewStyle>,
      ]),
    [style, callerStyle],
  );

  useEffect(() => {
    player.muted = muted ?? false;
    player.loop = repeat ?? false;
    player.rate = rate ?? 1;
    player.playInBackground = playInBackground ?? false;
  }, [muted, playInBackground, player, rate, repeat]);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  const handleProgress = useMemo<
    AllPlayerEvents['onProgress'] | undefined
  >(() => {
    if (!onProgress) {
      return undefined;
    }
    return (data) => {
      onProgress({
        bufferDuration: data.bufferDuration,
        currentTime: data.currentTime,
        playableDuration: data.currentTime + data.bufferDuration,
        seekableDuration: player.duration,
      });
    };
  }, [onProgress, player]);

  useVideoEvent(player, 'onEnd', onEnd);
  useVideoEvent(player, 'onError', onError);

  // react-native-video 7 never emits `onError` from native: a source that
  // fails to load only flips the player status to `error`. Bridge that status
  // to `onError` once per player so callers keep the v6 fallback contract.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const errorReportedPlayerRef = useRef<VideoPlayer | null>(null);
  const hasOnError = !!onError;
  useEffect(() => {
    if (!hasOnError) {
      return;
    }
    const reportErrorStatus = (status: VideoPlayerStatus) => {
      if (status !== 'error' || errorReportedPlayerRef.current === player) {
        return;
      }
      errorReportedPlayerRef.current = player;
      onErrorRef.current?.(new Error('Video source failed to load'));
    };
    const subscription = player.addEventListener(
      'onStatusChange',
      reportErrorStatus,
    );
    // The status may have settled before this effect subscribed.
    reportErrorStatus(player.status);
    return () => subscription.remove();
  }, [hasOnError, player]);
  useVideoEvent(player, 'onPlaybackStateChange', onPlaybackStateChange);
  useVideoEvent(player, 'onProgress', handleProgress);
  useVideoEvent(player, 'onReadyToDisplay', onReadyForDisplay);

  useImperativeHandle(
    ref,
    () => ({
      resume: () => {
        player.play();
      },
      seek: (time) => {
        player.seekTo(time);
      },
    }),
    [player],
  );

  return (
    <VideoView
      player={player}
      {...(props as Partial<VideoViewProps>)}
      style={mergedStyle}
      controls={controls}
      resizeMode={resizeMode}
    />
  );
}

export const Video = forwardRef<IVideoRef, IVideoProps>(VideoComponent);

export type * from './type';
export * from './enum';
