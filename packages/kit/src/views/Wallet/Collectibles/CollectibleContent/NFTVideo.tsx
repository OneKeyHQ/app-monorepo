import React, { FC, useMemo } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Box } from '@onekeyhq/components';
import { getImageWithAsset } from '@onekeyhq/engine/src/managers/moralis';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { cloudinarySourceWithPublidId } from '../../../../utils/imageUtils';

import { NFTProps } from './type';

const NFTVideo: FC<NFTProps> = ({ asset, width, height }) => {
  const poster = useMemo(() => getImageWithAsset(asset), [asset]);

  const uri = useMemo(() => {
    const source = asset.animationUrl ?? asset.imageUrl;
    if (source) {
      return cloudinarySourceWithPublidId(
        source.publicId,
        'video',
        platformEnv.isNative ? source.width : width,
      );
    }
    return '';
  }, [asset.animationUrl, asset.imageUrl, width]);

  const video = React.useRef<Video | null>(null);
  return (
    <Box size={width}>
      <Video
        ref={video}
        isMuted
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
        posterSource={{ uri: poster }}
        posterStyle={{ width, height }}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay
      />
    </Box>
  );
};

export default NFTVideo;
