import React, { ComponentProps, FC } from 'react';

import { Box } from '@onekeyhq/components';
import { getImageWithAsset } from '@onekeyhq/engine/src/managers/nft';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import NFTImage from '../../../../components/NFTImage';
import { MemoFallbackElement } from '../../../../components/NFTPlaceholderElement';

type Props = {
  url?: string;
  asset: NFTAsset;
  size: number;
  thumbnail?: boolean;
  skeleton?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
} & ComponentProps<typeof Box>;

const CollectibleListImage: FC<Props> = ({
  url,
  thumbnail = true,
  asset,
  resizeMode,
  size,
  skeleton = false,
  ...props
}) => {
  const imageUrl =
    url ?? (thumbnail ? asset.image.thumbnail : asset.image.source);
  const source = getImageWithAsset(asset);
  if (source) {
    return (
      <Box size={`${size}px`} {...props} overflow="hidden">
        <NFTImage
          resizeMode={resizeMode}
          width={`${size}px`}
          height={`${size}px`}
          s3Url={imageUrl}
          nftSource={{
            contractAddress: asset.contractAddress,
            tokenId: asset.contractTokenId,
            url: source,
          }}
          skeleton={skeleton}
          bgColor="surface-neutral-default"
          fallbackElement={
            <MemoFallbackElement
              contentType={asset.contentType}
              logoUrl={asset.collection.logoUrl}
              size={size}
              {...props}
            />
          }
        />
      </Box>
    );
  }
  return (
    <MemoFallbackElement
      contentType={asset.contentType}
      logoUrl={asset.collection.logoUrl}
      size={size}
      {...props}
    />
  );
};

export default CollectibleListImage;
