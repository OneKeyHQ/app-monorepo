import React, { FC } from 'react';

import {
  CustomSkeleton,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import {
  getContentWithAsset,
  getHttpImageWithAsset,
} from '@onekeyhq/engine/src/managers/nft';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import NFTAudio from '../../../../components/NFTAudio';
import { MemoFallbackElement } from '../../../../components/NFTPlaceholderElement';
import NFTSVG from '../../../../components/NFTSVG';
import NFTVideo from '../../../../components/NFTVideo';
import CollectibleListImage from '../CollectibleGallery/CollectibleListImage';

import useUniqueToken, { ComponentType } from './useUniqueToken';

export type Props = {
  asset: NFTAsset;
};

const CollectibleContent: FC<Props> = ({ asset }) => {
  const { componentType } = useUniqueToken(asset);
  const { screenWidth } = useUserDevice();
  const isSmallScreen = useIsVerticalLayout();

  const imageWidth = isSmallScreen ? screenWidth - 32 : 358;
  const uri = getContentWithAsset(asset);

  if (uri) {
    if (componentType === undefined) {
      return <CustomSkeleton size={imageWidth} borderRadius="20px" />;
    }
    if (componentType === ComponentType.Image) {
      return (
        <CollectibleListImage
          url={uri}
          asset={asset}
          thumbnail={false}
          size={imageWidth}
          skeleton
          borderRadius="20px"
          resizeMode="cover"
        />
      );
    }
    if (componentType === ComponentType.Video) {
      return <NFTVideo url={uri} size={imageWidth} />;
    }
    if (componentType === ComponentType.SVG) {
      return <NFTSVG url={uri} size={imageWidth} />;
    }
    if (componentType === ComponentType.Audio) {
      const imageUrl = getHttpImageWithAsset(asset);
      return <NFTAudio url={uri} size={imageWidth} poster={imageUrl} />;
    }
  }
  return (
    <MemoFallbackElement
      contentType={asset.contentType}
      logoUrl={asset.collection.logoUrl}
      size={imageWidth}
    />
  );
};

export default CollectibleContent;
