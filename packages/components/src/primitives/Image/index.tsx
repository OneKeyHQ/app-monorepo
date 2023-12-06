import { usePropsAndStyle } from '@tamagui/core';
import { Image as NativeImage } from 'react-native';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ImageProps } from 'react-native';

export type IImageProps = ImageProps & StackStyleProps;
export function Image({ source, ...props }: ImageProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  if (!source) {
    return null;
  }
  return <NativeImage source={source} {...restProps} style={style} />;
}
