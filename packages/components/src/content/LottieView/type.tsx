import type { StackProps } from '@onekeyhq/components/src/shared/tamagui';

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
  renderMode?: LottieNativeProps['renderMode'];
  // Called when a non-looping animation reaches its end (`isCancelled` when
  // it was stopped first).
  onAnimationFinish?: (isCancelled: boolean) => void;
} & Omit<StackProps, 'width' | 'height'> & {
    width?: StackProps['width'];
    height?: StackProps['height'];
  } & ({ width?: StackProps['width'] } | { height?: StackProps['height'] });

// The imperative handle both platforms expose through `ref`.
export interface ILottieViewHandle {
  play: () => void;
  pause: () => void;
  // Continues from the paused frame (`play` restarts on Android).
  resume: () => void;
  reset: () => void;
}
