import React, { ComponentProps, FC } from 'react';

import { Box, Center, Image, NetImage } from '@onekeyhq/components';
import NFTEmptyImg from '@onekeyhq/components/img/nft_empty.png';
import { getImageWithAsset } from '@onekeyhq/engine/src/managers/moralis';
import type { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';

type Props = {
  asset: MoralisNFT;
  size: number;
} & ComponentProps<typeof Box>;

const CollectibleListImage: FC<Props> = ({ asset, size, ...props }) => {
  const imageUrl = getImageWithAsset(asset);

  if (imageUrl === '') {
    return (
      <Center size={`${size}px`} {...props} overflow="hidden">
        <Image size={`${size}px`} source={NFTEmptyImg} />
      </Center>
    );
  }
  return (
    <Box size={`${size}px`} {...props} overflow="hidden">
      <NetImage width={size} height={size} uri={imageUrl} />
    </Box>
  );
};

export default CollectibleListImage;
