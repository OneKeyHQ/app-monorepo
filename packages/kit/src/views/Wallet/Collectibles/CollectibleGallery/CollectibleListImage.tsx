import React, { ComponentProps, FC } from 'react';

import { Box, NetImage } from '@onekeyhq/components';
import { getImageWithAsset } from '@onekeyhq/engine/src/managers/moralis';
import type { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';

type Props = {
  asset: MoralisNFT;
  size: number;
} & ComponentProps<typeof Box>;

const CollectibleListImage: FC<Props> = ({ asset, size, ...props }) => {
  const imageUrl = getImageWithAsset(asset);
  return (
    <Box size={`${size}px`} {...props} overflow="hidden">
      <NetImage width={size} height={size} uri={imageUrl} />
    </Box>
  );
};

export default CollectibleListImage;
