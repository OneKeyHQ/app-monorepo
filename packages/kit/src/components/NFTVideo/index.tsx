import React, { FC, useState } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Box, CustomSkeleton } from '@onekeyhq/components';

type Props = {
  size: number;
  url: string;
};
const NFTVideo: FC<Props> = ({ url, size }) => {
  const [loading, setLoading] = useState<boolean>();
  const video = React.useRef<Video | null>(null);

  return (
    <Box size={`${size}px`}>
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
        isMuted
        style={{
          alignSelf: 'center',
          width: size,
          height: size,
        }}
        source={{
          uri: url,
        }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay
      />
      {loading ? (
        <CustomSkeleton position="absolute" size={size} borderRadius="20px" />
      ) : null}
    </Box>
  );
};

export default NFTVideo;
