import type { IStackProps } from '../../primitives';
import type { ReactVideoProps, VideoRef } from 'react-native-video';

export type IVideoProps = ReactVideoProps &
  Omit<IStackProps, 'children'> & {
    autoPlay?: boolean;
  };

export type IVideoRef = Pick<VideoRef, 'resume' | 'seek'>;
