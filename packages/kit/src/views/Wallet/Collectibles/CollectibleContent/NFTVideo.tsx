import React, { FC, useMemo } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Box } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { cloudinaryVideoWithPublidId } from '../../../../utils/imageUtils';

import { NFTProps } from './type';

const NFTVideo: FC<NFTProps> = ({ asset, width, height }) => {
  const uri = useMemo(() => {
    const source = asset.animationUrl ?? asset.imageUrl;
    if (source) {
      return cloudinaryVideoWithPublidId(
        source.publicId,
        platformEnv.isWeb ? width : source.width,
      );
    }
    return '';
  }, [asset.animationUrl, asset.imageUrl, width]);

  console.log('video = ', uri);
  const video = React.useRef<Video | null>(null);
  return (
    <Box size={width}>
      <Video
        ref={video}
        style={{
          alignSelf: 'center',
          width,
          height,
        }}
        source={{
          uri,
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
