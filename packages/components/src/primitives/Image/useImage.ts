/* cspell:ignore blurhash thumbhash */

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
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

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

type IImageLoadRequest = {
  committed: boolean;
  consumerCount: number;
  generation: IImageLoadGeneration;
  imageRef?: ImageRef;
  promise: Promise<ImageRef>;
  released: boolean;
  reloadToken: number;
  source: ImageSource;
  settled: boolean;
};

type ICommittedImage = {
  generation: IImageSourceGeneration;
  imageRef: ImageRef;
  request: IImageLoadRequest;
};

type IReloadRequest = {
  cacheKey?: string;
  generation: IImageSourceGeneration;
  token: number;
};

type IResolvedImageSource = ImageSource & {
  scale?: number;
};

type IImageSourceGeneration = {
  requestSource: IResolvedImageSource | null;
  source: IResolvedImageSource | null;
};

type IImageLoadGeneration = {
  dependencies: DependencyList;
  sourceGeneration: IImageSourceGeneration;
};

function areDependenciesEqual(left: DependencyList, right: DependencyList) {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((dependency, index) => Object.is(dependency, right[index])))
  );
}

function areImageHeadersEqual(
  left?: Record<string, string>,
  right?: Record<string, string>,
) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

function areImageSourcesEqual(
  left: IResolvedImageSource | null,
  right: IResolvedImageSource | null,
) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return (
    (left.uri ?? null) === (right.uri ?? null) &&
    (left.width ?? null) === (right.width ?? null) &&
    (left.height ?? null) === (right.height ?? null) &&
    (left.scale ?? null) === (right.scale ?? null) &&
    (left.blurhash ?? null) === (right.blurhash ?? null) &&
    (left.thumbhash ?? null) === (right.thumbhash ?? null) &&
    (left.cacheKey ?? null) === (right.cacheKey ?? null) &&
    (left.webMaxViewportWidth ?? null) ===
      (right.webMaxViewportWidth ?? null) &&
    (left.isAnimated ?? null) === (right.isAnimated ?? null) &&
    areImageHeadersEqual(left.headers, right.headers)
  );
}

function createPrivateImageCacheKey() {
  return `onekey-private-image-${generateUUID()}`;
}

function createImageSourceGeneration(
  source: IResolvedImageSource | null,
): IImageSourceGeneration {
  // Expo Image otherwise keys native disk caches by URI even when request
  // headers differ. Use an opaque generation key unless the caller supplied a
  // stable request-scoped key that can be reused across mounts.
  return {
    source,
    requestSource:
      source?.headers && !source.cacheKey
        ? {
            ...source,
            cacheKey: createPrivateImageCacheKey(),
          }
        : source,
  };
}

function releaseImageRef(imageRef: ImageRef) {
  try {
    imageRef.release();
  } catch {
    // The native object may already have been released during teardown.
  }
}

function releaseUncommittedRequestImage(request: IImageLoadRequest) {
  if (
    request.consumerCount <= 0 &&
    request.settled &&
    request.imageRef &&
    !request.committed &&
    !request.released
  ) {
    request.released = true;
    releaseImageRef(request.imageRef);
  }
}

