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
  deleteCachedImagePath,
  getCachedImagePath,
  getCachedImageRef,
  refreshCachedImagePath,
  releaseCachedImageRef,
  retainCachedImageRef,
} from './cache';
import { isEmptyResolvedSource } from './utils';

interface IUseImageOptions extends ImageLoadOptions {
  onSuccess?: (image: ImageRef) => void;
}

export function useImage(
  source: ImageSource | string | number | undefined,
  options: IUseImageOptions = {},
  dependencies: DependencyList = [],
): {
  image: ImageRef | ImageSource | null;
  reFetchImage: () => void;
} {
  const [image, setImage] = useState<ImageRef | null>(null);
  const [failedSource, setFailedSource] = useState<ImageSource | null>(null);
  const resolvedSource = useMemo(() => {
    return resolveSource(source);
  }, [source]);
  const cachedImageRef = useMemo(() => {
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return null;
    }
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    const imageUri = resolvedSource?.uri;
    return getCachedImageRef(imageUri) ?? null;
  }, [resolvedSource?.uri]);

  const cachedImage: ImageRef | ImageSource | null = useMemo(() => {
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return {
        uri: resolvedSource.uri,
      };
    }
    if (cachedImageRef) {
      return cachedImageRef;
    }
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    const imageUri = resolvedSource?.uri;
    const cachedPath = getCachedImagePath(imageUri);
    if (cachedPath) {
      return {
        uri: cachedPath,
      };
    }
    return null;
  }, [cachedImageRef, resolvedSource?.uri]);

  // Since options are not dependencies of the below effect, we store them in a ref.
  // Once the image is asynchronously loaded, the effect will use the most recent options,
  // instead of the captured ones (especially important for callbacks that may change in subsequent renders).
  const optionsRef = useRef<IUseImageOptions>(options);
  optionsRef.current = options;

  // We're doing some asynchronous action in this effect, so we should keep track
  // if the effect was already cleaned up. In that case, the async action shouldn't change the state.
  const isEffectValid = useRef(true);

  const loadImage = useCallback(() => {
    if (!resolvedSource || isEmptyResolvedSource(resolvedSource)) {
      setImage(null);
      setFailedSource(null);
      return;
    }
    setFailedSource(null);
    Image.loadAsync(resolvedSource, optionsRef.current)
      .then((remoteImage) => {
        if (isEffectValid.current) {
          setFailedSource(null);
          optionsRef.current.onSuccess?.(remoteImage);
          setImage(remoteImage);
          const uri = resolvedSource?.uri;
          if (uri) {
            void refreshCachedImagePath(uri);
          }
        }
      })
      .catch((error) => {
        if (!isEffectValid.current) {
          return;
        }
        setImage(null);
        setFailedSource(resolvedSource);
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
  }, [resolvedSource]);

  const fetchImageTimesLimit = useRef(0);
  const reFetchImage = useCallback(() => {
    if (!resolvedSource) {
      return;
    }
    if (resolvedSource?.uri) {
      deleteCachedImagePath(resolvedSource?.uri);
    }
    if (isEffectValid.current) {
      fetchImageTimesLimit.current += 1;
      loadImage();
    }
  }, [loadImage, resolvedSource]);

  // Track the current ImageRef for proper lifecycle management.
  // Using a ref avoids the closure capture bug where the effect cleanup
  // would release a stale image value instead of the current one.
  const currentImageRef = useRef<ImageRef | null>(null);

  // Release the previous ImageRef after the replacement has been committed.
  // Releasing it from the effect cleanup is too early because React may still
  // inspect the previous ImageRef while committing the new image props.
  useEffect(() => {
    const previousImage = currentImageRef.current;
    currentImageRef.current = image;

    if (previousImage && previousImage !== image) {
      previousImage.release();
    }
  }, [image]);

  // Defer the final release until the current commit's cleanups have finished.
  useEffect(() => {
    return () => {
      const imageToRelease = currentImageRef.current;
      currentImageRef.current = null;

      if (imageToRelease) {
        queueMicrotask(() => {
          // Strict Mode may remount the effect before this microtask runs.
          if (currentImageRef.current !== imageToRelease) {
            imageToRelease.release();
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    const imageUri = resolvedSource?.uri;
    if (!cachedImageRef || !imageUri) {
      return;
    }
    retainCachedImageRef(imageUri);
    return () => {
      releaseCachedImageRef(imageUri);
    };
  }, [cachedImageRef, resolvedSource?.uri]);

  useEffect(() => {
    isEffectValid.current = true;
    if (cachedImage) {
      return;
    }
    loadImage();
    return () => {
      isEffectValid.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSource?.uri, cachedImage, loadImage, ...dependencies]);

  return useMemo(() => {
    const sourceWhileLoading =
      failedSource !== resolvedSource &&
      resolvedSource &&
      !isEmptyResolvedSource(resolvedSource)
        ? resolvedSource
        : null;
    return {
      image:
        fetchImageTimesLimit.current > 0 && image
          ? image
          : cachedImage || image || sourceWhileLoading,
      reFetchImage,
    };
  }, [cachedImage, failedSource, image, reFetchImage, resolvedSource]);
}
