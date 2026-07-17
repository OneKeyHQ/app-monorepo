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

type IImageRequestScope = {
  lifecycleGeneration: number;
  requestGeneration: number;
  sourceUri: string;
};

function isSameImageRequestScope(
  left?: IImageRequestScope | null,
  right?: IImageRequestScope | null,
) {
  return Boolean(
    left &&
    right &&
    left.lifecycleGeneration === right.lifecycleGeneration &&
    left.requestGeneration === right.requestGeneration &&
    left.sourceUri === right.sourceUri,
  );
}

export function useImage(
  source: ImageSource | string | number | undefined,
  options: IUseImageOptions = {},
  dependencies: DependencyList = [],
): {
  image: ImageRef | ImageSource | null;
  reFetchImage: () => void;
} {
  const [loadedImage, setLoadedImage] = useState<{
    image: ImageRef;
    sourceUri: string;
  } | null>(null);
  const resolvedSource = useMemo(() => {
    return resolveSource(source);
  }, [source]);
  const sourceUri = resolvedSource?.uri ?? '';
  const image = loadedImage?.sourceUri === sourceUri ? loadedImage.image : null;
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

  const lifecycleGenerationRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const activeRequestScopeRef = useRef<IImageRequestScope | null>(null);

  const loadImage = useCallback(
    (requestScope: IImageRequestScope) => {
      const runLoad = () => {
        if (
          !isSameImageRequestScope(activeRequestScopeRef.current, requestScope)
        ) {
          return;
        }
        if (!resolvedSource || isEmptyResolvedSource(resolvedSource)) {
          setLoadedImage(null);
          return;
        }
        Image.loadAsync(resolvedSource, optionsRef.current)
          .then((remoteImage) => {
            if (
              !isSameImageRequestScope(
                activeRequestScopeRef.current,
                requestScope,
              )
            ) {
              remoteImage.release();
              return;
            }
            optionsRef.current.onSuccess?.(remoteImage);
            setLoadedImage({ image: remoteImage, sourceUri });
            if (sourceUri) {
              void refreshCachedImagePath(sourceUri);
            }
          })
          .catch((error) => {
            if (
              !isSameImageRequestScope(
                activeRequestScopeRef.current,
                requestScope,
              )
            ) {
              return;
            }
            setLoadedImage(null);
            if (optionsRef.current.onError) {
              optionsRef.current.onError(error, runLoad);
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
      };
      runLoad();
    },
    [resolvedSource, sourceUri],
  );

  const fetchImageTimesLimit = useRef(0);
  const reFetchImage = useCallback(() => {
    if (!resolvedSource) {
      return;
    }
    const activeScope = activeRequestScopeRef.current;
    if (!activeScope || activeScope.sourceUri !== sourceUri) {
      return;
    }
    if (sourceUri) {
      deleteCachedImagePath(sourceUri);
    }
    const nextRequestScope = {
      lifecycleGeneration: activeScope.lifecycleGeneration,
      requestGeneration: requestGenerationRef.current + 1,
      sourceUri,
    };
    requestGenerationRef.current = nextRequestScope.requestGeneration;
    activeRequestScopeRef.current = nextRequestScope;
    fetchImageTimesLimit.current += 1;
    loadImage(nextRequestScope);
  }, [loadImage, resolvedSource, sourceUri]);

  // Track the current ImageRef for proper lifecycle management.
  // Using a ref avoids the closure capture bug where the effect cleanup
  // would release a stale image value instead of the current one.
  const currentImageRef = useRef<ImageRef | null>(null);

  // Release the previous ImageRef when the image state changes.
  // This ensures each ImageRef is released exactly once, only after
  // it has been replaced by a new one (preventing use-after-free).
  useEffect(() => {
    currentImageRef.current = image;
    return () => {
      if (currentImageRef.current) {
        currentImageRef.current.release();
        currentImageRef.current = null;
      }
    };
  }, [image]);

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
    const requestScope = {
      lifecycleGeneration: lifecycleGenerationRef.current + 1,
      requestGeneration: requestGenerationRef.current + 1,
      sourceUri,
    };
    lifecycleGenerationRef.current = requestScope.lifecycleGeneration;
    requestGenerationRef.current = requestScope.requestGeneration;
    activeRequestScopeRef.current = requestScope;
    if (!cachedImage) {
      loadImage(requestScope);
    }
    return () => {
      if (
        activeRequestScopeRef.current?.lifecycleGeneration ===
        requestScope.lifecycleGeneration
      ) {
        activeRequestScopeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUri, cachedImage, loadImage, ...dependencies]);

  return useMemo(() => {
    return {
      image:
        fetchImageTimesLimit.current > 0 && image
          ? image
          : cachedImage || image,
      reFetchImage,
    };
  }, [cachedImage, image, reFetchImage]);
}
