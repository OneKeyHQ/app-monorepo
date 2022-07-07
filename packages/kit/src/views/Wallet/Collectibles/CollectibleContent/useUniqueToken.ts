import React from 'react';

import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import { isAudio, isSVG, isVideo } from '@onekeyhq/kit/src/utils/uriUtils';

type UniqueTokenResult = {
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsSVG: boolean;
};

export default function useUniqueToken(
  maybeUniqueToken: MoralisNFT,
): UniqueTokenResult {
  return React.useMemo((): UniqueTokenResult => {
    if (typeof maybeUniqueToken === 'object' && !!maybeUniqueToken) {
      const { animationUrl, imageUrl } = maybeUniqueToken;
      const assetUrl = animationUrl?.secureUrl || imageUrl?.secureUrl;
      console.log('assetUrl = ', assetUrl);

      const supportsAudio = isAudio(assetUrl);
      const supportsVideo = isVideo(assetUrl);
      const supportsSVG = isSVG(assetUrl);
      return { supportsAudio, supportsVideo, supportsSVG };
    }
    return {
      supportsAudio: false,
      supportsVideo: false,
      supportsSVG: false,
    };
  }, [maybeUniqueToken]);
}
