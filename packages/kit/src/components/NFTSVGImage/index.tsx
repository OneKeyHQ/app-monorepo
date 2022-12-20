import type { ComponentProps, FC } from 'react';
import { useEffect, useState } from 'react';

import axios from 'axios';
import { SvgUri } from 'react-native-svg';

import { Box } from '@onekeyhq/components';
import type NetImage from '@onekeyhq/components/src/NetImage';
import { syncImage } from '@onekeyhq/engine/src/managers/nft';

type Props = {
  s3Url: string;
  nftSource?: {
    contractAddress?: string;
    tokenId: string;
    url?: string;
  };
} & ComponentProps<typeof NetImage>;

async function isImageReady(url: string): Promise<boolean | null> {
  return axios
    .head(url)
    .then((resp) => {
      const { headers } = resp;
      const contentType = headers['content-type'];
      if (contentType === 'image/svg+xml') {
        return true;
      }
      return null;
    })
    .catch(() => false);
}

export enum ImageState {
  Ready = 0,
  Loading,
  Fail,
}

const NFTSVGImage: FC<Props> = ({ nftSource, ...rest }) => {
  const { s3Url, width, height, fallbackElement, bgColor, borderRadius } = rest;
  const [imageState, setImageState] = useState<ImageState>(ImageState.Loading);
  useEffect(() => {
    async function main() {
      const isReady = await isImageReady(s3Url);
      if (isReady === true) {
        setImageState(ImageState.Ready);
      } else if (isReady === false && nftSource) {
        const success = await syncImage({
          contractAddress: nftSource.contractAddress,
          tokenId: nftSource.tokenId,
          imageURI: nftSource.url,
        });
        setImageState(success ? ImageState.Ready : ImageState.Fail);
      } else {
        setImageState(ImageState.Fail);
      }
    }
    main();
  }, [nftSource, s3Url]);

  if (imageState === ImageState.Ready) {
    return (
      <SvgUri
        width={width}
        height={height}
        uri={s3Url}
        // @ts-ignore
        onError={() => {
          setImageState(ImageState.Fail);
        }}
      />
    );
  }
  if (imageState === ImageState.Loading) {
    return (
      <Box
        width={width}
        height={height}
        borderRadius={borderRadius}
        bgColor={bgColor}
      />
    );
  }
  return (
    <Box width={width} height={height} borderRadius={borderRadius}>
      {fallbackElement}
    </Box>
  );
};
export default NFTSVGImage;
