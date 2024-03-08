import { useEffect, useState } from 'react';

import { Video as ExpoVideo } from 'expo-av';

import type { VideoProps } from 'expo-av/src/Video.types';

export interface IVideoProps extends VideoProps {
  delayMs?: number;
}

export function Video({ delayMs, source, ...props }: IVideoProps) {
  const [sourceUri, setSourceUri] = useState<VideoProps['source']>(undefined);
  useEffect(() => {
    if (delayMs) {
      setTimeout(() => {
        setSourceUri(source);
      }, delayMs);
    }
  }, [delayMs, source]);
  return <ExpoVideo {...props} source={sourceUri} />;
}

export { ResizeMode as VideoResizeMode } from 'expo-av';
