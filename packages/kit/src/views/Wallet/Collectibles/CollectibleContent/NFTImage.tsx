import React, { FC } from 'react';

import { Box, Center, Icon, Image } from '@onekeyhq/components';
import { getCloudinaryObject } from '@onekeyhq/engine/src/managers/moralis';

import { NFTProps } from './type';

const NFTImage: FC<NFTProps> = ({ asset, width, height }) => {
  const imageUrl = getCloudinaryObject(asset, 'image')?.secureUrl;
  console.log('imageUrl = ', imageUrl);

  const fallbackElement = (
    <Center
      width={width}
      height="333px"
      bgColor="surface-default"
      borderRadius="20px"
    >
      <Icon name="QuestionMarkCircleOutline" size={166} />
    </Center>
  );
  return (
    <Box size={width}>
      {imageUrl ? (
        <Image
          flex="1"
          alt={`image of ${
            typeof asset.name === 'string' ? asset.name : 'nft'
          }`}
          height={width}
          width={height}
          borderRadius="20px"
          src={imageUrl}
          fallbackElement={fallbackElement}
        />
      ) : (
        fallbackElement
      )}
    </Box>
  );
};

export default NFTImage;
