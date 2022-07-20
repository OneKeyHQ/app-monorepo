import React, { FC } from 'react';

import { Box, Center, Image } from '@onekeyhq/components';
import NFTEmptyImg from '@onekeyhq/components/img/nft_empty.png';

import { NFTProps } from './type';

const NFTImage: FC<NFTProps> = ({ asset, width, height, url }) => {
  const fallbackElement = (
    <Center
      width={width}
      height="333px"
      bgColor="surface-default"
      borderRadius="20px"
      overflow="hidden"
    >
      <Image width={width} height={height} source={NFTEmptyImg} />
    </Center>
  );
  return (
    <Box size={width}>
      {url ? (
        <Image
          flex="1"
          alt={`image of ${
            typeof asset.name === 'string' ? asset.name : 'nft'
          }`}
          height={width}
          width={height}
          borderRadius="20px"
          src={url}
          fallbackElement={fallbackElement}
        />
      ) : (
        fallbackElement
      )}
    </Box>
  );
};

export default NFTImage;
