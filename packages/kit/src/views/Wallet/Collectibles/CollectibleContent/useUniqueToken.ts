import React from 'react';

import { OpenSeaAsset } from '@onekeyhq/engine/src/types/opensea';
import { isAudio, isSVG, isVideo } from '@onekeyhq/kit/src/utils/uriUtils';

type UniqueTokenResult = {
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsSVG: boolean;
};

export default function useUniqueToken(
  maybeUniqueToken: OpenSeaAsset | null,
): UniqueTokenResult {
  return React.useMemo((): UniqueTokenResult => {
    if (typeof maybeUniqueToken === 'object' && !!maybeUniqueToken) {
      const { animationUrl, imageUrl } = maybeUniqueToken;
      const assetUrl = animationUrl || imageUrl;
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
