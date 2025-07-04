import { useRef, useState } from 'react';

import { Image as ExpoImage } from 'expo-image';
import { usePropsAndStyle } from 'tamagui';

import { Skeleton } from '../Skeleton';
import { type IStackStyle, Stack } from '../Stack';

import { useImage } from './useImage';

import type { ImageProps, ImageSource, ImageStyle } from 'expo-image';

export interface IBasicImageV2Props extends ImageProps {
  src: string;
}
export type IImageV2Props = Omit<IBasicImageV2Props, 'source' | 'src'> &
  IStackStyle & {
    source?: ImageSource | string | number;
    skeleton?: React.ReactNode;
    fallback?: React.ReactNode;
    src?: string;
  };

const getRandomRetryTimes = () => {
  return Math.floor(Math.random() * 2) * 1000;
};

export function ImageV2(props: IImageV2Props) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  }) as unknown as [IImageV2Props, ImageStyle];
  const retryTimes = useRef<number>(0);

  const [hasError, setHasError] = useState(false);
  const { image, reFetchImage } = useImage(restProps.source, {
    onError(error, retry) {
      console.error('Loading failed:', error.message);
      if (retryTimes.current < 10) {
        retryTimes.current += 1;
        setTimeout(() => {
          retry();
        }, getRandomRetryTimes() + retryTimes.current * 1000);
      } else {
        setHasError(true);
      }
    },
  });

  if (!image) {
    return (
      restProps.skeleton || (
        <Stack style={style}>
          <Skeleton width="100%" />
        </Stack>
      )
    );
  }

  if (hasError) {
    return <Stack style={style}>{restProps.fallback}</Stack>;
  }

  return <ExpoImage source={image} style={style} onError={reFetchImage} />;
}
