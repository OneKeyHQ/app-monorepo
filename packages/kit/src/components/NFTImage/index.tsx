import React, { ComponentProps, FC, useCallback } from 'react';

import NetImage from '@onekeyhq/components/src/NetImage';
import { syncImage } from '@onekeyhq/engine/src/managers/nft';

type Props = {
  s3Url: string;
  nftSource: {
    contractAddress?: string;
    tokenId: string;
    url?: string;
  };
} & ComponentProps<typeof NetImage>;

const NFTImage: FC<Props> = ({ nftSource, ...rest }) => {
  const { s3Url } = rest;
  const uploadImage = useCallback(
    async () =>
      syncImage({
        contractAddress: nftSource.contractAddress,
        tokenId: nftSource.tokenId,
        imageURI: nftSource?.url,
      }),
    [nftSource],
  );

  return <NetImage {...rest} src={s3Url} onErrorWithTask={uploadImage} />;
};
export default NFTImage;
