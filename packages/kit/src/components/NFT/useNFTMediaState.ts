import { useCallback, useEffect, useState } from 'react';

export enum ENFTMediaState {
  Image = 'image',
  Video = 'video',
  Fallback = 'fallback',
}

// Cache resolved media type by URL to avoid re-probing on cell recycling
const mediaStateCache = new Map<string, ENFTMediaState>();

export function useNFTMediaState(imageUri: string | undefined) {
  const [mediaState, setMediaState] = useState<ENFTMediaState>(
    () =>
      (imageUri ? mediaStateCache.get(imageUri) : undefined) ??
      ENFTMediaState.Image,
  );

  // Restore cached mediaState when imageUri changes (e.g. FlatList cell recycling)
  useEffect(() => {
    setMediaState(
      (imageUri ? mediaStateCache.get(imageUri) : undefined) ??
        ENFTMediaState.Image,
    );
  }, [imageUri]);

  const handleImageError = useCallback(() => {
    if (imageUri) {
      mediaStateCache.set(imageUri, ENFTMediaState.Video);
    }
    setMediaState(ENFTMediaState.Video);
  }, [imageUri]);

  const handleVideoError = useCallback(() => {
    if (imageUri) {
      mediaStateCache.set(imageUri, ENFTMediaState.Fallback);
    }
    setMediaState(ENFTMediaState.Fallback);
  }, [imageUri]);

  return { mediaState, handleImageError, handleVideoError };
}
