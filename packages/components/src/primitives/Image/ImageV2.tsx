import { useCallback, useMemo, useRef, useState } from 'react';

import { Image as ExpoImage } from 'expo-image';
import { usePropsAndStyle } from 'tamagui';

import { Skeleton } from '../Skeleton';
import { type IStackStyle, Stack } from '../Stack';

import { useImage } from './useImage';

import type {
  ImageErrorEventData,
  ImageLoadEventData,
  ImageProgressEventData,
  ImageProps,
  ImageSource,
  ImageStyle,
} from 'expo-image';
import type { ImageSourcePropType } from 'react-native';

export type IImageV2Props = Omit<
  ImageProps,
  | 'source'
  | 'src'
  | 'pointerEvents'
  | 'onError'
  | 'onLoad'
  | 'resizeMode'
  | 'tintColor'
  | 'onProgress'
> &
  IStackStyle & {
    size?: IStackStyle['height'];
    source?: ImageSourcePropType | string | number;
    skeleton?: React.ReactNode;
    fallback?: React.ReactNode;
    src?: string;
    /** Retry times when image loading fails, default is 5 */
    retryTimes?: number;
    onError?: (event: ImageErrorEventData) => void;
    onLoad?: (event: ImageLoadEventData) => void;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
    onDisplay?: () => void;
    resizeMode?: ImageProps['resizeMode'];
    tintColor?: ImageProps['tintColor'];
    onProgress?: (event: ImageProgressEventData) => void;
  };

const getRandomRetryTimes = () => {
  return Math.floor(Math.random() * 2) * 1000;
};

export function ImageV2(props: IImageV2Props) {
  const sizeProps = useMemo(() => {
    // eslint-disable-next-line react/destructuring-assignment
    if (props?.size) {
      // eslint-disable-next-line react/destructuring-assignment
      const imageHeight = props?.height || props?.h || props?.size;
      // eslint-disable-next-line react/destructuring-assignment
      const imageWidth = props?.width || props?.w || props?.size;
      return {
        height: imageHeight,
        width: imageWidth,
      };
    }
    return undefined;
  }, [props?.size, props?.height, props?.h, props?.width, props?.w]);
  const [restProps, style] = usePropsAndStyle(
    sizeProps ? { ...props, ...sizeProps } : props,
    {
      resolveValues: 'auto',
    },
  ) as unknown as [IImageV2Props, ImageStyle];
  const retryTimesLimit = useRef<number>(restProps.retryTimes || 5);
  const retryTimes = useRef<number>(0);

  const [hasError, setHasError] = useState(false);
  const { image, reFetchImage } = useImage(restProps.source as ImageSource, {
    onError(error, retry) {
      console.error('Loading failed:', error.message);
      if (retryTimes.current < retryTimesLimit.current) {
        retryTimes.current += 1;
        setTimeout(() => {
          retry();
        }, getRandomRetryTimes() + retryTimes.current * 1000);
      } else {
        setHasError(true);
      }
    },
  });

  const {
    onError,
    fallback,
    skeleton,
    onLoad,
    onLoadEnd,
    onLoadStart,
    onDisplay,
  } = restProps;
  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      reFetchImage();
      onError?.(event);
    },
    [onError, reFetchImage],
  );

  if (!image) {
    if (hasError) {
      return fallback;
    }
    return skeleton || <Skeleton width={style.width} height={style.height} />;
  }

  return (
    <ExpoImage
      source={image}
      style={style}
      onError={handleError}
      onLoad={onLoad}
      onLoadEnd={onLoadEnd}
      onDisplay={onDisplay}
      onLoadStart={onLoadStart}
    />
  );
}
