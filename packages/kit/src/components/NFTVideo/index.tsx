import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Box, CustomSkeleton } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type Props = {
  size: number;
  url: string;
};
const NFTVideo: FC<Props> = ({ url, size }) => {
  const [innerUrl, setInnerUrl] = useState<string>();
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>();
  const video = useRef<Video | null>(null);
  const isPlaying = useRef<boolean | null>(null);
  useEffect(() => {
    setInnerUrl(url);
  }, [url]);
  return (
    <Box size={`${size}px`}>
      {innerUrl && (
        <Video
          onLoadStart={() => {
            setLoading(true);
          }}
          onError={() => {
            setLoading(false);
          }}
          onLoad={() => {
            setLoading(false);
          }}
          ref={video}
          onPlaybackStatusUpdate={(s) => {
            if (s.isLoaded === true) {
              if (isPlaying.current === false && s.isPlaying === true) {
                setIsMuted(false);
              }
              isPlaying.current = s.isPlaying;
            } else {
              isPlaying.current = null;
            }
          }}
          isMuted={isMuted}
          style={{
            alignSelf: 'center',
            width: size,
            height: size,
          }}
          source={{
            uri: innerUrl,
          }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay
        />
      )}

      {loading && platformEnv.isNativeIOS ? (
        <CustomSkeleton position="absolute" size={size} borderRadius="20px" />
      ) : null}
    </Box>
  );
};

export default NFTVideo;
