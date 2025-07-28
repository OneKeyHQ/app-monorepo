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
} from 'expo-image';
import { resolveSource } from 'expo-image';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isEmptyResolvedSource } from './utils';

const IMAGE_CACHE_MAP = new Map<string, string>();

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
  const resolvedSource = useMemo(() => {
    return resolveSource(source);
  }, [source]);
  const cachedImage: ImageSource | null = useMemo(() => {
    if (resolvedSource?.uri && !/^https?:\/\//.test(resolvedSource.uri)) {
      return {
        uri: resolvedSource.uri,
      };
    }
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    const imageUri = resolvedSource?.uri;
    if (imageUri && IMAGE_CACHE_MAP.has(imageUri)) {
      return {
        uri: IMAGE_CACHE_MAP.get(imageUri),
      };
    }
    return null;
  }, [resolvedSource?.uri]);

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
      return;
    }
    Image.loadAsync(resolvedSource, optionsRef.current)
      .then((remoteImage) => {
        if (isEffectValid.current) {
          optionsRef.current.onSuccess?.(remoteImage);
          setImage(remoteImage);
          const uri = resolvedSource?.uri;
          if (uri) {
            void Image.getCachePathAsync(uri).then((cachePath) => {
              if (cachePath) {
                IMAGE_CACHE_MAP.set(uri, cachePath);
              }
            });
          }
        }
      })
      .catch((error) => {
        if (!isEffectValid.current) {
          return;
        }
        setImage(null);
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
      IMAGE_CACHE_MAP.delete(resolvedSource?.uri);
    }
    if (isEffectValid.current) {
      fetchImageTimesLimit.current += 1;
      loadImage();
    }
  }, [loadImage, resolvedSource]);

  useEffect(() => {
    isEffectValid.current = true;
    if (cachedImage) {
      return;
    }
    loadImage();
    return () => {
      // Invalidate the effect and release the shared object to free up memory.
      isEffectValid.current = false;
      image?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSource?.uri, cachedImage, loadImage, ...dependencies]);

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
