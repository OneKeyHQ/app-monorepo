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

const CollectibleListImage: FC<Props> = ({ asset, size, ...props }) => {
  // const { url, imageState } = useUrlData(asset);
  const url = s3SourceUri(asset.contractAddress, asset.contractTokenId, true);

  // const [uploadState, setUploadState] = useState<boolean | null>(null);
  const [isUpload, setIsupload] = useState<boolean | null>(null);

  const uploadImage = useCallback(async () => {
    const uploadSource = getImageWithAsset(asset);
    if (uploadSource) {
      const uploadData = await syncImage({
        contractAddress: asset.contractAddress,
        tokenId: asset.contractTokenId,
        imageURI: uploadSource,
      });
      if (uploadData) {
        setIsupload(true);
      } else {
        setIsupload(false);
      }
    } else {
      setIsupload(false);
    }
  }, [asset]);

  useEffect(() => {}, []);

  if (isUpload === false) {
    return <MemoFallbackElement size={`${size}px`} {...props} />;
  }
  const key = isUpload === null ? 'upload null key' : 'upload true key';
  return (
    <Box size={`${size}px`} {...props} overflow="hidden">
      <NetImage
        key={isUpload}
        retry={0}
        skeleton
        width={`${size}px`}
        height={`${size}px`}
        src={url}
        // onErrorWithTask={uploadImage}
      />
    </Box>
  );
};

export default CollectibleListImage;
