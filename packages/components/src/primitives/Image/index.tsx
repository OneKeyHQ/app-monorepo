import { usePropsAndStyle } from '@tamagui/core';
import { Image as NativeImage } from 'react-native';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ImageProps, ImageStyle, StyleProp } from 'react-native';

export type IImageProps = Omit<ImageProps, 'width' | 'height'> &
  StackStyleProps;
export function Image({ source, ...props }: IImageProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  if (!source) {
    return null;
  }
  return (
    <NativeImage
      source={source}
      {...restProps}
      width={style.width as number}
      height={style.height as number}
      style={style as StyleProp<ImageStyle>}
    />
  );
}
