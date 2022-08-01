import React, { FC } from 'react';

import { useWindowDimensions } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { getImageWithAsset } from '@onekeyhq/engine/src/managers/nftscan';

import NFTAudio from './NFTAudio';
import NFTImage from './NFTImage';
import NFTSVG from './NFTSVG';
import NFTVideo from './NFTVideo';
import { NFTProps } from './type';
// import useUniqueToken from './useUniqueToken';

const CollectibleContent: FC<NFTProps> = ({ asset }) => {
  // const { supportsVideo, supportsAudio, supportsSVG, url } =
  //   useUniqueToken(asset);
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const imageWidth = isSmallScreen ? width - 32 : 358;
  const url = getImageWithAsset(asset);
  console.log('url = ', url);
  console.log('asset = ', asset);

  const shareProps: NFTProps = {
    width: imageWidth,
    height: imageWidth,
    asset,
    url,
  };

  // if (supportsSVG) {
  //   return <NFTSVG {...shareProps} />;
  // }
  // if (supportsVideo) {
  //   return <NFTVideo {...shareProps} />;
  // }
  // if (supportsAudio) {
  //   return <NFTAudio {...shareProps} />;
  // }
  console.log();

  return <NFTImage {...shareProps} />;
};

export default CollectibleContent;
