import React, { useCallback, useEffect, useState } from 'react';

import { getAssetDetail } from '@onekeyhq/engine/src/managers/moralis';
import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import { isAudio, isSVG, isVideo } from '@onekeyhq/kit/src/utils/uriUtils';

type UniqueTokenResult = {
  asset: MoralisNFT;
  loading: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsSVG: boolean;
};

export default function useUniqueToken(asset: MoralisNFT): UniqueTokenResult {
  const [assetdetail, updateDetail] = useState<MoralisNFT>(asset);

  const [loading, setLoading] = useState<boolean>(true);
  const getData = useCallback(async () => {
    setLoading(true);
    const result = await getAssetDetail(
      asset.tokenAddress,
      asset.tokenId,
      asset.chain,
    );
    setLoading(false);

    if (result.image && result.image?.length > 0) {
      updateDetail(result);
    }
  }, [asset.chain, asset.tokenAddress, asset.tokenId]);

  useEffect(() => {
    getData();
  }, [getData]);

  return React.useMemo((): UniqueTokenResult => {
    if (assetdetail.image) {
      const formots = assetdetail.image.map((item) => item.format);

      const supportsAudio = isAudio(formots);
      const supportsVideo = isVideo(formots);
      const supportsSVG = isSVG(formots);
      return {
        asset: assetdetail,
        supportsAudio,
        supportsVideo,
        supportsSVG,
        loading,
      };
    }
    return {
      asset: assetdetail,
      loading: false,
      supportsAudio: false,
      supportsVideo: false,
      supportsSVG: false,
    };
  }, [assetdetail, loading]);
}
