import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import NetImage from '@onekeyhq/components/src/NetImage';
import { syncImage } from '@onekeyhq/engine/src/managers/nft';

type Props = {
  url?: string | null;
  s3Url?: string;
  nftSource: {
    contractAddress?: string;
    tokenId: string;
    url?: string;
  };
} & ComponentProps<typeof NetImage>;

const NFTImage: FC<Props> = ({ nftSource, ...rest }) => {
  const url = rest.url ?? rest.s3Url;
  const uploadImage = useCallback(
    async () =>
      syncImage({
        contractAddress: nftSource.contractAddress,
        tokenId: nftSource.tokenId,
        imageURI: nftSource?.url,
      }),
    [nftSource],
  );

  return (
    <NetImage
      {...rest}
      src={url}
      onErrorWithTask={rest.s3Url ? uploadImage : undefined}
    />
  );
};
export default NFTImage;
