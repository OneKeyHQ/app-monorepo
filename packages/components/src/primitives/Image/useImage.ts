import {
  type DependencyList,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Image,
  type ImageLoadOptions,
  type ImageRef,
  type ImageSource,
  resolveSource,
} from 'expo-image';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  cacheAndRetainImageRef,
  deleteCachedImagePath,
  getCachedImagePath,
  getCachedImageRefInfo,
  hasExactCachedImageRef,
  refreshCachedImagePath,
  refreshCachedImageRef,
  releaseCachedImageRef,
  retainCachedImageRef,
} from './cache';
import { isEmptyResolvedSource } from './utils';

interface IUseImageOptions extends ImageLoadOptions {
  onSuccess?: (image: ImageRef) => void;
}

type ILoadedImage = {
  cacheUri?: string;
  sourceUri?: string;
  imageRef: ImageRef;
  requestKey: string;
};

export function useImage(
  source: ImageSource | string | number | undefined,
  options: IUseImageOptions = {},
  dependencies: DependencyList = [],
  logicalCacheKey?: string,
): {
  image: ImageRef | ImageSource | null;
  reFetchImage: () => void;
} {
  const [loadedImage, setLoadedImage] = useState<ILoadedImage | null>(null);
  const resolvedSource = useMemo(() => {
    return resolveSource(source);
  }, [source]);
  const imageCacheKey = logicalCacheKey ?? resolvedSource?.uri;
  const imageRequestKey = `${imageCacheKey ?? ''}\u0000${
    resolvedSource?.uri ?? ''
  }`;
  const image =
    loadedImage?.requestKey === imageRequestKey ? loadedImage.imageRef : null;
  const cachedImageRefInfo = useMemo(() => {
    if (!resolvedSource?.uri || !/^https?:\/\//.test(resolvedSource.uri)) {
      return null;
    }
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    return getCachedImageRefInfo(imageCacheKey, resolvedSource?.uri) ?? null;
  }, [imageCacheKey, resolvedSource?.uri]);
  const cachedImageRef = cachedImageRefInfo?.imageRef ?? null;

  const cachedImage: ImageRef | ImageSource | null = useMemo(() => {
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return {
        uri: resolvedSource.uri,
      };
    }
    if (platformEnv.isNativeAndroid) {
      return resolvedSource;
    }
    if (cachedImageRef) {
      return cachedImageRef;
    }
    const imageUri = resolvedSource?.uri;
    const cachedPath = getCachedImagePath(imageUri);
    if (cachedPath) {
      return {
        uri: cachedPath,
      };
    }
    return null;
  }, [cachedImageRef, resolvedSource]);

  // Since options are not dependencies of the below effect, we store them in a ref.
  // Once the image is asynchronously loaded, the effect will use the most recent options,
  // instead of the captured ones (especially important for callbacks that may change in subsequent renders).
  const optionsRef = useRef<IUseImageOptions>(options);
  optionsRef.current = options;

  // We're doing some asynchronous action in this effect, so we should keep track
  // if the effect was already cleaned up. In that case, the async action shouldn't change the state.
  const isEffectValid = useRef(true);
  const loadRequestIdRef = useRef(0);

  const loadImage = useCallback(() => {
    loadRequestIdRef.current += 1;
    const loadRequestId = loadRequestIdRef.current;
    if (platformEnv.isNativeAndroid) {
      setLoadedImage(null);
      return;
    }
    if (!resolvedSource || isEmptyResolvedSource(resolvedSource)) {
      setLoadedImage(null);
      return;
    }
    Image.loadAsync(resolvedSource, optionsRef.current)
      .then((remoteImage) => {
        if (
          isEffectValid.current &&
          loadRequestId === loadRequestIdRef.current
        ) {
          optionsRef.current.onSuccess?.(remoteImage);
          const uri = resolvedSource?.uri;
          const cachedRef =
            uri && imageCacheKey
              ? cacheAndRetainImageRef(imageCacheKey, remoteImage, uri)
              : undefined;
          setLoadedImage({
            cacheUri: cachedRef ? imageCacheKey : undefined,
            sourceUri: cachedRef ? uri : undefined,
            imageRef: cachedRef ?? remoteImage,
            requestKey: imageRequestKey,
          });
          if (uri) {
            void refreshCachedImagePath(uri);
          }
        } else {
          remoteImage.release();
        }
      })
      .catch((error) => {
        if (
          !isEffectValid.current ||
          loadRequestId !== loadRequestIdRef.current
        ) {
          return;
        }
        setLoadedImage(null);
        if (optionsRef.current.onError) {
          optionsRef.current.onError(error, loadImage);
        } else {
          // Print unhandled errors to the console.
          console.error(
            `Loading an image from '${
              resolvedSource?.uri || ''
            }' failed, use 'onError' option to handle errors and suppress this message`,
          );
          console.error(error);
        }
      });
  }, [imageCacheKey, imageRequestKey, resolvedSource]);

  const reFetchImage = useCallback(() => {
    if (!resolvedSource) {
      return;
    }
    if (resolvedSource?.uri) {
      deleteCachedImagePath(resolvedSource?.uri);
    }
    if (isEffectValid.current) {
      loadImage();
    }
  }, [loadImage, resolvedSource]);

  // Track the current ImageRef for proper lifecycle management.
  // Using a ref avoids the closure capture bug where the effect cleanup
  // would release a stale image value instead of the current one.
  const currentLoadedImage = useRef<ILoadedImage | null>(null);

  // Release the previous ImageRef when the image state changes.
  // This ensures each ImageRef is released exactly once, only after
  // it has been replaced by a new one (preventing use-after-free).
  useEffect(() => {
    currentLoadedImage.current = loadedImage;
    return () => {
      const currentImage = currentLoadedImage.current;
      if (currentImage?.cacheUri) {
        releaseCachedImageRef(
          currentImage.cacheUri,
          currentImage.sourceUri,
          currentImage.imageRef,
        );
      } else if (currentImage) {
        currentImage.imageRef.release();
      }
      currentLoadedImage.current = null;
    };
  }, [loadedImage]);

  useEffect(() => {
    if (!cachedImageRefInfo || !imageCacheKey) {
      return;
    }
    const retainedImageRef = retainCachedImageRef(
      imageCacheKey,
      cachedImageRefInfo.sourceUri,
      cachedImageRefInfo.imageRef,
    );
    if (retainedImageRef !== cachedImageRefInfo.imageRef) {
      return;
    }
    return () => {
      releaseCachedImageRef(
        imageCacheKey,
        cachedImageRefInfo.sourceUri,
        cachedImageRefInfo.imageRef,
      );
    };
  }, [cachedImageRefInfo, imageCacheKey]);

  useEffect(() => {
    const imageUri = resolvedSource?.uri;
    if (!imageUri || cachedImageRef || !getCachedImagePath(imageUri)) {
      return;
    }
    void refreshCachedImageRef(imageUri, optionsRef.current, imageCacheKey);
  }, [cachedImageRef, imageCacheKey, resolvedSource?.uri]);

  useEffect(() => {
    isEffectValid.current = true;
    if (cachedImage) {
      setLoadedImage(null);
      if (
        cachedImageRef &&
        imageCacheKey &&
        resolvedSource?.uri &&
        !hasExactCachedImageRef(imageCacheKey, resolvedSource.uri)
      ) {
        loadImage();
      }
    } else {
      loadImage();
    }
    return () => {
      isEffectValid.current = false;
      loadRequestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSource?.uri, cachedImage, loadImage, ...dependencies]);

  return useMemo(() => {
    return {
      image: image || cachedImage,
      reFetchImage,
    };
  }, [cachedImage, image, reFetchImage]);
}
