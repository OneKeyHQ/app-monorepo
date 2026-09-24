import type { IStackProps } from '../../primitives';

export type IVideoSource =
  | number
  | string
  | {
      uri: number | string;
      headers?: Record<string, string>;
    };

export type IVideoProgressData = {
  currentTime: number;
  bufferDuration?: number;
  playableDuration?: number;
  seekableDuration?: number;
};

export type IVideoPlaybackState = {
  isPlaying: boolean;
  isBuffering: boolean;
};

type IVideoSpecificProps = {
  source: IVideoSource;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  paused?: boolean;
  playInBackground?: boolean;
  poster?: string;
  rate?: number;
  repeat?: boolean;
  resizeMode?: 'contain' | 'cover' | 'none' | 'stretch';
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onPlaybackStateChange?: (state: IVideoPlaybackState) => void;
  onProgress?: (data: IVideoProgressData) => void;
  onReadyForDisplay?: () => void;
};

export type IVideoProps = IVideoSpecificProps &
  Omit<IStackProps, 'children' | keyof IVideoSpecificProps>;

export type IVideoRef = {
  resume: () => void;
  seek: (time: number, tolerance?: number) => void;
};
