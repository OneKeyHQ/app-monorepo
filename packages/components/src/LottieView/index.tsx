import type { LegacyRef } from 'react';
import { useEffect, useRef } from 'react';

import AnimatedLottieView from 'lottie-react-native';
import { AppState } from 'react-native';

import type { LottieComponentProps as LottieWebProps } from 'lottie-react';
import type { AnimatedLottieViewProps as LottieNativeProps } from 'lottie-react-native';
import type { AppStateStatus } from 'react-native';

// Stick props the same as LottieNative by now
type LottieViewProps = Omit<LottieWebProps, 'animationData'> & {
  source: LottieWebProps['animationData'] | LottieNativeProps['source'];
  style?: LottieNativeProps['style'];
  autoPlay?: boolean;
};

const LottieView = ({ source, autoPlay, loop, ...props }: LottieViewProps) => {
  const animationRef = useRef<AnimatedLottieView | null>();

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    // fix animation is stopped after entered background state on iOS
    // https://github.com/lottie-react-native/lottie-react-native/issues/412
    const handleStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current &&
        /inactive|background/.exec(appStateRef.current) &&
        nextAppState === 'active'
      ) {
        animationRef.current?.play?.();
      }
      appStateRef.current = nextAppState;
    };
    const subscription = AppState.addEventListener('change', handleStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // animation won't work in navigate(), needs delay here
    setTimeout(() => {
      if (autoPlay) {
        animationRef.current?.play?.();
      } else {
        animationRef.current?.pause?.();
      }
    }, 300);
  }, [autoPlay]);

  return (
    <AnimatedLottieView
      source={source as LottieNativeProps['source']}
      autoPlay={autoPlay}
      loop={!!loop}
      {...props}
      ref={animationRef as LegacyRef<AnimatedLottieView>}
    />
  );
};

export default LottieView;
