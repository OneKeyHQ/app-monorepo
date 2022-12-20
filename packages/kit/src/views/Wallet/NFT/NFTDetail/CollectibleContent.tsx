import type { FC } from 'react';

import {
  CustomSkeleton,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import {
  getContentWithAsset,
  getHttpImageWithAsset,
} from '@onekeyhq/engine/src/managers/nft';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NFTAudio from '../../../../components/NFTAudio';
import { MemoFallbackElement } from '../../../../components/NFTPlaceholderElement';
import NFTSVG from '../../../../components/NFTSVG';
import NFTVideo from '../../../../components/NFTVideo';
import NFTListImage from '../NFTList/NFTListImage';

import useUniqueToken, { ComponentType } from './useUniqueToken';

export type Props = {
  asset: NFTAsset;
  size?: number;
};

const CollectibleContent: FC<Props> = ({ asset, size }) => {
  const { screenWidth } = useUserDevice();
  const isSmallScreen = useIsVerticalLayout();

  // eslint-disable-next-line no-nested-ternary
  const imageWidth = isSmallScreen
    ? platformEnv.isExtension
      ? 176
      : screenWidth - 32
    : 288;

  if (asset.nftscanUri && asset.nftscanUri.length > 0) {
    <NFTListImage
      url={asset.nftscanUri}
      asset={asset}
      thumbnail={false}
      size={size || imageWidth}
      skeleton
      borderRadius="12px"
      resizeMode="cover"
      shadow="depth.5"
    />;
  }
  const { componentType } = useUniqueToken(asset);
  const uri = getContentWithAsset(asset);

  if (uri) {
    if (componentType === undefined) {
      return (
        <CustomSkeleton size={size || `${imageWidth}px`} borderRadius="12px" />
      );
    }
    if (componentType === ComponentType.Image) {
      return (
        <NFTListImage
          url={uri}
          asset={asset}
          thumbnail={false}
          size={size || imageWidth}
          skeleton
          borderRadius="12px"
          resizeMode="cover"
          shadow="depth.5"
        />
      );
    }
    if (componentType === ComponentType.Video) {
      return <NFTVideo url={uri} size={size || imageWidth} />;
    }
    if (componentType === ComponentType.SVG) {
      return <NFTSVG url={uri} size={size || imageWidth} />;
    }
    if (componentType === ComponentType.Audio) {
      const imageUrl = getHttpImageWithAsset(asset);
      return <NFTAudio url={uri} size={size || imageWidth} poster={imageUrl} />;
    }
  }
  return (
    <MemoFallbackElement
      contentType={asset.contentType}
      logoUrl={asset.collection.logoUrl}
      size={size || imageWidth}
    />
  );
};

export default CollectibleContent;
