import { useCallback, useEffect, useMemo, useState } from 'react';

import axios from 'axios';

import { getContentWithAsset } from '@onekeyhq/engine/src/managers/nft';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

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

export function getComponentTypeWithAsset(asset: NFTAsset): ComponentType {
  const { contentType, contentUri } = asset;
  if (
    contentUri?.startsWith('data:image/svg+xml') ||
    contentUri?.startsWith('<svg')
  ) {
    return 'SVG';
  }
  if (contentType) {
    return componentTypeWithContentType(contentType);
  }
}

type UniqueTokenResult = {
  componentType: ComponentType;
  url?: string;
};

export default function useUniqueToken(asset: NFTAsset): UniqueTokenResult {
  const url = asset.image.source;
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

  useEffect(() => {
    if (componentType === undefined) {
      checkContentType();
    }
  }, [checkContentType, componentType]);

  return useMemo(
    () => ({
      componentType,
      url,
    }),
    [componentType, url],
  );
}
