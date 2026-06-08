import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ForwardedRef } from 'react';

import NativeVideo from 'react-native-video';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IVideoProps, IVideoRef } from './type';
import type { ViewStyle } from 'react-native';
import type { VideoRef } from 'react-native-video';

function VideoComponent(
  { muted, ...rawProps }: IVideoProps,
  ref: ForwardedRef<IVideoRef>,
) {
  const videoRef = useRef<VideoRef>(null);
  const [props, style] = usePropsAndStyle(rawProps);
  useImperativeHandle(
    ref,
    () => ({
      resume: () => {
        videoRef.current?.resume();
      },
      seek: (time, tolerance) => {
        videoRef.current?.seek(time, tolerance);
      },
    }),
    [],
  );
  return (
    <NativeVideo
      ref={videoRef}
      style={style as ViewStyle}
      muted={muted}
      {...props}
    />
  );
}

export const Video = forwardRef<IVideoRef, IVideoProps>(VideoComponent);

export type * from './type';
export * from './enum';
