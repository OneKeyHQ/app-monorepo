import { useEffect, useRef } from 'react';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IVideoProps } from './type';

export function Video(rawProps: IVideoProps) {
  const [
    { source, repeat, resizeMode, rate, muted, onProgress, ...props },
    style,
  ] = usePropsAndStyle(rawProps);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && rate !== undefined) {
      videoRef.current.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;

    let animationFrameId: number;

    const updateProgress = () => {
      if (video.duration) {
        onProgress({
          currentTime: video.currentTime,
          playableDuration: video.duration,
          seekableDuration: video.duration,
        });
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onProgress]);

  if (resizeMode) {
    (style as any)['object-fit'] = resizeMode;
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- decorative UI video, no captions needed
    <video
      ref={videoRef}
      autoPlay
      muted={muted}
      style={style as any}
      {...(props as any)}
      src={typeof source === 'string' ? source : source?.uri}
      loop={repeat}
    />
  );
}

export type * from './type';
export * from './enum';
