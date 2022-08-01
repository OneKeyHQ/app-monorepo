import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import axios from 'axios';

import {
  Box,
  Center,
  CustomSkeleton,
  Image,
  NetImage,
  Spinner,
} from '@onekeyhq/components';
import NFTEmptyImg from '@onekeyhq/components/img/nft_empty.png';
import {
  getImageWithAsset,
  s3SourceUri,
  syncImage,
} from '@onekeyhq/engine/src/managers/nftscan';
import type { NFTScanAsset } from '@onekeyhq/engine/src/types/nftscan';

type Props = {
  asset: NFTScanAsset;
  size: number;
} & ComponentProps<typeof Box>;

const FallbackElement: FC<ComponentProps<typeof Box>> = ({
  size,
  ...props
}) => (
  <Center size={size} {...props} overflow="hidden">
    <Image size={size} source={NFTEmptyImg} />
  </Center>
);

const MemoFallbackElement = React.memo(FallbackElement);

type ImageState = null | 'uploading' | 'fail' | 'success';
const useUrlData = (asset: NFTScanAsset) => {
  const [imageState, setImageState] = useState<ImageState>(null);
  const s3url = s3SourceUri(asset.contractAddress, asset.contractTokenId);

  const checkUrlValid = useCallback(async () => {
    const contentType = await axios
      .head(s3url, { timeout: 1000 })
      .then((resp) => resp.headers['content-type'])
      .catch(() => '404');
    const state = contentType !== '404' ? 'success' : 'uploading';
    setImageState(state);
  }, [s3url]);

  const uploadImage = useCallback(async () => {
    const uploadSource = getImageWithAsset(asset);
    if (uploadSource) {
      const uploadUrl = await syncImage({
        contractAddress: asset.contractAddress,
        tokenId: asset.contractTokenId,
        imageURI: uploadSource,
      });
      if (uploadUrl.length > 0) {
        setImageState('success');
      }
    }
  }, [asset]);

  useEffect(() => {
    if (imageState === null) {
      checkUrlValid();
    } else if (imageState === 'uploading') {
      // upload
      uploadImage();
    }
  }, [checkUrlValid, imageState, uploadImage]);

  return useMemo(
    () => ({
      url: s3url,
      imageState,
    }),
    [imageState, s3url],
  );
};
const CollectibleListImage: FC<Props> = ({ asset, size, ...props }) => {
  // const url = getImageWithAsset(asset);

  const { url, imageState } = useUrlData(asset);

  if (imageState === 'success') {
    return (
      <Box size={`${size}px`} {...props} overflow="hidden">
        <NetImage
          retry={3}
          width={`${size}px`}
          height={`${size}px`}
          src={url}
          fallbackElement={
            <MemoFallbackElement size={`${size}px`} {...props} />
          }
        />
      </Box>
    );
  }
  if (imageState === 'fail') {
    return <MemoFallbackElement size={`${size}px`} {...props} />;
  }
  return <CustomSkeleton size={`${size}px`} {...props} />;
};

export default CollectibleListImage;
