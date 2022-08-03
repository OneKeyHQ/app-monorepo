import { useCallback, useEffect, useMemo, useState } from 'react';

import axios from 'axios';

import {
  getContentWithAsset,
  s3SourceUri,
  syncImage,
} from '@onekeyhq/engine/src/managers/nftscan';
import { NFTScanAsset } from '@onekeyhq/engine/src/types/nftscan';

type ComponentType =
  | 'unknown'
  | 'Audio'
  | 'Video'
  | 'Image'
  | 'SVG'
  | undefined;

export function componentTypeWithContentType(contentType: string) {
  if (
    contentType === 'image/jpeg' ||
    contentType === 'image/gif' ||
    contentType === 'image/png' ||
    contentType === 'image/jpg'
  ) {
    return 'Image';
  }
  if (contentType === 'image/svg') {
    return 'SVG';
  }
  if (contentType === 'video/mp4') {
    return 'Video';
  }
  if (contentType === 'audio/wav' || contentType === 'audio/mpeg') {
    return 'Audio';
  }
}

export function getComponentTypeWithAsset(asset: NFTScanAsset): ComponentType {
  const { contentType, contentUri } = asset;
  if (contentUri?.startsWith('data:image/svg+xml;base64')) {
    return 'SVG';
  }
  if (contentType) {
    return componentTypeWithContentType(contentType);
  }
}

type UploadState = null | 'uploading' | 'fail' | 'success';
type UniqueTokenResult = {
  componentType: ComponentType;
  uploadState: UploadState;
  url?: string;
};

export default function useUniqueToken(asset: NFTScanAsset): UniqueTokenResult {
  const [uploadState, setUploadState] = useState<UploadState>(null);
  const s3url = s3SourceUri(asset.contractAddress, asset.contractTokenId);
  const [componentType, setComponentType] = useState<ComponentType>(
    getComponentTypeWithAsset(asset),
  );

  const checkContentType = useCallback(async () => {
    const uploadSource = getContentWithAsset(asset);
    if (uploadSource) {
      const contentType = await axios
        .head(uploadSource, { timeout: 1000 })
        .then((resp) => resp.headers['content-type'])
        .catch(() => '404');
      if (contentType === '404') {
        setComponentType('unknown');
      } else {
        setComponentType(componentTypeWithContentType(contentType));
      }
    }
  }, [asset]);

  const checkUrlValid = useCallback(async () => {
    const contentType = await axios
      .head(s3url, { timeout: 1000 })
      .then((resp) => resp.headers['content-type'])
      .catch(() => '404');
    const state = contentType !== '404' ? 'success' : 'uploading';
    setUploadState(state);
  }, [s3url]);

  const uploadImage = useCallback(async () => {
    const uploadSource = getContentWithAsset(asset);
    if (uploadSource) {
      const data = await syncImage({
        contractAddress: asset.contractAddress,
        tokenId: asset.contractTokenId,
        imageURI: uploadSource,
      });
      if (data) {
        setUploadState('success');
      }
    }
  }, [asset]);

  useEffect(() => {
    if (componentType === undefined) {
      checkContentType();
    }
  }, [checkContentType, componentType]);

  useEffect(() => {
    if (uploadState === null) {
      checkUrlValid();
    } else if (uploadState === 'uploading') {
      // upload
      uploadImage();
    }
  }, [checkUrlValid, uploadState, uploadImage]);

  return useMemo(
    () => ({
      uploadState,
      componentType,
      s3url,
    }),
    [uploadState, componentType, s3url],
  );
}
