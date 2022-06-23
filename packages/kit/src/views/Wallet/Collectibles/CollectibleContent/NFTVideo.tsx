import React, { FC, useMemo } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Box } from '@onekeyhq/components';

import { NFTProps } from './type';

const NFTVideo: FC<NFTProps> = ({ asset, width, height }) => {
  const url = useMemo(
    () => asset.animationUrl ?? asset.imageUrl,
    [asset.animationUrl, asset.imageUrl],
  );
  const video = React.useRef<Video | null>(null);
  return (
    <Box>
      <Video
        ref={video}
        style={{
          alignSelf: 'center',
          width,
          height,
        }}
        source={{
          uri: url as string,
        }}
        useNativeControls
        usePoster
        posterSource={{ uri: asset.imageUrl as string }}
        posterStyle={{ width, height }}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay
      />
    </Box>
  );
};

export default NFTVideo;
