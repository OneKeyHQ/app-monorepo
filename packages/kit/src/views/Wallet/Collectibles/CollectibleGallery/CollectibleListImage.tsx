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
} & ComponentProps<typeof Box>;

const CollectibleListImage: FC<Props> = ({
  url,
  thumbnail = true,
  asset,
  size,
  skeleton = false,
  ...props
}) => {
  const s3Url = url ?? thumbnail ? asset.image.thumbnail : asset.image.source;
  const source = getImageWithAsset(asset);
  if (source) {
    return (
      <Box size={`${size}px`} {...props} overflow="hidden">
        <NFTImage
          width={`${size}px`}
          height={`${size}px`}
          s3Url={s3Url}
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
