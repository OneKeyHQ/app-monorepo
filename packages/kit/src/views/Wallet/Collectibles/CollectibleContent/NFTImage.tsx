import React, { FC } from 'react';

import { Box, Center, Icon, Image } from '@onekeyhq/components';

import { NFTProps } from './type';

const NFTImage: FC<NFTProps> = ({ asset, width, height }) => (
  <Box size={width}>
    <Image
      flex="1"
      alt={`image of ${typeof asset.name === 'string' ? asset.name : 'nft'}`}
      height={width}
      width={height}
      borderRadius="20px"
      src={
        asset.imageUrl ??
        asset.imagePreviewUrl ??
        asset.imageOriginalUrl ??
        undefined
      }
      fallbackElement={
        <Center
          width={width}
          height="333px"
          bgColor="surface-default"
          borderRadius="20px"
        >
          <Icon name="QuestionMarkCircleOutline" size={166} />
        </Center>
      }
    />
  </Box>
);

export default NFTImage;
