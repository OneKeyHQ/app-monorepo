import React, { FC, useMemo } from 'react';

import { Box, Center, Icon, Image } from '@onekeyhq/components';

import { NFTProps } from './type';

const NFTImage: FC<NFTProps> = ({ asset, width, height }) => {
  const object = useMemo(
    () => asset.animationUrl ?? asset.imageUrl,
    [asset.animationUrl, asset.imageUrl],
  );

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
      {object ? (
        <Image
          flex="1"
          alt={`image of ${
            typeof asset.name === 'string' ? asset.name : 'nft'
          }`}
          height={width}
          width={height}
          borderRadius="20px"
          src={object.secureUrl}
          fallbackElement={fallbackElement}
        />
      ) : (
        fallbackElement
      )}
    </Box>
  );
};

export default NFTImage;
