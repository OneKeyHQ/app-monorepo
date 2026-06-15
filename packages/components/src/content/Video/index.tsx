import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ForwardedRef } from 'react';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IVideoProps, IVideoRef } from './type';

function VideoComponent(rawProps: IVideoProps, ref: ForwardedRef<IVideoRef>) {
  const [
    {
      source,
      repeat,
      resizeMode,
      rate,
      muted,
      paused,
      onEnd,
      onProgress,
      ...props
    },
    style,
  ] = usePropsAndStyle(rawProps);
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      resume: () => {
        if (videoRef.current) {
          void videoRef.current.play().catch(() => {
            // Autoplay may be blocked by the browser — silently ignore.
          });
        }
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (videoRef.current && rate !== undefined) {
      videoRef.current.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused && !video.paused) {
      video.pause();
    } else if (!paused && video.paused) {
      void video.play().catch(() => {
        // Autoplay may be blocked by the browser — silently ignore.
      });
    }
  }, [paused]);

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
      {...(onEnd ? { onEnded: () => onEnd() } : undefined)}
      src={typeof source === 'string' ? source : source?.uri}
      loop={repeat}
    />
  );
}

export const Video = forwardRef<IVideoRef, IVideoProps>(VideoComponent);

export type * from './type';
export * from './enum';
