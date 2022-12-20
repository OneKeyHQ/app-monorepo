import { useCallback, useEffect, useMemo, useState } from 'react';

import axios from 'axios';

import { getContentWithAsset } from '@onekeyhq/engine/src/managers/nft';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

export enum ComponentType {
  Image = 0,
  Video,
  Audio,
  SVG,
  UnSupport,
}

export function componentTypeWithContentType(
  contentType: string,
): ComponentType | undefined {
  if (
    contentType === 'image/jpeg' ||
    contentType === 'image/gif' ||
    contentType === 'image/png' ||
    contentType === 'image/jpg'
  ) {
    return ComponentType.Image;
  }
  if (contentType === 'image/svg' || contentType === 'image/svg+xml') {
    return ComponentType.SVG;
  }
  if (contentType === 'video/mp4') {
    return ComponentType.Video;
  }
  if (contentType === 'audio/wav' || contentType === 'audio/mpeg') {
    return ComponentType.Audio;
  }
  if (
    contentType === 'model/gltf-binary' ||
    contentType === 'model/gltf+json'
  ) {
    return ComponentType.UnSupport;
  }
}

export function getComponentTypeWithAsset(
  asset: NFTAsset,
): ComponentType | undefined {
  const { contentType, contentUri } = asset;
  if (
    contentUri?.startsWith('data:image/svg+xml') ||
    contentUri?.startsWith('<svg')
  ) {
    return ComponentType.SVG;
  }
  if (contentType) {
    return componentTypeWithContentType(contentType);
  }
}

type UniqueTokenResult = {
  componentType?: ComponentType;
  url?: string;
};

export default function useUniqueToken(asset: NFTAsset): UniqueTokenResult {
  const url = asset.image.source;
  const [componentType, setComponentType] = useState<ComponentType | undefined>(
    getComponentTypeWithAsset(asset),
  );
  const checkContentType = useCallback(async () => {
    const uploadSource = getContentWithAsset(asset);
    if (uploadSource) {
      const contentType = await axios
        .head(uploadSource, { timeout: 10000 })
        .then((resp) => resp.headers['content-type'])
        .catch(() => '404');
      if (contentType === '404') {
        setComponentType(ComponentType.UnSupport);
      } else {
        setComponentType(
          componentTypeWithContentType(contentType) ?? ComponentType.UnSupport,
        );
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
