import type { IStackProps } from '../../primitives';
import type { ReactVideoProps } from 'react-native-video';

export type IVideoProps = ReactVideoProps &
  Omit<IStackProps, 'children'> & {
    autoPlay?: boolean;
  };

export { default as EResizeMode } from 'react-native-video/src/types/ResizeMode';
