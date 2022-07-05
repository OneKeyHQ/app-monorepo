import React, { FC } from 'react';

import { useWindowDimensions } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import NFTAudio from './NFTAudio';
import NFTImage from './NFTImage';
import NFTSVG from './NFTSVG';
import NFTVideo from './NFTVideo';
import { NFTProps } from './type';
import useUniqueToken from './useUniqueToken';

const CollectibleContent: FC<NFTProps> = ({ asset }) => {
  const {
    asset: assetDetail,
    supportsVideo,
    supportsAudio,
    supportsSVG,
  } = useUniqueToken(asset);
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const imageWidth = isSmallScreen ? width - 32 : 358;
  const shareProps: NFTProps = {
    width: imageWidth,
    height: imageWidth,
    asset: assetDetail,
  };

  if (supportsSVG) {
    return <NFTSVG {...shareProps} />;
  }
  if (supportsVideo) {
    return <NFTVideo {...shareProps} />;
  }
  if (supportsAudio) {
    return <NFTAudio {...shareProps} />;
  }
  return <NFTImage {...shareProps} />;
};

export default CollectibleContent;
