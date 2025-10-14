import { usePropsAndStyle } from '../../shared/tamagui';
import NativeVideo from 'react-native-video';

import type { IVideoProps } from './type';
import type { ViewStyle } from 'react-native';

export function Video(rawProps: IVideoProps) {
  const [props, style] = usePropsAndStyle(rawProps);
  return <NativeVideo style={style as ViewStyle} {...props} />;
}

export type * from './type';
export * from './enum';
