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
  identity: string;
  imageRef?: ImageRef;
  promise: Promise<ImageRef>;
  released: boolean;
  reloadToken: number;
  settled: boolean;
};

type ICommittedImage = {
  identity: string;
  imageRef: ImageRef;
  request: IImageLoadRequest;
};

type IReloadRequest = {
  identity: string;
  token: number;
};

function getImageSourceIdentity(source: ImageSource | null) {
  if (!source) {
    return '';
  }
  const headers = source.headers
    ? Object.entries(source.headers).toSorted(([left], [right]) =>
        left.localeCompare(right),
      )
    : null;
  return JSON.stringify([
    source.uri ?? null,
    headers,
    source.width ?? null,
    source.height ?? null,
    source.blurhash ?? null,
    source.thumbhash ?? null,
    source.cacheKey ?? null,
    source.webMaxViewportWidth ?? null,
    source.isAnimated ?? null,
  ]);
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
  const resolvedSourceCandidate = resolveSource(source);
  const sourceIdentity = getImageSourceIdentity(resolvedSourceCandidate);
  const resolvedSourceRef = useRef({
    identity: sourceIdentity,
    source: resolvedSourceCandidate,
  });
  if (resolvedSourceRef.current.identity !== sourceIdentity) {
    resolvedSourceRef.current = {
      identity: sourceIdentity,
      source: resolvedSourceCandidate,
    };
  }
  const resolvedSource = resolvedSourceRef.current.source;
  const reloadToken =
    reloadRequest?.identity === sourceIdentity ? reloadRequest.token : 0;
  const shouldBypassCache = reloadToken > 0;
  const image =
    committedImage?.identity === sourceIdentity
      ? committedImage.imageRef
      : null;
  const cachedImageRef = useMemo(() => {
    if (shouldBypassCache) {
      return null;
    }
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return null;
    }
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    const imageUri = resolvedSource?.uri;
    return getCachedImageRef(imageUri) ?? null;
  }, [resolvedSource?.uri, shouldBypassCache]);

  const cachedImage: ImageRef | ImageSource | null = useMemo(() => {
    if (shouldBypassCache) {
      return null;
    }
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
  }, [cachedImageRef, resolvedSource?.uri, shouldBypassCache]);
  // Since options are not dependencies of the below effect, we store them in a ref.
  // Once the image is asynchronously loaded, the effect will use the most recent options,
  // instead of the captured ones (especially important for callbacks that may change in subsequent renders).
  const optionsRef = useRef<IUseImageOptions>(options);
  optionsRef.current = options;

  const reFetchImage = useCallback(() => {
    const currentSource = resolvedSourceRef.current.source;
    if (!currentSource) {
      return;
    }
    if (currentSource.uri) {
      deleteCachedImagePath(currentSource.uri);
    }
    const currentIdentity = resolvedSourceRef.current.identity;
    setReloadRequest((current) => ({
      identity: currentIdentity,
      token: current?.identity === currentIdentity ? current.token + 1 : 1,
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
    const requestSource = resolvedSource;
    const requestSourceIdentity = sourceIdentity;

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
      request.identity !== requestSourceIdentity ||
      request.reloadToken !== reloadToken ||
      request.settled
    ) {
      const createdRequest: IImageLoadRequest = {
        committed: false,
        consumerCount: 0,
        identity: requestSourceIdentity,
        promise: Image.loadAsync(requestSource, optionsRef.current),
        released: false,
        reloadToken,
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
          identity: requestSourceIdentity,
          imageRef: remoteImage,
          request: activeRequest,
        });
        if (requestSource.uri) {
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
  }, [cachedImage, reloadToken, sourceIdentity, ...dependencies]);

  return useMemo(() => {
    return {
      image: cachedImage || image,
      reFetchImage,
    };
  }, [cachedImage, image, reFetchImage]);
}
