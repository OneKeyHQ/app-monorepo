import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAssetSources } from '@onekeyhq/engine/src/managers/moralis';
import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import { isAudio, isSVG, isVideo } from '@onekeyhq/kit/src/utils/uriUtils';

type UniqueTokenResult = {
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsSVG: boolean;
  url?: string;
};

export default function useUniqueToken(asset: MoralisNFT): UniqueTokenResult {
  const [source, setSource] = useState(asset.animationUrl ?? asset.imageUrl);

  const getData = useCallback(async () => {
    if (source && !source?.secureUrl) {
      const result = await getAssetSources(
        source.publicId,
        source.resourceType,
      );
      if (result.secureUrl) {
        setSource(result);
      }
    }
  }, [source]);

  useEffect(() => {
    getData();
  }, [getData]);

  return useMemo((): UniqueTokenResult => {
    if (source && source?.secureUrl && source.resourceType !== 'raw') {
      const url = source.secureUrl;
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
  }, [source]);
}
