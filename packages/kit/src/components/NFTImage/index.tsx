import React, { ComponentProps, FC, useCallback } from 'react';

import axios from 'axios';

import NetImage from '@onekeyhq/components/src/NetImage';

const testFiatServiceURL = 'https://fiat.onekeytest.com';

type Props = {
  s3Url: string;
  nftSource?: {
    contractAddress: string;
    tokenId: string;
    url?: string;
  };
} & ComponentProps<typeof NetImage>;

const NFTImage: FC<Props> = ({ nftSource, ...rest }) => {
  const { s3Url } = rest;
  const uploadImage = useCallback(async () => {
    if (nftSource?.url) {
      const apiUrl = `${testFiatServiceURL}/NFT/sync`;
      const success = await axios
        .post(
          apiUrl,
          {
            contractAddress: nftSource.contractAddress,
            tokenId: nftSource.tokenId,
            imageURI: nftSource.url,
          },
          { timeout: 3 * 60 * 1000 },
        )
        .then(() => true)
        .catch(() => false);
      return success;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftSource]);

  return <NetImage {...rest} src={s3Url} onErrorWithTask={uploadImage} />;
};
export default NFTImage;
