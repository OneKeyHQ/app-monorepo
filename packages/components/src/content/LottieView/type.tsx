import type { LottieComponentProps as LottieWebProps } from 'lottie-react';
import type { LottieViewProps as LottieNativeProps } from 'lottie-react-native';

// Stick props the same as LottieNative by now
export type ILottieViewProps = Omit<
  LottieWebProps,
  'animationData' | 'loop'
> & {
  source: LottieWebProps['animationData'] | LottieNativeProps['source'];
  style?: LottieNativeProps['style'];
  autoPlay?: boolean;
  resizeMode?: 'cover' | 'contain' | 'center';
  loop?: boolean;
};
