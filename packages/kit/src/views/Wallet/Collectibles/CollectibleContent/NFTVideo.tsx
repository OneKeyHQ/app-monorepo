import React, { FC } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Box } from '@onekeyhq/components';
import { getCloudinaryObject } from '@onekeyhq/engine/src/managers/moralis';

import { NFTProps } from './type';

const NFTVideo: FC<NFTProps> = ({ asset, width, height }) => {
  const object = getCloudinaryObject(asset, 'video');

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
          uri: object?.secureUrl as string,
        }}
        useNativeControls
        usePoster
        posterStyle={{ width, height }}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay
      />
    </Box>
  );
};

export default NFTVideo;
