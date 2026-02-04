import { useCallback, useEffect, useState } from 'react';

export enum ENFTMediaState {
  Image = 'image',
  Video = 'video',
  Fallback = 'fallback',
}

const MAX_CACHE_SIZE = 500;

// Cache resolved media type by URL to avoid re-probing on cell recycling
const mediaStateCache = new Map<string, ENFTMediaState>();

function setCacheEntry(key: string, value: ENFTMediaState) {
  if (mediaStateCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mediaStateCache.keys().next().value;
    if (firstKey) mediaStateCache.delete(firstKey);
  }
  mediaStateCache.set(key, value);
}

function resolveMediaState(uri: string | undefined): ENFTMediaState {
  if (!uri) return ENFTMediaState.Fallback;
  return mediaStateCache.get(uri) ?? ENFTMediaState.Image;
}

export function useNFTMediaState(imageUri: string | undefined) {
  const [mediaState, setMediaState] = useState<ENFTMediaState>(() =>
    resolveMediaState(imageUri),
  );

  // Restore cached mediaState when imageUri changes (e.g. FlatList cell recycling)
  useEffect(() => {
    setMediaState(resolveMediaState(imageUri));
  }, [imageUri]);

  const handleImageError = useCallback(() => {
    if (imageUri) {
      setCacheEntry(imageUri, ENFTMediaState.Video);
    }
    setMediaState(ENFTMediaState.Video);
  }, [imageUri]);

  const handleVideoError = useCallback(() => {
    if (imageUri) {
      setCacheEntry(imageUri, ENFTMediaState.Fallback);
    }
    setMediaState(ENFTMediaState.Fallback);
  }, [imageUri]);

  return { mediaState, handleImageError, handleVideoError };
}
