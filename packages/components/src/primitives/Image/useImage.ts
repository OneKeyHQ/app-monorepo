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
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

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
  sourceKey: string;
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
    left.sourceKey === right.sourceKey &&
    left.sourceUri === right.sourceUri,
  );
}

function isPlainUriImageSource(
  source: ImageSource | null,
): source is ImageSource & { uri: string } {
  return Boolean(
    source &&
    typeof source.uri === 'string' &&
    Object.keys(source).length === 1,
  );
}

function getImageSourceKey(source: ImageSource | null) {
  if (!source) {
    return 'null';
  }
  // Token and network icons overwhelmingly use a plain URI. Keep that hot
  // path allocation-light while still preserving every source option for
  // authenticated/custom-cache requests.
  if (isPlainUriImageSource(source)) {
    return `uri:${source.uri}`;
  }
  return stableStringify(source);
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
    sourceKey: string;
    sourceUri: string;
  } | null>(null);
  const resolvedSourceCandidate = resolveSource(source);
  const sourceKey = getImageSourceKey(resolvedSourceCandidate);
  const stableResolvedSourceRef = useRef<{
    source: ImageSource | null;
    sourceKey: string;
  }>({ source: resolvedSourceCandidate, sourceKey });
  if (stableResolvedSourceRef.current.sourceKey !== sourceKey) {
    stableResolvedSourceRef.current = {
      source: resolvedSourceCandidate,
      sourceKey,
    };
  }
  const resolvedSource = stableResolvedSourceRef.current.source;
  const sourceUri = resolvedSource?.uri ?? '';
  const image = loadedImage?.sourceKey === sourceKey ? loadedImage.image : null;
  const isCustomCacheEligible = Boolean(
    isPlainUriImageSource(resolvedSource) && /^https?:\/\//.test(sourceUri),
  );
  const cachedImageRef = useMemo(() => {
    if (!isCustomCacheEligible || platformEnv.isNativeAndroid) {
      return null;
    }
    return getCachedImageRef(sourceUri) ?? null;
  }, [isCustomCacheEligible, sourceUri]);

  const cachedImage: ImageRef | ImageSource | null = useMemo(() => {
    if (sourceUri && !/^https?:\/\//.test(sourceUri)) {
      return resolvedSource;
    }
    // Native ExpoImage can render a stable URI directly and reuse its own
    // memory/disk cache. Forcing every view through Image.loadAsync first
    // guarantees a React skeleton frame on a cold cache. Keep the custom iOS
    // cache as the preferred fast path, then fall back to the URI itself.
    if (platformEnv.isNativeAndroid && isCustomCacheEligible) {
      return resolvedSource;
    }
    if (cachedImageRef) {
      return cachedImageRef;
    }
    if (!isCustomCacheEligible || platformEnv.isNativeAndroid) {
      return null;
    }
    const cachedPath = getCachedImagePath(sourceUri);
    if (cachedPath) {
      return {
        uri: cachedPath,
      };
    }
    if (platformEnv.isNativeIOS && isCustomCacheEligible) {
      return resolvedSource;
    }
    return null;
  }, [cachedImageRef, isCustomCacheEligible, resolvedSource, sourceUri]);

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
            setLoadedImage({ image: remoteImage, sourceKey, sourceUri });
            if (isCustomCacheEligible) {
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
    [isCustomCacheEligible, resolvedSource, sourceKey, sourceUri],
  );

  const refetchSourceKeyRef = useRef<string | null>(null);
  const reFetchImage = useCallback(() => {
    if (!resolvedSource) {
      return;
    }
    const activeScope = activeRequestScopeRef.current;
    if (!activeScope || activeScope.sourceKey !== sourceKey) {
      return;
    }
    if (isCustomCacheEligible) {
      deleteCachedImagePath(sourceUri);
    }
    const nextRequestScope = {
      lifecycleGeneration: activeScope.lifecycleGeneration,
      requestGeneration: requestGenerationRef.current + 1,
      sourceKey,
      sourceUri,
    };
    requestGenerationRef.current = nextRequestScope.requestGeneration;
    activeRequestScopeRef.current = nextRequestScope;
    refetchSourceKeyRef.current = sourceKey;
    loadImage(nextRequestScope);
  }, [isCustomCacheEligible, loadImage, resolvedSource, sourceKey, sourceUri]);

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
    if (!cachedImageRef || !sourceUri) {
      return;
    }
    retainCachedImageRef(sourceUri);
    return () => {
      releaseCachedImageRef(sourceUri);
    };
  }, [cachedImageRef, sourceUri]);

  useEffect(() => {
    refetchSourceKeyRef.current = null;
    const requestScope = {
      lifecycleGeneration: lifecycleGenerationRef.current + 1,
      requestGeneration: requestGenerationRef.current + 1,
      sourceKey,
      sourceUri,
    };
    lifecycleGenerationRef.current = requestScope.lifecycleGeneration;
    requestGenerationRef.current = requestScope.requestGeneration;
    activeRequestScopeRef.current = requestScope;
    if (cachedImage) {
      setLoadedImage(null);
    } else {
      // A loaded ImageRef belongs to one exact source descriptor. Clear a previous
      // source before loading the next one so a network/token icon can never
      // be rendered under the new semantic label. Same-source dependency
      // refreshes retain the current image until their replacement lands.
      setLoadedImage((current) =>
        current?.sourceKey === sourceKey ? current : null,
      );
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
  }, [sourceKey, cachedImage, loadImage, ...dependencies]);

  return useMemo(() => {
    return {
      image:
        refetchSourceKeyRef.current === sourceKey && image
          ? image
          : cachedImage || image,
      reFetchImage,
    };
  }, [cachedImage, image, reFetchImage, sourceKey]);
}
