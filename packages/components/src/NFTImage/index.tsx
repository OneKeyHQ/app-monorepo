import React, { ComponentProps, FC, useCallback } from 'react';

import axios from 'axios';

import NetImage from '../NetImage';

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
      console.log('uploadImage');
      const apiUrl = `${testFiatServiceURL}/NFT/sync`;
      const uploadData = await axios.post(apiUrl, {
        contractAddress: nftSource.contractAddress,
        tokenId: nftSource.tokenId,
        imageURI: nftSource.url,
      });
      if (uploadData) {
        return true;
      }
      return false;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftSource]);

  return <NetImage {...rest} src={s3Url} onErrorWithTask={uploadImage} />;
};
export default NFTImage;
