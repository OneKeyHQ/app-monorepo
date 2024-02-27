import type { StackProps } from '@tamagui/web/types';
import type { LottieComponentProps as LottieWebProps } from 'lottie-react';
import type { LottieViewProps as LottieNativeProps } from 'lottie-react-native';

// Stick props the same as LottieNative by now
export type ILottieViewProps = Omit<
  LottieWebProps,
  'animationData' | 'loop' | 'height' | 'width' | 'style'
> & {
  source: LottieWebProps['animationData'] | LottieNativeProps['source'];
  autoPlay?: boolean;
  resizeMode?: 'cover' | 'contain' | 'center';
  loop?: boolean;
} & Omit<StackProps, 'width' | 'height'> & {
    width?: StackProps['width'];
    height?: StackProps['height'];
  } & ({ width: StackProps['width'] } | { height: StackProps['height'] });
