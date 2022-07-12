import React from 'react';

import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import { isAudio, isSVG, isVideo } from '@onekeyhq/kit/src/utils/uriUtils';

type UniqueTokenResult = {
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsSVG: boolean;
  url?: string;
};

export default function useUniqueToken(
  maybeUniqueToken: MoralisNFT,
): UniqueTokenResult {
  return React.useMemo((): UniqueTokenResult => {
    if (typeof maybeUniqueToken === 'object' && !!maybeUniqueToken) {
      const { animationUrl, imageUrl } = maybeUniqueToken;
      let url;
      if (imageUrl && imageUrl.resourceType !== 'raw') {
        url = imageUrl.secureUrl;
      }
      if (animationUrl && animationUrl.resourceType !== 'raw') {
        url = animationUrl.secureUrl;
      }
      console.log('assetUrl = ', url);

      const supportsAudio = isAudio(url);
      const supportsVideo = isVideo(url);
      const supportsSVG = isSVG(url);
      return { supportsAudio, supportsVideo, supportsSVG, url };
    }
    return {
      supportsAudio: false,
      supportsVideo: false,
      supportsSVG: false,
    };
  }, [maybeUniqueToken]);
}
