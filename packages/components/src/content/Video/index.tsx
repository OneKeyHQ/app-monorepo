import { useEffect, useRef } from 'react';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IVideoProps } from './type';

export function Video(rawProps: IVideoProps) {
  const [{ source, repeat, resizeMode, rate, ...props }, style] =
    usePropsAndStyle(rawProps);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && rate !== undefined) {
      videoRef.current.playbackRate = rate;
    }
  }, [rate]);

  if (resizeMode) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (style as any)['object-fit'] = resizeMode;
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      autoPlay
      style={style as any}
      {...(props as any)}
      src={typeof source === 'string' ? source : source?.uri}
      loop={repeat}
    />
  );
}

export type * from './type';
export * from './enum';
