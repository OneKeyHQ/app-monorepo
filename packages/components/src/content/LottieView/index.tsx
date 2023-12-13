import type { LegacyRef } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import AnimatedLottieView from 'lottie-react-native';
import { AppState } from 'react-native';

import type { ILottieViewProps } from './type';
import type { LottieViewProps as LottieNativeProps } from 'lottie-react-native';
import type { AppStateStatus } from 'react-native';

export const LottieView = forwardRef<
  typeof AnimatedLottieView,
  ILottieViewProps
>(({ source, loop, resizeMode, ...props }, ref) => {
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

  useImperativeHandle(ref as any, () => ({
    play: () => {
      animationRef.current?.play?.();
    },
    pause: () => {
      animationRef.current?.pause?.();
    },
    reset: () => {
      animationRef.current?.reset();
    },
  }));

  return (
    <AnimatedLottieView
      resizeMode={resizeMode}
      source={source as LottieNativeProps['source']}
      loop={!!loop}
      {...props}
      ref={animationRef as LegacyRef<AnimatedLottieView>}
    />
  );
});

LottieView.displayName = 'LottieView';

export * from './type';
