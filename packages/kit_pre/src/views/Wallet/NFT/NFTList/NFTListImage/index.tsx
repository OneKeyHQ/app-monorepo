import type { ComponentProps, FC } from 'react';

import { Box } from '@onekeyhq/components';
import {
  getImageWithAsset,
  isSVGContract,
} from '@onekeyhq/engine/src/managers/nft';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import NFTImage from '../../../../../components/NFTImage';
import { MemoFallbackElement } from '../../../../../components/NFTPlaceholderElement';
import NFTSVGImage from '../../../../../components/NFTSVGImage';

type Props = {
  url?: string;
  asset: NFTAsset;
  size: number;
  thumbnail?: boolean;
  skeleton?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
} & ComponentProps<typeof Box>;

const NFTListImage: FC<Props> = ({
  url,
  thumbnail = true,
  asset,
  resizeMode,
  size,
  skeleton = false,
  ...props
}) => {
  const imageUrl = url ?? asset.nftscanUri;
  const s3Url = thumbnail ? asset.image.thumbnail : asset.image.source;
  const source = getImageWithAsset(asset);
  const tokenId = asset.contractTokenId ?? asset.tokenAddress;
  if (source && tokenId) {
    if (isSVGContract(asset.contractAddress)) {
      // for ENS image
      return (
        <Box size={`${size}px`} {...props} overflow="hidden">
          <NFTSVGImage
            width={`${size}px`}
            height={`${size}px`}
            s3Url={s3Url}
            nftSource={{
              contractAddress: asset.contractAddress,
              tokenId,
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
      <Box size={`${size}px`} {...props} overflow="hidden">
        <NFTImage
          alt={undefined}
          resizeMode={resizeMode}
          width={`${size}px`}
          height={`${size}px`}
          url={imageUrl}
          s3Url={s3Url}
          nftSource={{
            contractAddress: asset.contractAddress,
            tokenId,
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

export default NFTListImage;