export function useImage(
  source: ImageSource | string | number | undefined,
  options: IUseImageOptions = {},
  dependencies: DependencyList = [],
): {
  image: ImageRef | ImageSource | null;
  reFetchImage: () => void;
} {
  const [committedImage, setCommittedImage] = useState<ICommittedImage | null>(
    null,
  );
  const [reloadRequest, setReloadRequest] = useState<IReloadRequest | null>(
    null,
  );
  const resolvedSourceCandidate = resolveSource(
    source,
  ) as IResolvedImageSource | null;
  const sourceGenerationRef = useRef<IImageSourceGeneration | null>(null);
  if (
    !sourceGenerationRef.current ||
    !areImageSourcesEqual(
      sourceGenerationRef.current.source,
      resolvedSourceCandidate,
    )
  ) {
    sourceGenerationRef.current = createImageSourceGeneration(
      resolvedSourceCandidate,
    );
  }
  const sourceGeneration = sourceGenerationRef.current;
  const resolvedSource = sourceGeneration.source;
  const loadGenerationRef = useRef<IImageLoadGeneration>({
    dependencies,
    sourceGeneration,
  });
  if (
    loadGenerationRef.current.sourceGeneration !== sourceGeneration ||
    !areDependenciesEqual(loadGenerationRef.current.dependencies, dependencies)
  ) {
    loadGenerationRef.current = {
      dependencies,
      sourceGeneration,
    };
  }
  const loadGeneration = loadGenerationRef.current;
  const currentReloadRequest =
    reloadRequest?.generation === sourceGeneration ? reloadRequest : null;
  const reloadToken = currentReloadRequest?.token ?? 0;
  const reloadCacheKey = currentReloadRequest?.cacheKey;
  const shouldBypassCache = reloadToken > 0;
  const usesRequestSpecificCache = Boolean(
    resolvedSource?.headers || resolvedSource?.cacheKey,
  );
  const image =
    committedImage?.generation === sourceGeneration
      ? committedImage.imageRef
      : null;
  const cachedImageRef = useMemo(() => {
    if (shouldBypassCache) {
      return null;
    }
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return null;
    }
    if (usesRequestSpecificCache) {
      return null;
    }
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    const imageUri = resolvedSource?.uri;
    return getCachedImageRef(imageUri) ?? null;
  }, [resolvedSource?.uri, shouldBypassCache, usesRequestSpecificCache]);

  const cachedImage: ImageRef | ImageSource | null = useMemo(() => {
    if (shouldBypassCache) {
      return null;
    }
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return {
        uri: resolvedSource.uri,
      };
    }
    if (usesRequestSpecificCache) {
      return null;
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
  }, [
    cachedImageRef,
    resolvedSource?.uri,
    shouldBypassCache,
    usesRequestSpecificCache,
  ]);
  // Since options are not dependencies of the below effect, we store them in a ref.
  // Once the image is asynchronously loaded, the effect will use the most recent options,
  // instead of the captured ones (especially important for callbacks that may change in subsequent renders).
  const optionsRef = useRef<IUseImageOptions>(options);
  optionsRef.current = options;

  const reFetchImage = useCallback(() => {
    const currentGeneration = sourceGenerationRef.current;
    if (!currentGeneration) {
      return;
    }
    const currentSource = currentGeneration.source;
    if (!currentSource) {
      return;
    }
    if (currentSource.uri) {
      deleteCachedImagePath(currentSource.uri);
    }
    const cacheKey =
      currentSource.headers || currentSource.cacheKey
        ? createPrivateImageCacheKey()
        : undefined;
    setReloadRequest((current) => ({
      cacheKey,
      generation: currentGeneration,
      token: current?.generation === currentGeneration ? current.token + 1 : 1,
    }));
  }, []);

  // Track the current ImageRef for proper lifecycle management.
  // Using a ref avoids the closure capture bug where the effect cleanup
  // would release a stale image value instead of the current one.
  const currentImageRef = useRef<ImageRef | null>(null);

  // Release the previous ImageRef after the replacement has been committed.
  useEffect(() => {
    const previousImage = currentImageRef.current;
    const nextImage = committedImage?.imageRef ?? null;
    if (committedImage) {
      committedImage.request.committed = true;
    }
    currentImageRef.current = nextImage;

    if (previousImage && previousImage !== nextImage) {
      releaseImageRef(previousImage);
    }
  }, [committedImage]);

  // Defer the final release until the current commit's cleanups have finished.
  useEffect(() => {
    return () => {
      const imageToRelease = currentImageRef.current;
      currentImageRef.current = null;

      if (imageToRelease) {
        queueMicrotask(() => {
          // Strict Mode may remount the effect before this microtask runs.
          if (currentImageRef.current !== imageToRelease) {
            releaseImageRef(imageToRelease);
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

  const latestRequestIdRef = useRef(0);
  const inFlightRequestRef = useRef<IImageLoadRequest | undefined>(undefined);
  useEffect(() => {
    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;
    const requestSource =
      reloadCacheKey && sourceGeneration.requestSource
        ? {
            ...sourceGeneration.requestSource,
            cacheKey: reloadCacheKey,
          }
        : sourceGeneration.requestSource;

    if (!requestSource || isEmptyResolvedSource(requestSource)) {
      setCommittedImage(null);
      return;
    }
    if (cachedImage) {
      setCommittedImage(null);
      return;
    }

    let cancelled = false;
    let request = inFlightRequestRef.current;
    if (
      !request ||
      request.generation !== loadGeneration ||
      request.reloadToken !== reloadToken ||
      request.settled
    ) {
      const createdRequest: IImageLoadRequest = {
        committed: false,
        consumerCount: 0,
        generation: loadGeneration,
        promise: Image.loadAsync(requestSource, optionsRef.current),
        released: false,
        reloadToken,
        source: requestSource,
        settled: false,
      };
      request = createdRequest;
      inFlightRequestRef.current = createdRequest;
      void createdRequest.promise.then(
        (remoteImage) => {
          createdRequest.imageRef = remoteImage;
          createdRequest.settled = true;
          releaseUncommittedRequestImage(createdRequest);
        },
        () => {
          createdRequest.settled = true;
        },
      );
    }
    const activeRequest = request;
    activeRequest.consumerCount += 1;

    void activeRequest.promise
      .then((remoteImage) => {
        if (cancelled || requestId !== latestRequestIdRef.current) {
          return;
        }
        optionsRef.current.onSuccess?.(remoteImage);
        setCommittedImage({
          generation: sourceGeneration,
          imageRef: remoteImage,
          request: activeRequest,
        });
        if (requestSource.uri && !usesRequestSpecificCache) {
          void refreshCachedImagePath(requestSource.uri);
        }
      })
      .catch((error) => {
        if (cancelled || requestId !== latestRequestIdRef.current) {
          return;
        }
        setCommittedImage(null);
        if (optionsRef.current.onError) {
          optionsRef.current.onError(error, reFetchImage);
        } else {
          // Print unhandled errors to the console.
          console.error(
            `Loading an image from '${
              requestSource.uri || ''
            }' failed, use 'onError' option to handle errors and suppress this message`,
          );
          console.error(error);
        }
      });

    return () => {
      cancelled = true;
      activeRequest.consumerCount = Math.max(
        0,
        activeRequest.consumerCount - 1,
      );
      releaseUncommittedRequestImage(activeRequest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedImage, loadGeneration, reloadCacheKey, reloadToken]);

  return useMemo(() => {
    return {
      image: cachedImage || image,
      reFetchImage,
    };
  }, [cachedImage, image, reFetchImage]);
}
